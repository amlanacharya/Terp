import { describe, it, expect } from 'vitest';
import { isInterState, formatDutyTypeLabel, buildInterestNote } from './invoice-gt';
import { getDateDiffInDays, deriveNightHalts } from './annexure-builder';
import { calculateGst } from './gst';
import {
  GSTIN_ODISHA_COMPANY,
  GSTIN_ODISHA_CUSTOMER,
  GSTIN_MAHARASHTRA_CUST,
  GSTIN_DELHI_CUST,
  GSTIN_KARNATAKA_CUST,
  METRICS_SINGLE_DAY,
  METRICS_TWO_NIGHT,
  METRICS_LAST_OPEN,
} from './invoice-gt.fixtures';

// ---------------------------------------------------------------------------
// isInterState — GSTIN state-code comparison
// ---------------------------------------------------------------------------
describe('isInterState — GSTIN state-code comparison', () => {
  it('returns false when company and customer are in the same state (Odisha 21)', () => {
    expect(isInterState(GSTIN_ODISHA_COMPANY, GSTIN_ODISHA_CUSTOMER)).toBe(false);
  });

  it('returns true when customer is in a different state (Maharashtra 27)', () => {
    expect(isInterState(GSTIN_ODISHA_COMPANY, GSTIN_MAHARASHTRA_CUST)).toBe(true);
  });

  it('returns true for Delhi (07) customer vs Odisha (21) company', () => {
    expect(isInterState(GSTIN_ODISHA_COMPANY, GSTIN_DELHI_CUST)).toBe(true);
  });

  it('returns true for Karnataka (29) customer vs Odisha (21) company', () => {
    expect(isInterState(GSTIN_ODISHA_COMPANY, GSTIN_KARNATAKA_CUST)).toBe(true);
  });

  it('returns false when customer GSTIN is null (defaults to intra-state)', () => {
    expect(isInterState(GSTIN_ODISHA_COMPANY, null)).toBe(false);
  });

  it('returns false when company GSTIN is undefined (defaults to intra-state)', () => {
    expect(isInterState(undefined, GSTIN_ODISHA_CUSTOMER)).toBe(false);
  });

  it('returns false when both GSTINs are null', () => {
    expect(isInterState(undefined, null)).toBe(false);
  });

  it('returns false when first 2 chars match even if rest differs', () => {
    expect(isInterState('21AAAAA0000A1Z1', '21BBBBB9999B1Z9')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatDutyTypeLabel — duty type to display label
// ---------------------------------------------------------------------------
describe('formatDutyTypeLabel — duty type to display label', () => {
  it('formats "local" as "Local"', () => {
    expect(formatDutyTypeLabel('local')).toBe('Local');
  });

  it('formats "outstation" as "Outstation"', () => {
    expect(formatDutyTypeLabel('outstation')).toBe('Outstation');
  });

  it('formats "drop_pickup" as "Drop Pickup"', () => {
    expect(formatDutyTypeLabel('drop_pickup')).toBe('Drop Pickup');
  });

  it('formats "station_drop" as "Station Drop"', () => {
    expect(formatDutyTypeLabel('station_drop')).toBe('Station Drop');
  });

  it('formats "long" as "Long"', () => {
    expect(formatDutyTypeLabel('long')).toBe('Long');
  });

  it('returns null for null input', () => {
    expect(formatDutyTypeLabel(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatDutyTypeLabel('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildInterestNote — payment terms to interest note text
// ---------------------------------------------------------------------------
describe('buildInterestNote — payment terms to interest note text', () => {
  it('generates correct note for 30-day payment terms', () => {
    expect(buildInterestNote(30)).toBe(
      'Interest @ 18% p.a. applies after 30 day(s) from invoice date.'
    );
  });

  it('generates correct note for 1-day payment terms', () => {
    expect(buildInterestNote(1)).toBe(
      'Interest @ 18% p.a. applies after 1 day(s) from invoice date.'
    );
  });

  it('generates a note even for 0-day terms', () => {
    expect(buildInterestNote(0)).toBe(
      'Interest @ 18% p.a. applies after 0 day(s) from invoice date.'
    );
  });

  it('returns null when payment terms are null (no credit period)', () => {
    expect(buildInterestNote(null)).toBeNull();
  });

  it('returns null when payment terms are undefined', () => {
    expect(buildInterestNote(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getDateDiffInDays — calendar day difference for night-halt derivation
// ---------------------------------------------------------------------------
describe('getDateDiffInDays — calendar day difference', () => {
  it('returns 0 for same-day start and end', () => {
    expect(getDateDiffInDays('2025-06-01', '2025-06-01')).toBe(0);
  });

  it('returns 2 for a 2-night outstation (Jun 1 → Jun 3)', () => {
    expect(getDateDiffInDays('2025-06-01', '2025-06-03')).toBe(2);
  });

  it('returns 0 when end date is before start date (floor at 0)', () => {
    expect(getDateDiffInDays('2025-06-05', '2025-06-01')).toBe(0);
  });

  it('handles month boundary correctly (May 30 → Jun 2 = 3 days)', () => {
    expect(getDateDiffInDays('2025-05-30', '2025-06-02')).toBe(3);
  });

  it('handles year boundary correctly (Dec 30 → Jan 2 = 3 days)', () => {
    expect(getDateDiffInDays('2025-12-30', '2026-01-02')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// deriveNightHalts — night halts from trip metric date span
// ---------------------------------------------------------------------------
describe('deriveNightHalts — night halts derived from metric date span', () => {
  it('returns 0 for empty metrics array', () => {
    expect(deriveNightHalts([])).toBe(0);
  });

  it('returns 0 for a single-day local trip (same start and end date)', () => {
    // METRICS_SINGLE_DAY: 2025-06-01 → 2025-06-01
    expect(deriveNightHalts(METRICS_SINGLE_DAY)).toBe(0);
  });

  it('returns 2 for a 2-night outstation trip (Jun 1 → Jun 3)', () => {
    // METRICS_TWO_NIGHT: seq1 starts 2025-06-01, seq2 ends 2025-06-03
    expect(deriveNightHalts(METRICS_TWO_NIGHT)).toBe(2);
  });

  it('falls back to last start_date when last metric has no end_date', () => {
    // METRICS_LAST_OPEN: seq1 ends 2025-06-01, seq2 starts 2025-06-01 (open)
    // lastDate = seq2.start_date = '2025-06-01' → 0 nights from first 2025-06-01
    expect(deriveNightHalts(METRICS_LAST_OPEN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateGst — GT invoice tax scenarios
// ---------------------------------------------------------------------------
describe('calculateGst — GT invoice tax scenarios', () => {
  it('applies CGST + SGST for intra-state invoice (no IGST)', () => {
    // RBI Odisha customer — standard 2.5%/2.5% rates
    const result = calculateGst({ subtotal: 3000, isInterState: false, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 });

    expect(result.cgst_amount).toBe(75);   // 3000 × 2.5%
    expect(result.sgst_amount).toBe(75);   // 3000 × 2.5%
    expect(result.igst_amount).toBe(0);
    expect(result.total_amount).toBe(3150);
  });

  it('applies IGST only for inter-state invoice (no CGST/SGST)', () => {
    // Out-of-state customer
    const result = calculateGst({ subtotal: 3000, isInterState: true, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 });

    expect(result.cgst_amount).toBe(0);
    expect(result.sgst_amount).toBe(0);
    expect(result.igst_amount).toBe(150);  // 3000 × 5%
    expect(result.total_amount).toBe(3150);
  });

  it('calculates correct per-item tax for grouped annexure invoice (two items, intra-state)', () => {
    // Annexure 1: Rs.2000, Annexure 2: Rs.1500
    const item1 = calculateGst({ subtotal: 2000, isInterState: false, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 });
    const item2 = calculateGst({ subtotal: 1500, isInterState: false, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 });

    const totalCgst = item1.cgst_amount + item2.cgst_amount;
    const totalSgst = item1.sgst_amount + item2.sgst_amount;
    const grandTotal = item1.total_amount + item2.total_amount;

    expect(totalCgst).toBe(87.5);   // (2000+1500) × 2.5%
    expect(totalSgst).toBe(87.5);
    expect(grandTotal).toBe(3675);  // 3500 + 175
  });

  it('returns zero tax amounts for a zero-amount item', () => {
    const result = calculateGst({ subtotal: 0, isInterState: false, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 });

    expect(result.cgst_amount).toBe(0);
    expect(result.sgst_amount).toBe(0);
    expect(result.igst_amount).toBe(0);
    expect(result.total_amount).toBe(0);
  });

  it('rounds tax amounts to 2 decimal places', () => {
    // Rs.3000.50 × 2.5% = 75.0125 → rounds to 75.01
    const result = calculateGst({ subtotal: 3000.50, isInterState: false, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 });

    expect(result.cgst_amount).toBe(75.01);
    expect(result.sgst_amount).toBe(75.01);
    expect(result.total_amount).toBeCloseTo(3150.52, 2);
  });
});
