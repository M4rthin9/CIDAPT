import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { getEnv } from '../config.js';
import { S3Storage } from '@cida/storage';

/**
 * Admin-only media proxy. Uploaded keys (`uploads/...`) are stored in MinIO and
 * never served from a public bucket; this route streams the object back so the
 * SPA can preview an image without exposing the storage endpoint or credentials.
 *
 * Finishes fresh off-/on-load images for the model's rendered formats too: a
 * key without a width suffix is served as-is, which is what the ladder stores
 * (`uploads/{id}` plus `uploads/{id}/{width}w.webp` via getImageKey).
 */
const media = new Hono();

media.use('*', authMiddleware);
media.use('*', requireMinRole('admin'));

media.get('/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const env = getEnv();

  const storage = new S3Storage({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    region: env.S3_REGION,
  });

  const file = await storage.get(key);
  if (!file) {
    throw new AppError('media_not_found', 'ไม่พบรูปภาพ', 'Image not found', 404);
  }

  const meta = await storage.head(key);
  const contentType = meta?.contentType ?? 'application/octet-stream';

  c.header('Content-Type', contentType);
  c.header('Cache-Control', 'private, max-age=86400');
  return c.body(new Uint8Array(file));
});

export default media;
