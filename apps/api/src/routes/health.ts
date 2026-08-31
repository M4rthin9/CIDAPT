import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { getDb } from '../db.js';
import { getLogger } from '../logger.js';

const health = new Hono();

health.get('/healthz', (c) => {
  return c.json({ status: 'ok' });
});

health.get('/readyz', async (c) => {
  const log = getLogger();
  const checks: Record<string, string> = {};

  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    checks.postgres = 'ok';
  } catch (err) {
    log.error({ err }, 'Postgres health check failed');
    checks.postgres = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const status = allOk ? 200 : 503;

  return c.json({ status: allOk ? 'ready' : 'degraded', checks }, status);
});

export default health;
