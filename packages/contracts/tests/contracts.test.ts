import { describe, expect, it } from 'vitest';
import {
  checkoutSchema,
  manualVerifySchema,
  productPublishSchema,
  productUpsertSchema,
  reconciliationEventSchema,
} from '../src';

const address = {
  addrLine1: '1 ถนนทดสอบ',
  subdistrict: 'แขวงทดสอบ',
  district: 'เขตทดสอบ',
  province: 'กรุงเทพมหานคร',
  postcode: '10000',
};

describe('checkoutSchema', () => {
  it('accepts a minimal valid checkout', () => {
    const res = checkoutSchema.safeParse({
      items: [{ productId: '0b8f6c0e-1111-4222-8333-444455556666', quantity: 2 }],
      contactName: 'ผู้ซื้อ',
      phone: '0812345678',
      shipping: address,
    });
    expect(res.success).toBe(true);
  });

  it('rejects a bad postcode and phone', () => {
    expect(
      checkoutSchema.safeParse({
        items: [{ productId: '0b8f6c0e-1111-4222-8333-444455556666', quantity: 1 }],
        contactName: 'x',
        phone: '12345',
        shipping: { ...address, postcode: '100000' },
      }).success,
    ).toBe(false);
  });

  it('rejects enquiry-style abuse via empty items', () => {
    expect(
      checkoutSchema.safeParse({
        items: [],
        contactName: 'x',
        phone: '0812345678',
        shipping: address,
      }).success,
    ).toBe(false);
  });
});

describe('publish completeness (non-negotiable #12)', () => {
  const base = {
    categoryId: '0b8f6c0e-1111-4222-8333-444455556666',
    sku: 'FG-001',
    lotCode: 'L-2401',
    purchaseMode: 'cart' as const,
    priceSatang: 125_000,
    materialTh: null,
    materialEn: null,
    finishNoteTh: null,
    finishNoteEn: null,
  };

  it('blocks publishing with only Thai filled in', () => {
    const res = productPublishSchema.safeParse({
      ...base,
      nameTh: 'ชื่อ',
      nameEn: '',
      bodyTh: 'เนื้อหา',
      bodyEn: null,
      status: 'published',
    });
    expect(res.success).toBe(false);
  });

  it('allows the same incomplete document as an upsert (draft)', () => {
    const res = productUpsertSchema.safeParse({
      ...base,
      nameTh: 'ชื่อ',
      nameEn: '',
      bodyTh: 'เนื้อหา',
      bodyEn: null,
    });
    expect(res.success).toBe(true);
  });
});

describe('manualVerifySchema (superadmin gate contract)', () => {
  it('requires a substantive reason', () => {
    expect(
      manualVerifySchema.safeParse({
        paymentId: '0b8f6c0e-1111-4222-8333-444455556666',
        reason: 'too short',
      }).success,
    ).toBe(false);
    expect(
      manualVerifySchema.safeParse({
        paymentId: '0b8f6c0e-1111-4222-8333-444455556666',
        reason: 'ธนาคารยืนยันโอนเงินเข้าบัญชีตามรายการ statement วันที่ 26/08/2026',
      }).success,
    ).toBe(true);
  });
});

describe('reconciliationEventSchema', () => {
  it('requires at least one matching key', () => {
    expect(
      reconciliationEventSchema.safeParse({
        rail: 'promptpay_billpay',
        amountSatang: 125_000,
        occurredAt: 1_756_200_000,
      }).success,
    ).toBe(false);
    expect(
      reconciliationEventSchema.safeParse({
        rail: 'promptpay_billpay',
        ref1: 'CIDA-2608-00001',
        amountSatang: 125_000,
        occurredAt: 1_756_200_000,
      }).success,
    ).toBe(true);
  });
});
