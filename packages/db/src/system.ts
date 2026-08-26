import {
  pgTable,
  text,
  boolean,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, pk, updatedAt } from './_shared';
import { adminUsers } from './admin';
import { orders } from './orders';

// Non-negotiable #8: operator-changeable configuration lives here, typed by
// Zod schemas in @cida/contracts — zero code edits per deployment.
export const settingsRegistry = pgTable(
  'settings_registry',
  {
    key: text('key').primaryKey(),
    value: jsonb('value').notNull(),
    valueType: text('value_type').notNull(),
    description: text('description').notNull(),
    updatedByAdminId: uuid('updated_by_admin_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'settings_registry_type_check',
      sql`${t.valueType} in ('string', 'number', 'boolean', 'json')`,
    ),
  ],
);

// Non-negotiable #9: every mutating admin action writes a row here.
export const auditLog = pgTable(
  'audit_log',
  {
    id: pk(),
    actorAdminId: uuid('actor_admin_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    severity: text('severity').notNull().default('normal'),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state'),
    requestId: text('request_id'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_actor_time_idx').on(t.actorAdminId, t.createdAt),
    index('audit_log_severity_time_idx').on(t.severity, t.createdAt),
    check('audit_log_severity_check', sql`${t.severity} in ('normal', 'red')`),
  ],
);

export const redirects = pgTable(
  'redirects',
  {
    id: pk(),
    fromPath: text('from_path').notNull(),
    toPath: text('to_path').notNull(),
    permanent: boolean('permanent').notNull().default(true),
    createdByAdminId: uuid('created_by_admin_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('redirects_from_path_key').on(t.fromPath),
    check('redirects_from_absolute', sql`${t.fromPath} like '/%'`),
    check('redirects_to_absolute', sql`${t.toPath} like '/%'`),
  ],
);

// PDPA: append-only consent record with policy version.
export const consents = pgTable(
  'consents',
  {
    id: pk(),
    subjectEmail: text('subject_email').notNull(),
    consentType: text('consent_type').notNull(),
    policyVersion: text('policy_version').notNull(),
    granted: boolean('granted').notNull(),
    source: text('source'),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('consents_subject_idx').on(t.subjectEmail, t.consentType),
    check('consents_type_check', sql`${t.consentType} in ('marketing', 'analytics')`),
  ],
);
