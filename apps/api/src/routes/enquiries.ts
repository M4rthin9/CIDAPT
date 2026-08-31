import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { productEnquiries } from '@cida/db/schema';
import { AppError } from '../errors.js';

const enquiries = new Hono();

const enquirySchema = z.object({
  productId: z.string().uuid(),
  ribbonText: z.string().min(1).max(200),
  deliveryDate: z.number().int().positive().optional(),
  deliveryTimeNote: z.string().max(200).optional(),
  venue: z.string().min(1).max(200),
  contactName: z.string().min(1).max(120),
  phone: z.string().regex(/^0\d{8,9}$/),
  email: z.string().email().optional(),
  lineId: z.string().max(60).optional(),
  message: z.string().max(1000).optional(),
});

enquiries.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'ข้อมูลไม่ถูกต้อง',
      'Invalid input',
      422,
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const data = parsed.data;

  const [enquiry] = await db.instance
    .insert(productEnquiries)
    .values({
      productId: data.productId,
      ribbonText: data.ribbonText,
      deliveryDate: data.deliveryDate ?? null,
      deliveryTimeNote: data.deliveryTimeNote ?? null,
      venue: data.venue,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email ?? null,
      lineId: data.lineId ?? null,
      message: data.message ?? null,
      status: 'new',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!enquiry) {
    throw new AppError('enquiry_failed', 'ส่งข้อมูลไม่สำเร็จ', 'Failed to submit enquiry', 500);
  }

  // Notification hook — delivery in P7 (LINE + SMTP)
  const { getLogger } = await import('../logger.js');
  const log = getLogger();
  log.info({ enquiryId: enquiry.id, productId: data.productId }, 'New product enquiry');

  return c.json({
    data: {
      enquiryId: enquiry.id,
      status: 'new',
      message_th: 'ได้รับข้อมูลแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็ว',
      message_en: 'Received — an officer will contact you shortly.',
    },
  });
});

export default enquiries;
