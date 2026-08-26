import { pgTable, text, boolean, uuid, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, pk, unixSeconds, updatedAt } from './_shared';

export const adminUsers = pgTable(
  'admin_users',
  {
    id: pk(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').notNull(),
    active: boolean('active').notNull().default(true),
    lastLoginAt: unixSeconds('last_login_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('admin_users_email_key').on(t.email),
    check('admin_users_role_check', sql`${t.role} in ('superadmin', 'admin', 'officer')`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: pk(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: unixSeconds('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_key').on(t.tokenHash),
    index('sessions_admin_idx').on(t.adminUserId),
    index('sessions_expires_idx').on(t.expiresAt),
  ],
);
