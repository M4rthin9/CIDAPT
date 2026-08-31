import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db.js';
import { productEnquiries, products } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { writeAuditLog } from '../middleware/audit.js';
import { AppError, mustRow } from '../errors.js';
import { enquiryStatusUpdateSchema } from '@cida/contracts';

const enquiriesAdmin = new Hono();

// Officers work the enquiry inbox.
enquiriesAdmin.use('*', authMiddleware);
enquiriesAdmin.use('*', requireMinRole('officer'));

// GET /api/v1/admin/enquiries?status=
enquiriesAdmin.get('/', async (c) => {
  const status = c.req.query('status');

  const rows = await db.instance
    .select({
      id: productEnquiries.id,
      productId: productEnquiries.productId,
      productNameTh: products.nameTh,
      productNameEn: products.nameEn,
      ribbonText: productEnquiries.ribbonText,
      deliveryDate: productEnquiries.deliveryDate,
      deliveryTimeNote: productEnquiries.deliveryTimeNote,
      venue: productEnquiries.venue,
      contactName: productEnquiries.contactName,
      phone: productEnquiries.phone,
      email: productEnquiries.email,
      lineId: productEnquiries.lineId,
      message: productEnquiries.message,
      status: productEnquiries.status,
      handledByAdminId: productEnquiries.handledByAdminId,
      createdAt: productEnquiries.createdAt,
    })
    .from(productEnquiries)
    .innerJoin(products, eq(products.id, productEnquiries.productId))
    .where(status ? eq(productEnquiries.status, status) : undefined)
    .orderBy(desc(productEnquiries.createdAt));

  return c.json({ data: rows });
});

// PATCH /api/v1/admin/enquiries/:id/status
enquiriesAdmin.patch('/:id/status', async (c) => {
  const parsed = enquiryStatusUpdateSchema.safeParse({
    enquiryId: c.req.param('id'),
    ...(await c.req.json()),
  });
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'ข้อมูลไม่ถูกต้อง',
      'Invalid input',
      422,
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  }

  const { enquiryId, status } = parsed.data;
  const adminUserId = c.get('adminUserId') as string;

  const [existing] = await db.instance
    .select()
    .from(productEnquiries)
    .where(eq(productEnquiries.id, enquiryId))
    .limit(1);
  if (!existing) {
    throw new AppError('enquiry_not_found', 'ไม่พบคำสั่งซื้อสอบถาม', 'Enquiry not found', 404);
  }

  const [updated] = await db.instance
    .update(productEnquiries)
    .set({
      status,
      // Claim the enquiry for whoever moved it off `new`.
      handledByAdminId: parsed.data.handledByAdminId ?? existing.handledByAdminId ?? adminUserId,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(productEnquiries.id, enquiryId))
    .returning();
  const row = mustRow(updated, 'enquiry');

  await writeAuditLog(c, {
    action: `enquiry.status.${status}`,
    entityType: 'product_enquiry',
    entityId: enquiryId,
    beforeState: existing,
    afterState: row,
  });

  return c.json({ data: row });
});

export default enquiriesAdmin;
