import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { allocateSatang, deriveVat, formatTHB, parseSatang } from '../src';

const satangArb = fc.integer({ min: 0, max: 1_000_000_000 });

const weightsArb = fc
  .array(fc.double({ min: 0.01, max: 10_000, noNaN: true }), { minLength: 1, maxLength: 25 })
  .map((w) => w);

describe('allocation invariants', () => {
  it('parts always sum to the total and stay within one satang of the ideal share', () => {
    fc.assert(
      fc.property(satangArb, weightsArb, (total, weights) => {
        const parts = allocateSatang(total, weights);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        const sumW = weights.reduce((a, b) => a + b, 0);
        for (let i = 0; i < parts.length; i++) {
          const ideal = (total * weights[i]!) / sumW;
          expect(parts[i]!).toBeGreaterThanOrEqual(Math.floor(ideal));
          expect(parts[i]!).toBeLessThanOrEqual(Math.ceil(ideal));
        }
      }),
      { numRuns: 500 },
    );
  }, 10_000);
});

describe('VAT invariants', () => {
  it('net + vat === inclusive total, both non-negative', () => {
    fc.assert(
      fc.property(satangArb, (total) => {
        const { netSatang, vatSatang } = deriveVat(total);
        expect(netSatang + vatSatang).toBe(total);
        expect(netSatang).toBeGreaterThanOrEqual(0);
        expect(vatSatang).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 2_000 },
    );
  });
});

describe('format/parse roundtrip', () => {
  it('parseSatang(formatTHB(x)) === x', () => {
    fc.assert(
      fc.property(fc.integer({ min: -900_000_000_000, max: 900_000_000_000 }), (value) => {
        expect(parseSatang(formatTHB(value))).toBe(value);
      }),
      { numRuns: 2_000 },
    );
  });
});
