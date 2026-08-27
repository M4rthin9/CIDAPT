import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { documentCounters } from '@cida/db/schema';

// Gapless numbering (non-negotiable #6): locked counter row per scope+period.
// SELECT ... FOR UPDATE, increment in tx. Never a Postgres SEQUENCE.
// Sequences leave gaps on rollback; สรรพากร does not accept gaps.

export type DocumentScope = 'tax_invoice' | 'credit_note';

function getPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

export async function nextDocumentNo(scope: DocumentScope): Promise<string> {
  const period = getPeriod();
  const prefix = scope === 'tax_invoice' ? 'TAX' : 'CN';

  return db.instance.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(documentCounters)
      .where(and(eq(documentCounters.scope, scope), eq(documentCounters.period, period)))
      .for('update');

    let seq = 1;
    if (row) {
      seq = row.lastValue + 1;
      await tx
        .update(documentCounters)
        .set({ lastValue: seq, updatedAt: Math.floor(Date.now() / 1000) })
        .where(and(eq(documentCounters.scope, scope), eq(documentCounters.period, period)));
    } else {
      await tx.insert(documentCounters).values({
        scope,
        period,
        lastValue: seq,
        updatedAt: Math.floor(Date.now() / 1000),
      });
    }

    return `${prefix}-${period}-${String(seq).padStart(5, '0')}`;
  });
}
