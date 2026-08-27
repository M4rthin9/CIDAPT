import type { Context } from 'hono';
import { db } from '../db';
import { auditLog } from '@cida/db/schema';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  severity?: 'normal' | 'red';
}

export async function writeAuditLog(c: Context, entry: AuditEntry): Promise<void> {
  const adminUserId = c.get('adminUserId') as string | undefined;
  const requestId = c.get('requestId') as string | undefined;
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? null;

  await db.instance.insert(auditLog).values({
    actorAdminId: adminUserId ?? null,
    action: entry.action,
    severity: entry.severity ?? 'normal',
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    beforeState: entry.beforeState ?? null,
    afterState: entry.afterState ?? null,
    requestId: requestId ?? null,
    ip,
    createdAt: Math.floor(Date.now() / 1000),
  });
}
