import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { orders, payments } from '@cida/db/schema';
import { writeAuditLog } from '../middleware/audit.js';
import { AppError } from '../errors.js';
import { buildBillPaymentQr, buildTransferProxyQr } from '@cida/promptpay';
import type { Env } from '../config.js';
import { getEnv } from '../config.js';

export type Rail = 'promptpay_billpay' | 'promptpay_ewallet' | 'bank_transfer';

/**
 * Backend-selected payment rail. The buyer never picks one: Bill Payment (tag-30)
 * is the default whenever a biller comp code is configured, otherwise the PromptPay
 * transfer rail (tag-29) when a merchant PromptPay number is set, otherwise the
 * plain bank-transfer rail (account details, no QR).
 */
export function selectPaymentRail(env: Env): Rail {
  if (env.BILLER_COMP_CODE) return 'promptpay_billpay';
  if (env.PROMPTPAY_NUMBER) return 'promptpay_ewallet';
  return 'bank_transfer';
}

export interface AccountDetails {
  bank: string;
  accountName: string;
  accountNo: string;
}

/** Human-readable transfer details for the bank-transfer rail, if configured. */
export function accountDetails(env: Env): AccountDetails | null {
  if (!env.BANK_NAME && !env.BANK_ACCOUNT_NAME && !env.BANK_ACCOUNT_NO) return null;
  return {
    bank: env.BANK_NAME,
    accountName: env.BANK_ACCOUNT_NAME,
    accountNo: env.BANK_ACCOUNT_NO,
  };
}

export interface RailPayload {
  qrPayload?: string;
  accountDetails?: AccountDetails;
}

/**
 * Build the per-rail presentational payload for an order. The tag-29 targets the
 * merchant PromptPay number (never the buyer's phone), tag-30 rides the order_no.
 */
export function buildRailPayload(
  env: Env,
  order: { orderNo: string; totalSatang: number },
  rail: Rail,
): RailPayload {
  if (rail === 'promptpay_billpay' && env.BILLER_COMP_CODE) {
    return {
      qrPayload: buildBillPaymentQr({ ref1: order.orderNo, amountSatang: order.totalSatang }),
    };
  }
  if (rail === 'promptpay_ewallet') {
    const target = env.PROMPTPAY_NUMBER;
    if (!target) return {};
    return {
      qrPayload: buildTransferProxyQr({
        targetType: 'phone',
        target,
        amountSatang: order.totalSatang,
      }),
    };
  }
  if (rail === 'bank_transfer') {
    return { accountDetails: accountDetails(env) ?? undefined };
  }
  return {};
}

export interface InitiateResult {
  paymentId: string;
  orderId: string;
  rail: Rail;
  amountSatang: number;
  status: string;
  qrPayload?: string;
  accountDetails?: AccountDetails;
}

/**
 * Create a pending payment for an order and return it together with the rail
 * payload (QR or transfer account details) the buyer should be shown. Shared by
 * the public /payments/initiate route and by checkout (which auto-selects the rail).
 */
export async function createPayment(
  c: Context,
  opts: { orderId: string; rail: Rail; amountSatang: number },
): Promise<InitiateResult> {
  const { orderId, rail, amountSatang } = opts;

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

  const env = getEnv();
  const payload = buildRailPayload(env, order, rail);

  await writeAuditLog(c, {
    action: 'payment.initiate',
    entityType: 'payment',
    entityId: payment.id,
    afterState: { orderId, rail, amountSatang },
  });

  return {
    paymentId: payment.id,
    orderId,
    rail,
    amountSatang,
    status: payment.status,
    ...payload,
  };
}
