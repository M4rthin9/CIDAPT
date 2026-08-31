import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db.js';
import { banners, events, newsPosts, pages } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { writeAuditLog } from '../middleware/audit.js';
import { AppError, mustRow } from '../errors.js';
import {
  bannerUpsertSchema,
  eventUpsertSchema,
  newsUpsertSchema,
  pageUpsertSchema,
} from '@cida/contracts';

const content = new Hono();

content.use('*', authMiddleware);
content.use('*', requireMinRole('admin'));

function validationError(err: import('zod').ZodError): AppError {
  return new AppError(
    'validation_error',
    'ข้อมูลไม่ถูกต้อง',
    'Invalid input',
    422,
    Object.fromEntries(err.issues.map((i) => [i.path.join('.'), i.message])),
  );
}

// ------------------------- Pages -------------------------

content.get('/pages', async (c) => {
  const rows = await db.instance.select().from(pages).orderBy(asc(pages.slugTh));
  return c.json({ data: rows });
});

content.post('/pages', async (c) => {
  const parsed = pageUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);

  const [existing] = await db.instance
    .select()
    .from(pages)
    .where(eq(pages.slugTh, parsed.data.slugTh))
    .limit(1);

  const values = {
    slugEn: parsed.data.slugEn,
    titleTh: parsed.data.titleTh,
    titleEn: parsed.data.titleEn,
    bodyTh: parsed.data.bodyTh,
    bodyEn: parsed.data.bodyEn,
    status: parsed.data.status,
    publishedAt: parsed.data.status === 'published' ? (parsed.data.publishedAt ?? now) : null,
  };

  const row = mustRow(
    existing
      ? (
          await db.instance
            .update(pages)
            .set({ ...values, updatedAt: now })
            .where(eq(pages.id, existing.id))
            .returning()
        )[0]
      : (
          await db.instance
            .insert(pages)
            .values({ ...values, slugTh: parsed.data.slugTh, createdAt: now, updatedAt: now })
            .returning()
        )[0],
    'page',
  );

  await writeAuditLog(c, {
    action: existing ? 'page.update' : 'page.create',
    entityType: 'page',
    entityId: row.id,
    beforeState: existing ?? undefined,
    afterState: row,
  });
  return c.json({ data: row });
});

content.delete('/pages/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.instance.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!existing) throw new AppError('page_not_found', 'ไม่พบหน้า', 'Page not found', 404);
  await db.instance.delete(pages).where(eq(pages.id, id));
  await writeAuditLog(c, {
    action: 'page.delete',
    entityType: 'page',
    entityId: id,
    beforeState: existing,
  });
  return c.json({ data: { id, deleted: true } });
});

// ------------------------- News -------------------------

content.get('/news', async (c) => {
  const rows = await db.instance.select().from(newsPosts).orderBy(asc(newsPosts.slugTh));
  return c.json({ data: rows });
});

content.post('/news', async (c) => {
  const parsed = newsUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);
  const adminUserId = c.get('adminUserId') as string;

  const [existing] = await db.instance
    .select()
    .from(newsPosts)
    .where(eq(newsPosts.slugTh, parsed.data.slugTh))
    .limit(1);

  const values = {
    slugEn: parsed.data.slugEn,
    titleTh: parsed.data.titleTh,
    titleEn: parsed.data.titleEn,
    excerptTh: parsed.data.excerptTh,
    excerptEn: parsed.data.excerptEn,
    bodyTh: parsed.data.bodyTh,
    bodyEn: parsed.data.bodyEn,
    heroImageKey: parsed.data.heroImageKey,
    status: parsed.data.status,
    publishAt: parsed.data.publishAt,
    publishedAt: parsed.data.status === 'published' ? (parsed.data.publishedAt ?? now) : null,
  };

  const row = mustRow(
    existing
      ? (
          await db.instance
            .update(newsPosts)
            .set({ ...values, updatedAt: now })
            .where(eq(newsPosts.id, existing.id))
            .returning()
        )[0]
      : (
          await db.instance
            .insert(newsPosts)
            .values({
              ...values,
              slugTh: parsed.data.slugTh,
              authorAdminId: adminUserId,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
        )[0],
    'news post',
  );

  await writeAuditLog(c, {
    action: existing ? 'news.update' : 'news.create',
    entityType: 'news',
    entityId: row.id,
    beforeState: existing ?? undefined,
    afterState: row,
  });
  return c.json({ data: row });
});

content.delete('/news/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.instance
    .select()
    .from(newsPosts)
    .where(eq(newsPosts.id, id))
    .limit(1);
  if (!existing) throw new AppError('news_not_found', 'ไม่พบข่าว', 'News not found', 404);
  await db.instance.delete(newsPosts).where(eq(newsPosts.id, id));
  await writeAuditLog(c, {
    action: 'news.delete',
    entityType: 'news',
    entityId: id,
    beforeState: existing,
  });
  return c.json({ data: { id, deleted: true } });
});

