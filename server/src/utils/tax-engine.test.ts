import { describe, it, expect } from 'vitest';
import { resolveInvoiceTaxScope, summarizeLegacyGstFields } from './tax-engine';
import type { TaxSnapshotLine } from './tax-engine';
import {
  LINES_INTRA_STATE_3000,
  LINES_INTER_STATE_3000,
  LINES_FLAT_AMOUNT,
  LINES_UNKNOWN_CODE,
  GSTIN_ODISHA_COMPANY,
  GSTIN_ODISHA_CUSTOMER,
  GSTIN_MAHARASHTRA_CUST,
  GSTIN_DELHI_CUST,
} from './tax-engine.fixtures';

// ---------------------------------------------------------------------------
// resolveInvoiceTaxScope
// ---------------------------------------------------------------------------
describe('resolveInvoiceTaxScope', () => {
  it('returns intra_state when company and customer are in the same state (Odisha 21/21)', () => {
    expect(resolveInvoiceTaxScope(GSTIN_ODISHA_COMPANY, GSTIN_ODISHA_CUSTOMER)).toBe('intra_state');
  });

  it('returns inter_state when customer is in a different state (Maharashtra 27)', () => {
    expect(resolveInvoiceTaxScope(GSTIN_ODISHA_COMPANY, GSTIN_MAHARASHTRA_CUST)).toBe('inter_state');
  });

  it('returns inter_state for Delhi (07) customer vs Odisha (21) company', () => {
    expect(resolveInvoiceTaxScope(GSTIN_ODISHA_COMPANY, GSTIN_DELHI_CUST)).toBe('inter_state');
  });

  it('returns intra_state when company GSTIN is null', () => {
    expect(resolveInvoiceTaxScope(null, GSTIN_ODISHA_CUSTOMER)).toBe('intra_state');
  });

  it('returns intra_state when customer GSTIN is null', () => {
    expect(resolveInvoiceTaxScope(GSTIN_ODISHA_COMPANY, null)).toBe('intra_state');
  });

  it('returns intra_state when both GSTINs are null', () => {
    expect(resolveInvoiceTaxScope(null, null)).toBe('intra_state');
  });

  it('returns intra_state when company GSTIN is empty string', () => {
    expect(resolveInvoiceTaxScope('', GSTIN_ODISHA_CUSTOMER)).toBe('intra_state');
  });

  it('returns intra_state when first 2 chars are the same but rest differs', () => {
    expect(resolveInvoiceTaxScope('21AAAAA1234A1ZA', '21BBBBB5678B1ZB')).toBe('intra_state');
  });
});

// ---------------------------------------------------------------------------
// summarizeLegacyGstFields
// ---------------------------------------------------------------------------
describe('summarizeLegacyGstFields', () => {
  it('returns all zeros for empty lines array', () => {
    const result = summarizeLegacyGstFields([]);
    expect(result.cgst_rate).toBe(0);
    expect(result.sgst_rate).toBe(0);
    expect(result.igst_rate).toBe(0);
    expect(result.cgst_amount).toBe(0);
    expect(result.sgst_amount).toBe(0);
    expect(result.igst_amount).toBe(0);
  });

  it('summarizes intra-state CGST + SGST lines correctly', () => {
    const result = summarizeLegacyGstFields(LINES_INTRA_STATE_3000);
    expect(result.cgst_rate).toBe(2.5);
    expect(result.cgst_amount).toBe(75);
    expect(result.sgst_rate).toBe(2.5);
    expect(result.sgst_amount).toBe(75);
    expect(result.igst_rate).toBe(0);
    expect(result.igst_amount).toBe(0);
  });

  it('summarizes inter-state IGST line correctly', () => {
    const result = summarizeLegacyGstFields(LINES_INTER_STATE_3000);
    expect(result.igst_rate).toBe(5);
    expect(result.igst_amount).toBe(150);
    expect(result.cgst_rate).toBe(0);
    expect(result.cgst_amount).toBe(0);
    expect(result.sgst_rate).toBe(0);
    expect(result.sgst_amount).toBe(0);
  });

  it('returns all zeros for flat-amount TOLL component (not a legacy GST code)', () => {
    const result = summarizeLegacyGstFields(LINES_FLAT_AMOUNT);
    expect(result.cgst_amount).toBe(0);
    expect(result.sgst_amount).toBe(0);
    expect(result.igst_amount).toBe(0);
  });

  it('returns all zeros for unknown component code (SERVICE)', () => {
    const result = summarizeLegacyGstFields(LINES_UNKNOWN_CODE);
    expect(result.cgst_amount).toBe(0);
    expect(result.sgst_amount).toBe(0);
    expect(result.igst_amount).toBe(0);
  });

  it('rounds cgst_amount to 2 decimal places when summing multiple CGST lines', () => {
    // 3000 * 2.5% = 75, 1000 * 2.5% = 25 but use fractional to force rounding
    // 1000 * 2.5% = 25.005 via tax_amount = 25.005 (force fractional)
    const lines: TaxSnapshotLine[] = [
      { tax_component_id: null, component_code: 'CGST', component_name: 'CGST',
        applies_to: 'intra_state', hsn_code: null, taxable_base: 3000,
        rate: 2.5, is_percentage: true, flat_amount: null, tax_amount: 75.004, sort_order: 10 },
      { tax_component_id: null, component_code: 'CGST', component_name: 'CGST',
        applies_to: 'intra_state', hsn_code: null, taxable_base: 500,
        rate: 2.5, is_percentage: true, flat_amount: null, tax_amount: 12.508, sort_order: 10 },
    ];
    const result = summarizeLegacyGstFields(lines);
    // 75.004 + 12.508 = 87.512 → rounds to 87.51
    expect(result.cgst_amount).toBe(87.51);
  });
});
