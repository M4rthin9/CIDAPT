import { describe, expect, it } from 'vitest';
import {
  PromptPayError,
  buildBillPaymentQr,
  buildTransferProxyQr,
  crc16CcittFalse,
  findField,
  normalizeCitizenProxy,
  normalizePhoneProxy,
  parseEmvQr,
} from '../src';

describe('buildTransferProxyQr (tag 29)', () => {
  it('produces the exact static payload for a phone proxy', () => {
    const prefix = '00020101021129370016A0000006770101110113006681234567853037645802TH';
    const expected = `${prefix}6304${crc16CcittFalse(prefix)}`;
    expect(buildTransferProxyQr({ targetType: 'phone', target: '0812345678' })).toBe(expected);
  });

  it('switches to dynamic point-of-initiation when an amount is present', () => {
    const qr = buildTransferProxyQr({
      targetType: 'phone',
      target: '0812345678',
      amountSatang: 125_050,
    });
    expect(qr.startsWith('000201010212')).toBe(true);
    expect(qr).toContain('54071250.50');
  });

  it('normalizes citizen ids and rejects malformed targets', () => {
    expect(normalizePhoneProxy('+66 8123-45678')).toBe('0066812345678');
    expect(normalizeCitizenProxy('1 2345 67890 123')).toBe('1234567890123');
    expect(() => buildTransferProxyQr({ targetType: 'citizenId', target: '12345' })).toThrow(
      PromptPayError,
    );
  });
});

describe('buildBillPaymentQr (tag 30)', () => {
  it('carries Ref1 = order_no in sub-tag 01 of template 30', () => {
    const qr = buildBillPaymentQr({
      ref1: 'CIDA-2608-00001',
      merchantName: 'CIDA Craft',
      city: 'Bangkok',
    });
    const parsed = parseEmvQr(qr);
    expect(parsed.crcValid).toBe(true);
    const tag30 = findField(parsed.fields, '30');
    expect(tag30).toBeDefined();
    const ref1 = tag30?.children?.find((c) => c.id === '01');
    expect(ref1?.value).toBe('CIDA-2608-00001');
    const aid = tag30?.children?.find((c) => c.id === '00');
    expect(aid?.value).toBe('A000000677010112');
  });

  it('supports Ref2 and amounts', () => {
    const qr = buildBillPaymentQr({
      ref1: 'CIDA-2608-00001',
      ref2: 'INV',
      amountSatang: 125_050,
    });
    const parsed = parseEmvQr(qr);
    const tag30 = findField(parsed.fields, '30');
    expect(tag30?.children?.find((c) => c.id === '02')?.value).toBe('INV');
    expect(qr).toContain('54071250.50');
    expect(parsed.crcValid).toBe(true);
  });

  it('rejects refs outside the BOT character set', () => {
    expect(() => buildBillPaymentQr({ ref1: 'has lower' })).toThrow(PromptPayError);
    expect(() => buildBillPaymentQr({ ref1: 'C'.repeat(21) })).toThrow(PromptPayError);
  });
});

describe('parseEmvQr validation', () => {
  it('flags a corrupted payload via CRC mismatch', () => {
    const qr = buildBillPaymentQr({ ref1: 'CIDA-2608-00002' });
    const mid = Math.floor(qr.length / 2);
    const flipped = qr.slice(0, mid) + (qr[mid] === '5' ? '6' : '5') + qr.slice(mid + 1);
    const parsed = parseEmvQr(flipped);
    expect(parsed.crcValid).toBe(false);
  });
});
