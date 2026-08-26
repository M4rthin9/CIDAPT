import { MoneyError } from './parse';

export function allocateSatang(totalSatang: number, weights: readonly number[]): number[] {
  if (!Number.isInteger(totalSatang) || totalSatang < 0) {
    throw new MoneyError('money_invalid_total', 'total must be a non-negative integer satang');
  }
  if (weights.length === 0) {
    throw new MoneyError('money_no_weights', 'at least one weight is required');
  }
  let weightSum = 0;
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) {
      throw new MoneyError('money_invalid_weight', 'weights must be finite and non-negative');
    }
    weightSum += w;
  }
  if (weightSum <= 0) {
    throw new MoneyError('money_no_weights', 'at least one positive weight is required');
  }

  const base: number[] = new Array(weights.length);
  const remainders: number[] = new Array(weights.length);
  let allocated = 0;
  for (let i = 0; i < weights.length; i++) {
    const exact = (totalSatang * (weights[i] as number)) / weightSum;
    const floor = Math.floor(exact);
    base[i] = floor;
    remainders[i] = exact - floor;
    allocated += floor;
  }

  let missing = totalSatang - allocated;
  const order = remainders.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; missing > 0; k++, missing--) {
    base[order[k % order.length]!.i]! += 1;
  }
  return base;
}
