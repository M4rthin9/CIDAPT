import { MoneyError } from './parse';

export const VAT_RATE = 0.07;

export interface VatSplit {
  readonly netSatang: number;
  readonly vatSatang: number;
}

export function deriveVat(totalInclusiveSatang: number, rate = VAT_RATE): VatSplit {
  if (!Number.isInteger(totalInclusiveSatang) || totalInclusiveSatang < 0) {
    throw new MoneyError('money_invalid_total', 'total must be a non-negative integer satang');
  }
  const netSatang = Math.round(totalInclusiveSatang / (1 + rate));
  return { netSatang, vatSatang: totalInclusiveSatang - netSatang };
}

export function percentDiscountSatang(totalSatang: number, percent: number): number {
  if (!Number.isInteger(totalSatang) || totalSatang < 0) {
    throw new MoneyError('money_invalid_total', 'total must be a non-negative integer satang');
  }
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new MoneyError('money_invalid_percent', 'percent must be an integer between 0 and 100');
  }
  return Math.round((totalSatang * percent) / 100);
}
