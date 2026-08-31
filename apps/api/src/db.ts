import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@cida/db/schema';
import { getEnv } from './config.js';

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;
let _pool: pg.Pool | undefined;

export function getDb() {
  if (_db) return _db;
  const env = getEnv();
  _pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  _db = drizzle(_pool, { schema });
  return _db;
}

// Convenience alias
export const db = {
  get instance() {
    return getDb();
  },
};

export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = undefined;
    _db = undefined;
  }
}
