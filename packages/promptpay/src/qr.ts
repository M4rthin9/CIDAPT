import { crc16CcittFalse } from './crc';
import { PromptPayError } from './crc';
import { tlv, type EmvField } from './tlv';

export const AID_TRANSFER = 'A000000677010111';
export const AID_BILL_PAYMENT = 'A000000677010112';

const MAX_AMOUNT_SATANG = 9_999_999_999;

export type ProxyType = 'phone' | 'citizenId';

export interface TransferProxyQrInput {
  readonly targetType: ProxyType;
  readonly target: string;
  readonly amountSatang?: number;
  readonly merchantName?: string;
  readonly city?: string;
}

export interface BillPaymentQrInput {
  readonly ref1: string;
  readonly ref2?: string;
  readonly amountSatang?: number;
  readonly merchantName?: string;
  readonly city?: string;
}

function assertAmount(amountSatang: number | undefined): void {
  if (amountSatang === undefined) return;
  if (!Number.isInteger(amountSatang) || amountSatang <= 0 || amountSatang > MAX_AMOUNT_SATANG) {
    throw new PromptPayError('pp_bad_amount', 'amount must be a positive integer satang');
  }
}

function commonFields(input: {
  amountSatang?: number;
  merchantName?: string;
  city?: string;
}): string {
  assertAmount(input.amountSatang);
  let s = tlv('53', '764');
  if (input.amountSatang !== undefined) {
    s += tlv('54', (input.amountSatang / 100).toFixed(2));
  }
  s += tlv('58', 'TH');
  if (input.merchantName !== undefined) {
    if (Buffer.byteLength(input.merchantName, 'utf8') > 25) {
      throw new PromptPayError('pp_name_too_long', 'merchantName exceeds 25 bytes');
    }
    s += tlv('59', input.merchantName);
  }
  if (input.city !== undefined) {
    if (Buffer.byteLength(input.city, 'utf8') > 15) {
      throw new PromptPayError('pp_city_too_long', 'city exceeds 15 bytes');
    }
    s += tlv('60', input.city);
  }
  return s;
}

function finalize(payload: string): string {
  return `${payload}6304${crc16CcittFalse(payload)}`;
}

export function normalizePhoneProxy(phone: string): string {
  const digits = phone.replace(/[+\s-]/gu, '');
  if (/^0\d{9}$/u.test(digits)) {
    return `0066${digits.slice(1)}`;
  }
  if (/^66\d{9}$/u.test(digits)) {
    return `00${digits}`;
  }
  throw new PromptPayError('pp_bad_phone', 'phone must be a Thai mobile number');
}

export function normalizeCitizenProxy(citizenId: string): string {
  const digits = citizenId.replace(/[\s-]/gu, '');
  if (!/^\d{13}$/u.test(digits)) {
    throw new PromptPayError('pp_bad_citizen_id', 'citizen id must be 13 digits');
  }
  return digits;
}

function pointOfInitiation(amountSatang: number | undefined): string {
  return amountSatang === undefined ? '010211' : '010212';
}

export function buildTransferProxyQr(input: TransferProxyQrInput): string {
  const proxy =
    input.targetType === 'phone'
      ? normalizePhoneProxy(input.target)
      : normalizeCitizenProxy(input.target);
  const account = tlv('00', AID_TRANSFER) + tlv('01', proxy);
  const payload =
    '000201' + pointOfInitiation(input.amountSatang) + tlv('29', account) + commonFields(input);
  return finalize(payload);
}

export function buildBillPaymentQr(input: BillPaymentQrInput): string {
  if (!/^[0-9A-Z-]{1,20}$/u.test(input.ref1)) {
    throw new PromptPayError('pp_bad_ref1', 'ref1 must be 1-20 chars of A-Z 0-9 or dash');
  }
  if (input.ref2 !== undefined && !/^[0-9A-Z-]{1,20}$/u.test(input.ref2)) {
    throw new PromptPayError('pp_bad_ref2', 'ref2 must be 1-20 chars of A-Z 0-9 or dash');
  }
  let biller = tlv('00', AID_BILL_PAYMENT) + tlv('01', input.ref1);
  if (input.ref2 !== undefined) {
    biller += tlv('02', input.ref2);
  }
  const payload =
    '000201' + pointOfInitiation(input.amountSatang) + tlv('30', biller) + commonFields(input);
  return finalize(payload);
}

export function findField(fields: readonly EmvField[], id: string): EmvField | undefined {
  return fields.find((f) => f.id === id);
}
