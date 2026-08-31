import { Hono } from 'hono';
import { redirects } from '@cida/db/schema';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';

const app = new Hono();

// GET /api/v1/redirects/:fromPath — check if a path has a redirect
app.get('/:fromPath{.+}', async (c) => {
  const fromPath = c.req.param('fromPath');
  const fullFromPath = `/${fromPath}`;

  const row = await db.instance
    .select()
    .from(redirects)
    .where(eq(redirects.fromPath, fullFromPath))
    .limit(1);

  if (row.length === 0) {
    return c.json({ data: null }, 404);
  }

  const redir = row[0];
  if (!redir) {
    return c.json({ data: null }, 404);
  }

  return c.json({
    data: {
      from: redir.fromPath,
      to: redir.toPath,
      permanent: redir.permanent,
    },
  });
});

// POST /api/v1/redirects — create redirect (admin only)
app.post('/', async (c) => {
  const body = await c.req.json();
  const {
    fromPath,
    toPath,
    permanent = true,
  } = body as {
    fromPath: string;
    toPath: string;
    permanent?: boolean;
  };

  if (!fromPath || !toPath) {
    return c.json(
      {
        error: {
          code: 'missing_fields',
          message_th: 'กรุณาระบุที่อยู่',
          message_en: 'Paths required',
        },
      },
      422,
    );
  }

  const existing = await db.instance
    .select()
    .from(redirects)
    .where(eq(redirects.fromPath, fromPath))
    .limit(1);

  if (existing.length > 0) {
    await db.instance
      .update(redirects)
      .set({ toPath, permanent })
      .where(eq(redirects.fromPath, fromPath));
  } else {
    await db.instance.insert(redirects).values({ fromPath, toPath, permanent });
  }

  return c.json({ data: { from: fromPath, to: toPath, permanent } });
});

export default app;
