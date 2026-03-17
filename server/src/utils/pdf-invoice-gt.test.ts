import { describe, it, expect } from 'vitest';
import { numberToWords } from './pdf-invoice-gt';

// ---------------------------------------------------------------------------
// numberToWords
// ---------------------------------------------------------------------------
describe('numberToWords', () => {
  it('returns Zero Rupees Only for 0', () => {
    expect(numberToWords(0)).toBe('Zero Rupees Only');
  });

  it('returns One Rupees Only for 1', () => {
    expect(numberToWords(1)).toBe('One Rupees Only');
  });

  it('returns Two Rupees Only for 2', () => {
    expect(numberToWords(2)).toBe('Two Rupees Only');
  });

  it('returns Five Hundred Rupees Only for 500', () => {
    expect(numberToWords(500)).toBe('Five Hundred Rupees Only');
  });

  it('returns Three Thousand Rupees Only for 3000', () => {
    expect(numberToWords(3000)).toBe('Three Thousand Rupees Only');
  });

  it('returns One Lakh Rupees Only for 100000', () => {
    expect(numberToWords(100000)).toBe('One Lakh Rupees Only');
  });

  it('returns One Crore Rupees Only for 10000000', () => {
    expect(numberToWords(10000000)).toBe('One Crore Rupees Only');
  });

  it('returns Zero Rupees and Fifty Paise Only for 0.50', () => {
    expect(numberToWords(0.50)).toBe('Zero Rupees and Fifty Paise Only');
  });

  it('returns correct words for mixed rupees and paise (1500.25)', () => {
    expect(numberToWords(1500.25)).toBe('One Thousand Five Hundred Rupees and Twenty Five Paise Only');
  });

  it('returns correct words for a large GT-realistic amount (45750)', () => {
    expect(numberToWords(45750)).toBe('Forty Five Thousand Seven Hundred Fifty Rupees Only');
  });
});
