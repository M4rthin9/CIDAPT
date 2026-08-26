import { bigint, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const pk = () => uuid('id').primaryKey().defaultRandom();

export const moneySatang = (name: string) => bigint(name, { mode: 'number' });

export const unixSeconds = (name: string) => bigint(name, { mode: 'number' });

const nowEpoch = sql`extract(epoch from now())::bigint`;

export const createdAt = () => unixSeconds('created_at').notNull().default(nowEpoch);

export const updatedAt = () => unixSeconds('updated_at').notNull().default(nowEpoch);
