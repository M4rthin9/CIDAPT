import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { taxInvoices, orders, orderItems } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { writeAuditLog } from '../middleware/audit';
import { AppError } from '../errors';
import { taxInvoiceIssueSchema } from '@cida/contracts';
import { nextDocumentNo } from '../lib/doc-counter';
import { htmlToPdf } from '../lib/pdf';
import { readFileSync } from 'fs';
import { join } from 'path';

const taxInvoicesRoutes = new Hono();

// All tax invoice routes require admin+ role
taxInvoicesRoutes.use('*', authMiddleware, requireMinRole('admin'));

taxInvoicesRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = taxInvoiceIssueSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'ข้อมูลไม่ถูกต้อง',
      'Invalid input',
      422,
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  }

  const { orderId, buyerName, buyerTaxId, buyerBranchNo, buyerAddress } = parsed.data;
  const now = parsed.data.issuedAt ?? Math.floor(Date.now() / 1000);

  // Fetch order
  const [order] = await db.instance.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) {
    throw new AppError('order_not_found', 'ไม่พบคำสั่งซื้อ', 'Order not found', 404);
  }

  // Check order is paid
  if (
    order.status !== 'paid' &&
    order.status !== 'processing' &&
    order.status !== 'shipped' &&
    order.status !== 'completed'
  ) {
    throw new AppError(
      'order_not_eligible',
      'คำสั่งซื้อยังไม่ชำระเงิน',
      'Order must be paid before issuing tax invoice',
      400,
    );
  }

  // Check no existing invoice for this order
  const [existing] = await db.instance
    .select()
    .from(taxInvoices)
    .where(eq(taxInvoices.orderId, orderId))
    .limit(1);

  if (existing) {
    throw new AppError(
      'invoice_already_exists',
      'คำสั่งซื้อนี้มีใบกำกับภาษีแล้ว',
      'Tax invoice already issued for this order',
      400,
    );
  }

  // Fetch order items for PDF
  const items = await db.instance.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  // Generate gapless invoice number
  const invoiceNo = await nextDocumentNo('tax_invoice');

  // Calculate VAT (VAT-inclusive pricing — VAT is derived)
  const totalSatang = order.totalSatang;
  const vatSatang = Math.round((totalSatang * 7) / 107);
  const subtotalSatang = totalSatang - vatSatang;

  // Generate PDF
  const templatePath = join(import.meta.dirname, '../templates/tax-invoice.html');
  let template = readFileSync(templatePath, 'utf-8');

  const formatMoney = (satang: number) => `฿${(satang / 100).toFixed(2)}`;
  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('th-TH');

  const itemsHtml = items
    .map(
      (item, i) => `<tr>
        <td>${i + 1}</td>
        <td>${item.nameTh}</td>
        <td>${item.quantity}</td>
        <td class="amount">${formatMoney(item.unitPriceSatang)}</td>
        <td class="amount">${formatMoney(item.lineTotalSatang)}</td>
      </tr>`,
    )
    .join('');

  template = template
    .replace('{{invoiceNo}}', invoiceNo)
    .replace('{{issuedAt}}', formatDate(now))
    .replace('{{orderNo}}', order.orderNo)
    .replace('{{buyerName}}', buyerName)
    .replace('{{buyerTaxId}}', buyerTaxId)
    .replace('{{#if buyerBranchNo}}', buyerBranchNo ? '' : '<!--')
    .replace('{{/if}}', buyerBranchNo ? '' : '-->')
    .replace('{{buyerBranchNo}}', buyerBranchNo ?? '')
    .replace('{{buyerAddress}}', buyerAddress)
    .replace('{{items}}', itemsHtml)
    .replace('{{subtotal}}', formatMoney(subtotalSatang))
    .replace('{{vat}}', formatMoney(vatSatang))
    .replace('{{total}}', formatMoney(totalSatang));

  await htmlToPdf(template, `${invoiceNo}.pdf`);

  // Store PDF key (simplified — full storage integration in P8)
  const pdfKey = `invoices/${invoiceNo}.pdf`;

  const [invoice] = await db.instance
    .insert(taxInvoices)
    .values({
      invoiceNo,
      orderId,
      buyerName,
      buyerTaxId,
      buyerBranchNo: buyerBranchNo ?? null,
      buyerAddress,
      subtotalSatang,
      vatSatang,
      totalSatang,
      issuedAt: now,
      pdfKey,
      createdAt: now,
    })
    .returning();

  if (!invoice) {
    throw new AppError(
      'invoice_failed',
      'ออกใบกำกับภาษีไม่สำเร็จ',
      'Failed to issue tax invoice',
      500,
    );
  }

  await writeAuditLog(c, {
    action: 'tax_invoice.issue',
    entityType: 'tax_invoice',
    entityId: invoice.id,
    afterState: { invoiceNo, orderId, totalSatang },
  });

  return c.json({
    data: {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      orderId,
      subtotalSatang: invoice.subtotalSatang,
      vatSatang: invoice.vatSatang,
      totalSatang: invoice.totalSatang,
      pdfKey: invoice.pdfKey,
    },
  });
});

export default taxInvoicesRoutes;
