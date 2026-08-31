import { Hono } from 'hono';
import { desc, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { auditLog } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';

const auditRoutes = new Hono();

auditRoutes.use('*', authMiddleware);
auditRoutes.use('*', requireMinRole('superadmin'));

// GET /api/v1/audit?entityType=&entityId=&action=&limit=&severity=
auditRoutes.get('/', async (c) => {
  const entityType = c.req.query('entityType');
  const entityId = c.req.query('entityId');
  const severity = c.req.query('severity');
  const action = c.req.query('action');
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);

  const rows = await db.instance
    .select()
    .from(auditLog)
    .where(
      sql`${auditLog.id} is not null
        ${entityType ? sql`and ${auditLog.entityType} = ${entityType}` : sql``}
        ${entityId ? sql`and ${auditLog.entityId} = ${entityId}` : sql``}
        ${severity ? sql`and ${auditLog.severity} = ${severity}` : sql``}
        ${action ? sql`and ${auditLog.action} = ${action}` : sql``}`,
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return c.json({ data: rows });
});

// GET /api/v1/audit/export — CSV export of audit rows
auditRoutes.get('/export', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 1000), 5000);
  const rows = await db.instance
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  const header = [
    'created_at',
    'actor_admin_id',
    'action',
    'severity',
    'entity_type',
    'entity_id',
    'request_id',
    'ip',
  ];
  const lines = rows.map((r) =>
    [
      r.createdAt,
      r.actorAdminId ?? '',
      r.action,
      r.severity,
      r.entityType,
      r.entityId ?? '',
      r.requestId ?? '',
      r.ip ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );

  const csv = [header.join(','), ...lines].join('\n');
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header(
    'Content-Disposition',
    `attachment; filename="audit-${Math.floor(Date.now() / 1000)}.csv"`,
  );
  return c.body(csv);
});

export default auditRoutes;
