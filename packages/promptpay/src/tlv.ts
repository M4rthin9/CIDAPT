import { crc16CcittFalse } from './crc';
import { PromptPayError } from './crc';

export function tlv(id: string, value: string): string {
  if (!/^[0-9]{2}$/.test(id)) {
    throw new PromptPayError('emv_bad_id', `invalid EMV id: ${id}`);
  }
  const byteLength = Buffer.byteLength(value, 'utf8');
  if (byteLength > 99) {
    throw new PromptPayError('emv_value_too_long', `value for ${id} exceeds 99 bytes`);
  }
  return `${id}${String(byteLength).padStart(2, '0')}${value}`;
}

export interface EmvField {
  readonly id: string;
  readonly value: string;
  readonly children?: readonly EmvField[];
}

function parseLevel(buf: Buffer, start: number, end: number): EmvField[] {
  const fields: EmvField[] = [];
  let i = start;
  while (i + 4 <= end) {
    const id = buf.toString('latin1', i, i + 2);
    if (!/^[0-9]{2}$/.test(id)) {
      throw new PromptPayError('emv_parse_failed', `bad id at offset ${i}`);
    }
    const lenStr = buf.toString('latin1', i + 2, i + 4);
    if (!/^[0-9]{2}$/.test(lenStr)) {
      throw new PromptPayError('emv_parse_failed', `bad length at offset ${i}`);
    }
    const len = Number(lenStr);
    const valueStart = i + 4;
    const valueEnd = valueStart + len;
    if (valueEnd > end) {
      throw new PromptPayError('emv_parse_failed', `field ${id} overruns payload`);
    }
    fields.push({ id, value: buf.toString('utf8', valueStart, valueEnd) });
    i = valueEnd;
  }
  if (i !== end) {
    throw new PromptPayError('emv_parse_failed', 'trailing garbage in payload section');
  }
  return fields;
}

const TEMPLATE_IDS = new Set(Array.from({ length: 26 }, (_, k) => String(k + 26).padStart(2, '0')));

export interface ParsedEmvQr {
  readonly fields: readonly EmvField[];
  readonly crcValid: boolean;
  readonly crcExpected: string;
  readonly crcActual: string | null;
}

export function parseEmvQr(payload: string): ParsedEmvQr {
  const buf = Buffer.from(payload, 'utf8');
  const topLevel = parseLevel(buf, 0, buf.length);
  const crcField = topLevel.find((f) => f.id === '63');
  const crcActual = crcField?.value ?? null;
  let crcValid = false;
  let crcExpected = '';
  if (crcActual !== null) {
    const covered = payload.slice(0, payload.length - crcActual.length - 4);
    crcExpected = crc16CcittFalse(covered);
    crcValid = crcExpected === crcActual;
  }
  const withChildren = topLevel.map((f) => {
    if (!TEMPLATE_IDS.has(f.id)) return f;
    try {
      const inner = parseLevel(Buffer.from(f.value, 'utf8'), 0, Buffer.byteLength(f.value, 'utf8'));
      return { ...f, children: inner };
    } catch {
      return f;
    }
  });
  return { fields: withChildren, crcValid, crcExpected, crcActual };
}
