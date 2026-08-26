import { describe, expect, it } from 'vitest';
import {
  MoneyError,
  allocateSatang,
  deriveVat,
  formatTHB,
  parseSatang,
  percentDiscountSatang,
} from '../src';

describe('parseSatang', () => {
  it.each([
    ['฿1,250.50', 125_050],
    ['1,250.50', 125_050],
    ['1250.5', 125_050],
    ['1250', 125_000],
    [1250.5, 125_050],
    ['-10.99', -1_099],
    ['฿ 99', 9_900],
  ])('parses %s -> %i', (input, expected) => {
    expect(parseSatang(input as string | number)).toBe(expected);
  });

  it('rejects more than two decimal places and garbage', () => {
    expect(() => parseSatang('1.999')).toThrow(MoneyError);
    expect(() => parseSatang('abc')).toThrow(MoneyError);
    expect(() => parseSatang(NaN)).toThrow(MoneyError);
  });
});

describe('formatTHB', () => {
  it.each([
    [125_050, '฿1,250.50'],
    [5, '฿0.05'],
    [-123_456_789, '-฿1,234,567.89'],
    [0, '฿0.00'],
  ])('formats %i -> %s', (input, expected) => {
    expect(formatTHB(input)).toBe(expected);
  });

  it('omits the symbol on request', () => {
    expect(formatTHB(125_050, { symbol: false })).toBe('1,250.50');
  });
});

describe('deriveVat (displayed prices are VAT-inclusive)', () => {
  it('derives a known split exactly', () => {
    const { netSatang, vatSatang } = deriveVat(125_000);
    expect(netSatang).toBe(116_822);
    expect(vatSatang).toBe(8_178);
  });

  it('always returns parts that sum to the inclusive total', () => {
    expect(deriveVat(1)).toMatchObject({ netSatang: 1, vatSatang: 0 });
    expect(deriveVat(99)).toMatchObject({ netSatang: 93, vatSatang: 6 });
  });
});

describe('percentDiscountSatang', () => {
  it('rounds half-up per line', () => {
    expect(percentDiscountSatang(9_999, 7)).toBe(700);
    expect(percentDiscountSatang(10_001, 7)).toBe(700);
    expect(percentDiscountSatang(25, 10)).toBe(3);
    expect(percentDiscountSatang(50_000, 100)).toBe(50_000);
  });
});

describe('allocateSatang (largest remainder)', () => {
  it('splits with no lost satang', () => {
    expect(allocateSatang(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateSatang(5, [2, 3])).toEqual([2, 3]);
    expect(allocateSatang(0, [4, 1])).toEqual([0, 0]);
  });

  it('breaks ties by index order', () => {
    expect(allocateSatang(1, [1, 1])).toEqual([1, 0]);
  });
});
