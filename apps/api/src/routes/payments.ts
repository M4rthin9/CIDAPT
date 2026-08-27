import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { payments, orders } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { writeAuditLog } from '../middleware/audit';
import { AppError } from '../errors';
import {
  paymentInitiateSchema,
  reconciliationEventSchema,
  manualVerifySchema,
} from '@cida/contracts';
import { buildBillPaymentQr, buildTransferProxyQr } from '@cida/promptpay';
import { getEnv } from '../config';
import type { ReconciliationProvider } from '../lib/reconciliation';
import { FakeReconciliationProvider } from '../lib/reconciliation';

const paymentsRoutes = new Hono();

let _reconProvider: ReconciliationProvider | null = null;
function getReconProvider(): ReconciliationProvider {
  if (!_reconProvider) {
    const env = getEnv();
    if (env.RECONCILIATION_PROVIDER === 'fake') {
      _reconProvider = new FakeReconciliationProvider();
    } else {
      throw new AppError(
        'provider_not_configured',
        'ผู้ให้บริการยังไม่ได้ตั้งค่า',
        'Reconciliation provider not configured',
        500,
      );
    }
  }
  return _reconProvider;
}

paymentsRoutes.post('/initiate', async (c) => {
  const body = await c.req.json();
  const parsed = paymentInitiateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'ข้อมูลไม่ถูกต้อง',
      'Invalid input',
      422,
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  }

  const { orderId, rail, amountSatang } = parsed.data;

  const [order] = await db.instance.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) {
    throw new AppError('order_not_found', 'ไม่พบคำสั่งซื้อ', 'Order not found', 404);
  }

  if (order.status !== 'pending_payment') {
    throw new AppError(
      'order_not_payable',
      'คำสั่งซื้อไม่อยู่ในสถานะรอชำระ',
      'Order is not in pending_payment status',
      400,
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const [payment] = await db.instance
    .insert(payments)
    .values({
      orderId,
      rail,
      status: 'pending',
      amountSatang,
      initiatedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!payment) {
    throw new AppError(
      'payment_failed',
      'สร้างรายการชำระไม่สำเร็จ',
      'Failed to create payment',
      500,
    );
  }

  let qrPayload: string | undefined;
  const env = getEnv();

  if (rail === 'promptpay_billpay' && env.BILLER_COMP_CODE) {
    qrPayload = buildBillPaymentQr({
      ref1: order.orderNo,
      amountSatang,
    });
  } else if (rail === 'promptpay_ewallet') {
    qrPayload = buildTransferProxyQr({
      targetType: 'phone',
      target: order.phone,
      amountSatang,
    });
  }

  await writeAuditLog(c, {
    action: 'payment.initiate',
    entityType: 'payment',
    entityId: payment.id,
    afterState: { orderId, rail, amountSatang },
  });

  return c.json({
    data: {
      paymentId: payment.id,
      orderId,
      rail,
      amountSatang,
      status: payment.status,
      qrPayload,
    },
  });
});

paymentsRoutes.post('/reconcile', async (c) => {
  const body = await c.req.json();
  const parsed = reconciliationEventSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'ข้อมูลไม่ถูกต้อง',
      'Invalid input',
      422,
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  }

  const event = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  let existingPayment: {
    id: string;
    status: string;
    transRef: string | null;
    rail: string;
    orderId: string;
  } | null = null;

  if (event.transRef) {
    const [row] = await db.instance
      .select()
      .from(payments)
      .where(eq(payments.transRef, event.transRef))
      .limit(1);
    existingPayment = row ?? null;
  }

  if (!existingPayment && event.externalRef && event.rail) {
    const [row] = await db.instance
      .select()
      .from(payments)
      .where(and(eq(payments.rail, event.rail), eq(payments.externalRef, event.externalRef)))
      .limit(1);
    existingPayment = row ?? null;
  }

  if (existingPayment && existingPayment.status === 'verified') {
    return c.json({
      data: {
        paymentId: existingPayment.id,
        status: 'already_verified',
      },
    });
  }

  const provider = getReconProvider();
  let matched = false;

  if (event.transRef) {
    const lookup = await provider.lookup(event.transRef);
    if (lookup) matched = true;
  }

  if (!matched && event.ref1) {
    const lookup = await provider.matchByRef1(event.ref1);
    if (lookup) matched = true;
  }

  if (!matched) {
    return c.json({
      data: {
        status: 'no_match',
        message: 'No matching provider record found',
      },
    });
  }

  if (existingPayment) {
    await db.instance
      .update(payments)
      .set({
        status: 'verified',
        transRef: event.transRef ?? existingPayment.transRef,
        verifiedVia: 'provider_lookup',
        verifiedAt: now,
        settledAt: now,
        updatedAt: now,
      })
      .where(eq(payments.id, existingPayment.id));

    await db.instance
      .update(orders)
      .set({ status: 'paid', paidAt: now, updatedAt: now })
      .where(eq(orders.id, existingPayment.orderId));

    return c.json({
      data: {
        paymentId: existingPayment.id,
        status: 'verified',
      },
    });
  }

  let orderId: string | null = null;
  if (event.ref1) {
    const [order] = await db.instance
      .select()
      .from(orders)
      .where(eq(orders.orderNo, event.ref1))
      .limit(1);
    if (order) orderId = order.id;
  }

  if (!orderId) {
    throw new AppError(
      'reconcile_no_order',
      'ไม่พบคำสั่งซื้อจาก Ref1',
      'No order found for Ref1',
      400,
    );
  }

  let newPayment: { id: string } | null = null;
  try {
    const [row] = await db.instance
      .insert(payments)
      .values({
        orderId,
        rail: event.rail,
        status: 'verified',
        amountSatang: event.amountSatang,
        transRef: event.transRef ?? null,
        externalRef: event.externalRef ?? null,
        verifiedVia: 'provider_lookup',
        verifiedAt: now,
        settledAt: now,
        initiatedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    newPayment = row ?? null;
  } catch (err: unknown) {
    // Concurrent duplicate — re-query existing row
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      const [existing] = await db.instance
        .select()
        .from(payments)
        .where(eq(payments.orderId, orderId))
        .limit(1);
      if (existing) {
        return c.json({
          data: {
            paymentId: existing.id,
            status: 'already_verified',
          },
        });
      }
    }
    throw err;
  }

  await db.instance
    .update(orders)
    .set({ status: 'paid', paidAt: now, updatedAt: now })
    .where(eq(orders.id, orderId));

  await writeAuditLog(c, {
    action: 'payment.reconcile',
    entityType: 'payment',
    entityId: newPayment?.id ?? '',
    afterState: { orderId, rail: event.rail, transRef: event.transRef },
  });

  return c.json({
    data: {
      paymentId: newPayment?.id,
      status: 'verified',
    },
  });
});

paymentsRoutes.post('/manual-verify', authMiddleware, requireMinRole('superadmin'), async (c) => {
  const body = await c.req.json();
  const parsed = manualVerifySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'ข้อมูลไม่ถูกต้อง',
      'Invalid input',
      422,
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  }

  const { paymentId, reason } = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const adminUserId = c.get('adminUserId');

  const [payment] = await db.instance
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment) {
    throw new AppError('payment_not_found', 'ไม่พบการชำระเงิน', 'Payment not found', 404);
  }

  if (payment.status === 'verified') {
    throw new AppError(
      'payment_already_verified',
      'การชำระเงินได้รับการยืนยันแล้ว',
      'Payment already verified',
      400,
    );
  }

  await db.instance
    .update(payments)
    .set({
      status: 'verified',
      verifiedVia: 'manual_override',
      verifiedByAdminId: adminUserId,
      verifiedReason: reason,
      verifiedAt: now,
      settledAt: now,
      updatedAt: now,
    })
    .where(eq(payments.id, paymentId));

  await db.instance
    .update(orders)
    .set({ status: 'paid', paidAt: now, updatedAt: now })
    .where(eq(orders.id, payment.orderId));

  await writeAuditLog(c, {
    action: 'payment.manual_verify',
    entityType: 'payment',
    entityId: paymentId,
    severity: 'red',
    beforeState: { status: payment.status, transRef: payment.transRef },
    afterState: { status: 'verified', reason, verifiedBy: adminUserId },
  });

  return c.json({
    data: {
      paymentId,
      status: 'verified',
      verifiedVia: 'manual_override',
    },
  });
});

export default paymentsRoutes;
