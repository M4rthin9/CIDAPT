import { describe, expect, it } from 'vitest';
import { crc16CcittFalse } from '../src';

describe('crc16CcittFalse', () => {
  it('matches the standard check value', () => {
    expect(crc16CcittFalse('123456789')).toBe('29B1');
  });

  it('returns the init value for the empty string', () => {
    expect(crc16CcittFalse('')).toBe('FFFF');
  });

  it('changes when a single character changes', () => {
    expect(crc16CcittFalse('abc')).not.toBe(crc16CcittFalse('abd'));
  });
});
