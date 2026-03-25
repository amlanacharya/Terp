import { describe, it, expect } from 'vitest';
import { toDb, fromDb } from './money';

describe('toDb', () => {
  it('converts rupees to integer paise', () => {
    expect(toDb(1234.5)).toBe(123450);
  });

  it('rounds values with more than 2 decimal places', () => {
    expect(toDb(18.333)).toBe(1833);
    expect(toDb(18.335)).toBe(1834);
  });

  it('handles zero', () => {
    expect(toDb(0)).toBe(0);
  });

  it('handles null and undefined gracefully', () => {
    expect(toDb(null)).toBe(0);
    expect(toDb(undefined)).toBe(0);
  });
});

describe('fromDb', () => {
  it('converts integer paise to rupees', () => {
    expect(fromDb(123450)).toBe(1234.5);
  });

  it('handles zero', () => {
    expect(fromDb(0)).toBe(0);
  });

  it('handles null and undefined gracefully', () => {
    expect(fromDb(null)).toBe(0);
    expect(fromDb(undefined)).toBe(0);
  });
});
