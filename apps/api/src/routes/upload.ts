import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { writeAuditLog } from '../middleware/audit';
import { AppError } from '../errors';
import { getEnv } from '../config';
import { S3Storage } from '@cida/storage';
import { generateImageLadder, getImageKey } from '@cida/storage';

const upload = new Hono();

upload.use('*', authMiddleware);
upload.use('*', requireMinRole('admin'));

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

upload.post('/', async (c) => {
  const env = getEnv();
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    throw new AppError(
      'upload_no_file',
      'กรุณาเลือกไฟล์',
      'No file provided',
      400,
    );
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new AppError(
      'upload_invalid_type',
      'ประเภทไฟล์ไม่รองรับ',
      'Unsupported file type',
      400,
    );
  }

  if (file.size > MAX_SIZE) {
    throw new AppError(
      'upload_too_large',
      'ไฟล์มีขนาดใหญ่เกินไป',
      'File too large',
      400,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type.split('/')[1] ?? 'bin';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const key = `uploads/${filename}`;

  const storage = new S3Storage({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    region: env.S3_REGION,
  });

  // Upload original
  await storage.put(key, buffer, file.type);

  // Generate and upload image ladder
  let ladder;
  try {
    ladder = await generateImageLadder(buffer);
    for (const variant of ladder.variants) {
      const variantKey = getImageKey('uploads', variant.width, variant.format);
      await storage.put(variantKey, variant.buffer, `image/${variant.format}`);
    }
  } catch {
    // Non-image files skip ladder
  }

  await writeAuditLog(c, {
    action: 'upload.create',
    entityType: 'upload',
    entityId: key,
    afterState: { key, size: file.size, type: file.type },
  });

  return c.json({
    data: {
      key,
      originalName: file.name,
      contentType: file.type,
      size: file.size,
      variants: ladder?.variants.map((v) => ({
        width: v.width,
        key: getImageKey('uploads', v.width, v.format),
      })),
    },
  });
});

export default upload;
