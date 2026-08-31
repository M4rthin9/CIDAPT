import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { creditNotes, taxInvoices } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { writeAuditLog } from '../middleware/audit.js';
import { AppError } from '../errors.js';
import { creditNoteCreateSchema } from '@cida/contracts';
import { nextDocumentNo } from '../lib/doc-counter.js';

const creditNotesRoutes = new Hono();

// Credit notes require admin+ role
creditNotesRoutes.use('*', authMiddleware, requireMinRole('admin'));

creditNotesRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = creditNoteCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'ข้อมูลไม่ถูกต้อง',
      'Invalid input',
      422,
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  }

  const { taxInvoiceId, reasonCode, reasonDetail, subtotalSatang, vatSatang, approvedAt } =
    parsed.data;
  const now = approvedAt ?? Math.floor(Date.now() / 1000);
  const adminUserId = c.get('adminUserId');

  // Fetch original invoice
  const [invoice] = await db.instance
    .select()
    .from(taxInvoices)
    .where(eq(taxInvoices.id, taxInvoiceId))
    .limit(1);

  if (!invoice) {
    throw new AppError('invoice_not_found', 'ไม่พบใบกำกับภาษี', 'Tax invoice not found', 404);
  }

  // Cannot issue credit note for voided invoice
  if (invoice.voidedAt) {
    throw new AppError(
      'invoice_voided',
      'ใบกำกับภาษีถูกยกเลิกแล้ว',
      'Cannot issue credit note for voided invoice',
      400,
    );
  }

  // Validate amounts — credit note cannot exceed original invoice
  const totalSatang = subtotalSatang + vatSatang;
  if (totalSatang > invoice.totalSatang) {
    throw new AppError(
      'credit_exceeds_invoice',
      'จำนวนเงินเกินใบกำกับภาษีเดิม',
      'Credit note amount cannot exceed original invoice',
      400,
    );
  }

  // Generate gapless credit note number
  const noteNo = await nextDocumentNo('credit_note');

  const [creditNote] = await db.instance
    .insert(creditNotes)
    .values({
      noteNo,
      taxInvoiceId,
      reasonCode,
      reasonDetail,
      subtotalSatang,
      vatSatang,
      totalSatang,
      approvedByAdminId: adminUserId,
      issuedAt: now,
      createdAt: now,
    })
    .returning();

  if (!creditNote) {
    throw new AppError(
      'credit_note_failed',
      'ออกใบลดหนี้ไม่สำเร็จ',
      'Failed to issue credit note',
      500,
    );
  }

  // Void the original invoice (it's now corrected by the credit note)
  await db.instance
    .update(taxInvoices)
    .set({ voidedAt: now })
    .where(eq(taxInvoices.id, taxInvoiceId));

  await writeAuditLog(c, {
    action: 'credit_note.issue',
    entityType: 'credit_note',
    entityId: creditNote.id,
    afterState: {
      noteNo,
      taxInvoiceId,
      reasonCode,
      totalSatang,
      approvedBy: adminUserId,
    },
  });

  return c.json({
    data: {
      creditNoteId: creditNote.id,
      noteNo: creditNote.noteNo,
      taxInvoiceId,
      reasonCode,
      subtotalSatang: creditNote.subtotalSatang,
      vatSatang: creditNote.vatSatang,
      totalSatang: creditNote.totalSatang,
    },
  });
});

export default creditNotesRoutes;
