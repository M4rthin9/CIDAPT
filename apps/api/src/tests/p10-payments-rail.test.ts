import { describe, it, expect } from 'vitest';
import { selectPaymentRail, accountDetails, buildRailPayload } from '../lib/payments.js';
import type { Env } from '../config.js';

/**
 * P10 — backend-selected payment rail.
 *
 * The buyer never picks a rail; the backend resolves precedence and returns the
 * QR / account details to display. These pure functions are the money-critical
 * part and are unit-tested directly (no DB), including the regression that the
 * tag-29 transfer QR targets the merchant PromptPay number — never the buyer's
 * phone.
 */

function env(over: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'development',
    LOG_LEVEL: 'info',
    PORT: 3000,
    DATABASE_URL: 'postgres://x:x@localhost:5432/x',
    VALKEY_URL: 'redis://:x@localhost:6379',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'cida-media',
    S3_ACCESS_KEY: 'k',
    S3_SECRET_KEY: 's',
    S3_REGION: 'us-east-1',
    SESSION_SECRET: '01234567890123456789012345678901',
    SESSION_TTL_HOURS: 720,
    COOKIE_DOMAIN: 'localhost',
    COOKIE_SECURE: false,
    GOTENBERG_URL: 'http://localhost:3000',
    APP_URL: 'http://localhost',
    SITE_URL: 'http://localhost',
    RECONCILIATION_PROVIDER: 'fake',
    BILLER_COMP_CODE: '',
    PROMPTPAY_NUMBER: '',
    BANK_NAME: '',
    BANK_ACCOUNT_NAME: '',
    BANK_ACCOUNT_NO: '',
    ...over,
  };
}

const ORDER = { orderNo: 'CIDA-2608-00042', totalSatang: 125000 };

describe('selectPaymentRail — back-end precedence', () => {
  it('prefers Bill Payment (tag-30) when a biller comp code is set', () => {
    expect(selectPaymentRail(env({ BILLER_COMP_CODE: 'B123456789012345' }))).toBe(
      'promptpay_billpay',
    );
  });

  it('falls back to PromptPay transfer (tag-29) when only a merchant PromptPay number is set', () => {
    expect(selectPaymentRail(env({ PROMPTPAY_NUMBER: '0812345678' }))).toBe('promptpay_ewallet');
  });

  it('uses bank transfer when neither QR rail is configured', () => {
    expect(selectPaymentRail(env())).toBe('bank_transfer');
  });

  it('bill payment stays dominant even when a PromptPay number is also set', () => {
    expect(
      selectPaymentRail(
        env({ BILLER_COMP_CODE: 'B123456789012345', PROMPTPAY_NUMBER: '0812345678' }),
      ),
    ).toBe('promptpay_billpay');
  });
});

describe('accountDetails', () => {
  it('returns null when no bank details are set', () => {
    expect(accountDetails(env())).toBeNull();
  });

  it('returns the transfer details when configured', () => {
    const d = accountDetails(
      env({
        BANK_NAME: 'ธนาคารกรุงไทย',
        BANK_ACCOUNT_NAME: 'กองทัพเรือภาคที่ 1',
        BANK_ACCOUNT_NO: '1234567890',
      }),
    );
    expect(d).toEqual({
      bank: 'ธนาคารกรุงไทย',
      accountName: 'กองทัพเรือภาคที่ 1',
      accountNo: '1234567890',
    });
  });
});

describe('buildRailPayload', () => {
  it('bill payment yields a tag-30 QR whose ref1 is the order number', () => {
    const { qrPayload } = buildRailPayload(
      env({ BILLER_COMP_CODE: 'B123456789012345' }),
      ORDER,
      'promptpay_billpay',
    );
    expect(qrPayload).toBeTruthy();
    // QRCPSMP EMVCo; the biller account tag-30 embeds the Ref1 (order_no).
    expect(qrPayload).toContain(ORDER.orderNo.slice(0, 16));
  });

  it('PromptPay transfer targets the MERCHANT number, never the buyer phone (regression)', () => {
    const { qrPayload } = buildRailPayload(
      env({ PROMPTPAY_NUMBER: '0812345678' }),
      { ...ORDER, ...{} },
      'promptpay_ewallet',
    );
    expect(qrPayload).toBeTruthy();
    // normalizePhoneProxy('0812345678') -> '0066812345678'
    expect(qrPayload).toContain('0066812345678');
    // Even if the order phone differed, the merchant number wins.
    expect(qrPayload).not.toContain('0066987654321');
  });

  it('PromptPay transfer without a merchant number yields no QR', () => {
    expect(buildRailPayload(env(), ORDER, 'promptpay_ewallet').qrPayload).toBeUndefined();
  });

  it('bank transfer yields account details and no QR', () => {
    const envCfg = env({
      BANK_NAME: 'ธ.ไทยพาณิชย์',
      BANK_ACCOUNT_NAME: 'กองงานผลิตภัณฑ์',
      BANK_ACCOUNT_NO: '9990001112',
    });
    const payload = buildRailPayload(envCfg, ORDER, 'bank_transfer');
    expect(payload.qrPayload).toBeUndefined();
    expect(payload.accountDetails).toEqual({
      bank: 'ธ.ไทยพาณิชย์',
      accountName: 'กองงานผลิตภัณฑ์',
      accountNo: '9990001112',
    });
  });

  it('bank transfer with no configured account yields empty account details', () => {
    expect(buildRailPayload(env(), ORDER, 'bank_transfer').accountDetails).toBeUndefined();
  });
});