// ------------------------- Events -------------------------

content.get('/events', async (c) => {
  const rows = await db.instance.select().from(events).orderBy(asc(events.startsAt));
  return c.json({ data: rows });
});

content.post('/events', async (c) => {
  const parsed = eventUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);

  const [inserted] = await db.instance
    .insert(events)
    .values({
      titleTh: parsed.data.titleTh,
      titleEn: parsed.data.titleEn,
      descriptionTh: parsed.data.descriptionTh,
      descriptionEn: parsed.data.descriptionEn,
      locationTh: parsed.data.locationTh,
      locationEn: parsed.data.locationEn,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      heroImageKey: parsed.data.heroImageKey,
      status: parsed.data.status,
      publishedAt: parsed.data.status === 'published' ? (parsed.data.publishedAt ?? now) : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const row = mustRow(inserted, 'event');

  await writeAuditLog(c, {
    action: 'event.create',
    entityType: 'event',
    entityId: row.id,
    afterState: row,
  });
  return c.json({ data: row });
});

content.put('/events/:id', async (c) => {
  const id = c.req.param('id');
  const parsed = eventUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);

  const [existing] = await db.instance.select().from(events).where(eq(events.id, id)).limit(1);
  if (!existing) throw new AppError('event_not_found', 'ไม่พบกิจกรรม', 'Event not found', 404);

  const [row] = await db.instance
    .update(events)
    .set({
      titleTh: parsed.data.titleTh,
      titleEn: parsed.data.titleEn,
      descriptionTh: parsed.data.descriptionTh,
      descriptionEn: parsed.data.descriptionEn,
      locationTh: parsed.data.locationTh,
      locationEn: parsed.data.locationEn,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      heroImageKey: parsed.data.heroImageKey,
      status: parsed.data.status,
      publishedAt:
        parsed.data.status === 'published'
          ? (parsed.data.publishedAt ?? Math.floor(Date.now() / 1000))
          : null,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(events.id, id))
    .returning();

  await writeAuditLog(c, {
    action: 'event.update',
    entityType: 'event',
    entityId: id,
    beforeState: existing,
    afterState: row,
  });
  return c.json({ data: row });
});

content.delete('/events/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.instance.select().from(events).where(eq(events.id, id)).limit(1);
  if (!existing) throw new AppError('event_not_found', 'ไม่พบกิจกรรม', 'Event not found', 404);
  await db.instance.delete(events).where(eq(events.id, id));
  await writeAuditLog(c, {
    action: 'event.delete',
    entityType: 'event',
    entityId: id,
    beforeState: existing,
  });
  return c.json({ data: { id, deleted: true } });
});

// ------------------------- Banners -------------------------

content.get('/banners', async (c) => {
  const rows = await db.instance.select().from(banners).orderBy(asc(banners.sortOrder));
  return c.json({ data: rows });
});

content.post('/banners', async (c) => {
  const parsed = bannerUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);

  const [inserted] = await db.instance
    .insert(banners)
    .values({
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const row = mustRow(inserted, 'banner');

  await writeAuditLog(c, {
    action: 'banner.create',
    entityType: 'banner',
    entityId: row.id,
    afterState: row,
  });
  return c.json({ data: row });
});

content.put('/banners/:id', async (c) => {
  const id = c.req.param('id');
  const parsed = bannerUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);

  const [existing] = await db.instance.select().from(banners).where(eq(banners.id, id)).limit(1);
  if (!existing) throw new AppError('banner_not_found', 'ไม่พบแบนเนอร์', 'Banner not found', 404);

  const [row] = await db.instance
    .update(banners)
    .set({
      ...parsed.data,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(banners.id, id))
    .returning();

  await writeAuditLog(c, {
    action: 'banner.update',
    entityType: 'banner',
    entityId: id,
    beforeState: existing,
    afterState: row,
  });
  return c.json({ data: row });
});

content.delete('/banners/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.instance.select().from(banners).where(eq(banners.id, id)).limit(1);
  if (!existing) throw new AppError('banner_not_found', 'ไม่พบแบนเนอร์', 'Banner not found', 404);
  await db.instance.delete(banners).where(eq(banners.id, id));
  await writeAuditLog(c, {
    action: 'banner.delete',
    entityType: 'banner',
    entityId: id,
    beforeState: existing,
  });
  return c.json({ data: { id, deleted: true } });
});

export default content;
