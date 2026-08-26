import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';

let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
let pool: Pool;

async function applyMigrations() {
  const dir = join(import.meta.dirname, '..', 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  expect(files.length, 'no migrations found').toBeGreaterThan(0);
  for (const f of files) {
    const raw = readFileSync(join(dir, f), 'utf8');
    for (const stmt of raw.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed.length > 0) {
        await pool.query(trimmed);
      }
    }
  }
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16.15-alpine')
    .withDatabase('cida_test')
    .start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  await applyMigrations();
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('payments idempotency (non-negotiable #3)', () => {
  it('duplicate trans_ref insert returns the existing row, not an error', async () => {
    const orderId = (
      await pool.query<{ id: string }>(
        `insert into orders (
           order_no, contact_name, phone, addr_line1, subdistrict, district,
           province, postcode, subtotal_satang, discount_satang, shipping_satang,
           total_satang, placed_at
         ) values (
           'CIDA-2608-00001', 'ทดสอบ', '0200000000', '1 ถนนทดสอบ', 'แขวงทดสอบ',
           'เขตทดสอบ', 'กรุงเทพมหานคร', '10000', 125000, 0, 0, 125000,
           extract(epoch from now())::bigint
         ) returning id`,
      )
    ).rows[0]!.id;

    const insertOnce = async () => {
      const res = await pool.query<{ id: string }>(
        `insert into payments (
           order_id, rail, status, amount_satang, trans_ref, initiated_at
         ) values (
           $1, 'promptpay_billpay', 'awaiting_provider', 125000,
           'TPP2608260001', extract(epoch from now())::bigint
         )
         on conflict (trans_ref) do nothing
         returning id`,
        [orderId],
      );
      if (res.rowCount === 0) {
        return (
          await pool.query<{ id: string }>('select id from payments where trans_ref = $1', [
            'TPP2608260001',
          ])
        ).rows[0]!.id;
      }
      return res.rows[0]!.id;
    };

    const first = await insertOnce();
    const second = await insertOnce();

    expect(first).toBe(second);
    const count = await pool.query<{ n: string }>(
      'select count(*)::text as n from payments where trans_ref = $1',
      ['TPP2608260001'],
    );
    expect(count.rows[0]!.n).toBe('1');
  });

  it('a verified payment without trans_ref violates the schema contract', async () => {
    const orderId = (
      await pool.query<{ id: string }>(
        `insert into orders (
           order_no, contact_name, phone, addr_line1, subdistrict, district,
           province, postcode, subtotal_satang, discount_satang, shipping_satang,
           total_satang, placed_at
         ) values (
           'CIDA-2608-00002', 'ทดสอบ', '0200000000', '1 ถนนทดสอบ', 'แขวงทดสอบ',
           'เขตทดสอบ', 'กรุงเทพมหานคร', '10000', 50000, 0, 0, 50000,
           extract(epoch from now())::bigint
         ) returning id`,
      )
    ).rows[0]!.id;

    const paymentId = (
      await pool.query<{ id: string }>(
        `insert into payments (order_id, rail, amount_satang, initiated_at)
         values ($1, 'promptpay_billpay', 50000, extract(epoch from now())::bigint)
         returning id`,
        [orderId],
      )
    ).rows[0]!.id;

    // No trans_ref yet: verifying must be impossible at the schema level.
    await expect(
      pool.query(`update payments set status = 'verified' where id = $1`, [paymentId]),
    ).rejects.toThrow();
  });

  it('manual override without a typed reason is rejected by the schema', async () => {
    const orderId = (
      await pool.query<{ id: string }>(
        `insert into orders (
           order_no, contact_name, phone, addr_line1, subdistrict, district,
           province, postcode, subtotal_satang, discount_satang, shipping_satang,
           total_satang, placed_at
         ) values (
           'CIDA-2608-00003', 'ทดสอบ', '0200000000', '1 ถนนทดสอบ', 'แขวงทดสอบ',
           'เขตทดสอบ', 'กรุงเทพมหานคร', '10000', 50000, 0, 0, 50000,
           extract(epoch from now())::bigint
         ) returning id`,
      )
    ).rows[0]!.id;

    const paymentId = (
      await pool.query<{ id: string }>(
        `insert into payments (order_id, rail, amount_satang, initiated_at)
         values ($1, 'bank_transfer', 50000, extract(epoch from now())::bigint)
         returning id`,
        [orderId],
      )
    ).rows[0]!.id;

    await expect(
      pool.query(`update payments set verified_via = 'manual_override' where id = $1`, [paymentId]),
    ).rejects.toThrow();
  });
});
