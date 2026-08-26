import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildBillPaymentQr, buildTransferProxyQr, findField, parseEmvQr } from '../src';

const phoneArb = fc
  .integer({ min: 0, max: 999_999_999 })
  .map((n: number) => n.toString().padStart(9, '0'))
  .map((rest: string) => `0${rest}`);

const citizenArb = fc
  .bigInt({ min: 0n, max: 9999999999999n })
  .map((n: bigint) => n.toString().padStart(13, '0'));

const satangArb = fc.integer({ min: 1, max: 9_999_999_999 });

const REF_ALPHABET = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  '-',
] as const;

const refArb = fc
  .array(fc.constantFrom(...REF_ALPHABET), { minLength: 1, maxLength: 20 })
  .map((chars): string => chars.join(''));

describe('transfer QR properties', () => {
  it('every generated phone QR parses with a valid CRC', () => {
    fc.assert(
      fc.property(phoneArb, satangArb, fc.boolean(), (phone, amount, withAmount) => {
        const qr = buildTransferProxyQr({
          targetType: 'phone',
          target: phone,
          amountSatang: withAmount ? amount : undefined,
        });
        const parsed = parseEmvQr(qr);
        expect(parsed.crcValid).toBe(true);
        expect(findField(parsed.fields, '29')).toBeDefined();
      }),
      { numRuns: 500 },
    );
  });

  it('citizen-id proxies encode exactly 13 digits under sub-tag 01', () => {
    fc.assert(
      fc.property(citizenArb, (citizen) => {
        const qr = buildTransferProxyQr({ targetType: 'citizenId', target: citizen });
        const parsed = parseEmvQr(qr);
        const tag29 = findField(parsed.fields, '29');
        expect(tag29?.children?.find((c) => c.id === '01')?.value).toBe(citizen);
        expect(parsed.crcValid).toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});

describe('bill payment QR properties', () => {
  it('Ref1 always round-trips through parse', () => {
    fc.assert(
      fc.property(refArb, (ref1) => {
        const qr = buildBillPaymentQr({ ref1 });
        const parsed = parseEmvQr(qr);
        const tag30 = findField(parsed.fields, '30');
        expect(tag30?.children?.find((c) => c.id === '01')?.value).toBe(ref1);
        expect(parsed.crcValid).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('amounts render as fixed two-decimal baht in tag 54', () => {
    fc.assert(
      fc.property(satangArb, (amount) => {
        const qr = buildBillPaymentQr({ ref1: 'X', amountSatang: amount });
        expect(qr).toContain(
          `54${String((amount / 100).toFixed(2).length).padStart(2, '0')}${(amount / 100).toFixed(2)}`,
        );
      }),
      { numRuns: 300 },
    );
  });
});
