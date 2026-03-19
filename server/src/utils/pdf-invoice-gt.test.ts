import { describe, expect, it } from 'vitest';
import { buildGtInvoicePdf, buildGtInvoiceWithAnnexuresPdf, numberToWords } from './pdf-invoice-gt';

function countPages(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
}

const settings = {
  company_name: 'Gayatri Travels',
  company_address: 'Janpath, Bhubaneswar',
  bank_name: 'HDFC Bank',
  bank_account: '1234567890',
  bank_ifsc: 'HDFC0001234',
};

const invoiceData = {
  invoice_type: 'invoice' as const,
  invoice_number: 'GTINV-TST-001',
  invoice_date: '2026-03-18',
  booking_date: '2026-03-17',
  duty_type_label: 'Outstation',
  nature_of_journey: 'Grouped annexure billing',
  vehicle_number: 'OD02AB1234',
  vehicle_type_label: 'CRYSTA',
  duty_slip_number: 'GT-TRP-2001',
  total_km: 250,
  total_hours: 7,
  payment_terms_days: 21,
  interest_note: 'Interest @ 18% after 21 days.',
  subtotal: 6000,
  cgst_amount: 150,
  sgst_amount: 150,
  igst_amount: 0,
  total_amount: 6300,
  customer_name: 'MCL Mining Division',
  billing_address: 'MCL Area Office, Sambalpur',
  customer_gstin: '21AACCM4400K1Z7',
  remarks: 'Grouped annexure billing demo.',
  tax_components: [
    { component_name: 'CGST', tax_amount: 150 },
    { component_name: 'SGST', tax_amount: 150 },
  ],
  items: [
    {
      description: 'Annexure ANN-02 - 09 Mar 2026',
      amount: 3360,
      cgst_amount: 84,
      sgst_amount: 84,
      igst_amount: 0,
      total_amount: 3528,
      annexure_number: 'ANN-02',
      start_date: '2026-03-09',
      end_date: '2026-03-09',
    },
    {
      description: 'Annexure ANN-03 - 10 Mar 2026',
      amount: 2640,
      cgst_amount: 66,
      sgst_amount: 66,
      igst_amount: 0,
      total_amount: 2772,
      annexure_number: 'ANN-03',
      start_date: '2026-03-10',
      end_date: '2026-03-10',
    },
  ],
};

const annexures = [
  {
    annexure_number: 'ANN-02',
    duty_slip_number: 'GT-TRP-2001',
    customer_name: 'MCL Mining Division',
    vehicle_number: 'OD02AB1234',
    vehicle_type_label: 'CRYSTA',
    vehicle_category_name: 'CRYSTA',
    start_date: '2026-03-09',
    end_date: '2026-03-09',
    start_km: 70120,
    end_km: 70260,
    total_km: 140,
    total_hours: 4,
    night_halts: 0,
    calculated_amount: 3360,
    is_billed: true,
    invoice_number: 'GTINV-TST-001',
  },
  {
    annexure_number: 'ANN-03',
    duty_slip_number: 'GT-TRP-2001',
    customer_name: 'MCL Mining Division',
    vehicle_number: 'OD02AB1234',
    vehicle_type_label: 'CRYSTA',
    vehicle_category_name: 'CRYSTA',
    start_date: '2026-03-10',
    end_date: '2026-03-10',
    start_km: 70260,
    end_km: 70370,
    total_km: 110,
    total_hours: 3,
    night_halts: 0,
    calculated_amount: 2640,
    is_billed: true,
    invoice_number: 'GTINV-TST-001',
  },
];

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

describe('GT invoice PDF builders', () => {
  it('buildGtInvoicePdf renders only the invoice pages', async () => {
    const invoiceOnly = await buildGtInvoicePdf(invoiceData, settings);

    expect(countPages(invoiceOnly)).toBeGreaterThan(0);
    expect(countPages(invoiceOnly)).toBe(2);
  });

  it('buildGtInvoiceWithAnnexuresPdf adds one page per appended annexure to the invoice PDF', async () => {
    const invoiceOnly = await buildGtInvoicePdf(invoiceData, settings);
    const combined = await buildGtInvoiceWithAnnexuresPdf(invoiceData, annexures, settings);

    expect(countPages(invoiceOnly)).toBeGreaterThan(0);
    expect(countPages(combined)).toBe(countPages(invoiceOnly) + annexures.length);
  });
});
