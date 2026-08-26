export class MoneyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MoneyError';
    this.code = code;
  }
}

const MAX_SAFE_SATANG = Number.MAX_SAFE_INTEGER;

function assertSafeSatang(satang: number): void {
  if (!Number.isInteger(satang)) {
    throw new MoneyError('money_not_integer', 'satang value must be an integer');
  }
  if (Math.abs(satang) > MAX_SAFE_SATANG) {
    throw new MoneyError('money_overflow', 'satang value exceeds safe integer range');
  }
}

export function satang(baht: number): number {
  if (!Number.isFinite(baht)) {
    throw new MoneyError('money_not_finite', 'baht amount must be finite');
  }
  const s = Math.round(baht * 100);
  assertSafeSatang(s);
  return s;
}

export function parseSatang(input: string | number): number {
  if (typeof input === 'number') {
    return satang(input);
  }
  const cleaned = input.replace(/[,\s฿]/gu, '');
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/u.exec(cleaned);
  if (m === null) {
    throw new MoneyError('money_parse_failed', `unparseable THB amount: ${input}`);
  }
  const sign = m[1] === undefined ? 1 : -1;
  const bahtPart = m[2] ?? '0';
  const satangPart = (m[3] ?? '').padEnd(2, '0');
  const value = sign * (Number(bahtPart) * 100 + Number(satangPart));
  assertSafeSatang(value);
  return value;
}

export function formatTHB(satangValue: number, opts: { symbol?: boolean } = {}): string {
  assertSafeSatang(satangValue);
  const symbol = opts.symbol === false ? '' : '฿';
  const negative = satangValue < 0;
  const abs = Math.abs(satangValue);
  const baht = Math.trunc(abs / 100).toString();
  const grouped = baht.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  const ss = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${symbol}${grouped}.${ss}`;
}

export { assertSafeSatang };
