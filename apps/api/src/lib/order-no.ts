import { db } from '../db';
import { settingsRegistry } from '@cida/db/schema';
import { eq } from 'drizzle-orm';

// Counter row for gapless order numbers — locked row, NOT a Postgres SEQUENCE.
// Non-negotiable #6: sequences leave gaps on rollback; สรรพากร does not accept gaps.

const COUNTER_KEY = 'order_no_counter';

export async function nextOrderNo(): Promise<string> {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `CIDA-${yy}${mm}`;

  const result = await db.instance.transaction(async (tx) => {
    // Lock the counter row
    const [row] = await tx
      .select()
      .from(settingsRegistry)
      .where(eq(settingsRegistry.key, COUNTER_KEY))
      .for('update');

    let seq = 1;
    if (row) {
      seq = Number(row.value) + 1;
      await tx
        .update(settingsRegistry)
        .set({ value: seq, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(settingsRegistry.key, COUNTER_KEY));
    } else {
      await tx.insert(settingsRegistry).values({
        key: COUNTER_KEY,
        value: seq,
        valueType: 'number',
        description: 'Gapless order number counter',
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      });
    }

    return `${prefix}-${String(seq).padStart(5, '0')}`;
  });

  return result;
}
