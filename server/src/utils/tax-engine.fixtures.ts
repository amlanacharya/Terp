import type { TaxSnapshotLine } from './tax-engine';

// Intra-state lines: CGST 2.5% + SGST 2.5% on Rs.3000
export const LINES_INTRA_STATE_3000: TaxSnapshotLine[] = [
  { tax_component_id: null, component_code: 'CGST', component_name: 'CGST',
    applies_to: 'intra_state', hsn_code: '9964', taxable_base: 3000,
    rate: 2.5, is_percentage: true, flat_amount: null, tax_amount: 75, sort_order: 10 },
  { tax_component_id: null, component_code: 'SGST', component_name: 'SGST',
    applies_to: 'intra_state', hsn_code: '9964', taxable_base: 3000,
    rate: 2.5, is_percentage: true, flat_amount: null, tax_amount: 75, sort_order: 20 },
];

// Inter-state line: IGST 5% on Rs.3000
export const LINES_INTER_STATE_3000: TaxSnapshotLine[] = [
  { tax_component_id: null, component_code: 'IGST', component_name: 'IGST',
    applies_to: 'inter_state', hsn_code: '9964', taxable_base: 3000,
    rate: 5, is_percentage: true, flat_amount: null, tax_amount: 150, sort_order: 10 },
];

// Flat-amount component (non-standard, edge case)
export const LINES_FLAT_AMOUNT: TaxSnapshotLine[] = [
  { tax_component_id: 'comp-1', component_code: 'TOLL', component_name: 'Toll',
    applies_to: 'all', hsn_code: null, taxable_base: 2000,
    rate: null, is_percentage: false, flat_amount: 50, tax_amount: 50, sort_order: 30 },
];

// Unknown component codes — should not affect legacy summary
export const LINES_UNKNOWN_CODE: TaxSnapshotLine[] = [
  { tax_component_id: null, component_code: 'SERVICE', component_name: 'Service',
    applies_to: 'intra_state', hsn_code: null, taxable_base: 1000,
    rate: 10, is_percentage: true, flat_amount: null, tax_amount: 100, sort_order: 10 },
];

export const GSTIN_ODISHA_COMPANY   = '21AABCT1332L1ZN';
export const GSTIN_ODISHA_CUSTOMER  = '21AABCU9603R1ZP';
export const GSTIN_MAHARASHTRA_CUST = '27AADCS0472N1ZO';
export const GSTIN_DELHI_CUST       = '07AAAPG4584M1ZL';
