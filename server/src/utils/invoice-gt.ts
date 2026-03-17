import { calculateGst } from './gst';
import { Queryable } from './rate-engine';

export interface GtInvoiceSettings {
  invoice_prefix: string;
  company_gstin: string;
  company_name: string;
  company_address: string;
  company_pan: string;
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
}

export interface GtInvoiceHeaderInput {
  customer_id: string;
  billing_address: string | null;
  customer_gstin: string | null;
  invoice_date: string;
  booking_date: string | null;
  duty_type_label: string | null;
  nature_of_journey: string | null;
  vehicle_number: string | null;
  vehicle_type_label: string | null;
  duty_slip_number: string | null;
  total_km: number | null;
  total_hours: number | null;
  payment_terms_days: number | null;
  interest_note: string | null;
  remarks: string | null;
  created_by: string | null;
}

export interface GtInvoiceItemInput {
  trip_id: string | null;
  annexure_id?: string | null;
  description: string;
  amount: number;
}

export interface CreatedGtInvoice {
  id: string;
  invoice_number: string;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

interface GstRateRow {
  hsn_code: string;
  cgst_rate: string;
  sgst_rate: string;
  igst_rate: string;
}

function toNumber(value: number | string | null | undefined): number {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(dateOnly: string, days: number | null): string | null {
  if (!dateOnly || days == null) {
    return null;
  }

  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function isInterState(companyGstin: string | undefined, customerGstin: string | null): boolean {
  if (!companyGstin || !customerGstin) {
    return false;
  }

  return companyGstin.slice(0, 2) !== customerGstin.slice(0, 2);
}

export function formatDutyTypeLabel(dutyType: string | null | undefined): string | null {
  if (!dutyType) {
    return null;
  }

  return dutyType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildInterestNote(paymentTermsDays: number | null | undefined): string | null {
  if (paymentTermsDays == null) {
    return null;
  }

  return `Interest @ 18% p.a. applies after ${paymentTermsDays} day(s) from invoice date.`;
}

export async function getGtInvoiceSettings(db: Queryable): Promise<GtInvoiceSettings> {
  const result = await db.query<{ setting_key: string; setting_value: string }>(
    `
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key = ANY($1)
    `,
    [[
      'invoice_prefix',
      'company_gstin',
      'company_name',
      'company_address',
      'company_pan',
      'bank_name',
      'bank_account',
      'bank_ifsc',
    ]]
  );

  const settings = Object.fromEntries(result.rows.map((row) => [row.setting_key, row.setting_value]));

  return {
    invoice_prefix: settings.invoice_prefix || 'INV',
    company_gstin: settings.company_gstin || '',
    company_name: settings.company_name || 'Travel ERP',
    company_address: settings.company_address || '',
    company_pan: settings.company_pan || '',
    bank_name: settings.bank_name || '',
    bank_account: settings.bank_account || '',
    bank_ifsc: settings.bank_ifsc || '',
  };
}

async function getActiveGstRate(db: Queryable): Promise<GstRateRow> {
  const result = await db.query<GstRateRow>(
    `
      SELECT hsn_code, cgst_rate::text, sgst_rate::text, igst_rate::text
      FROM gst_rates
      WHERE is_active = true
      ORDER BY CASE WHEN hsn_code = '9964' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 1
    `
  );

  return result.rows[0] ?? {
    hsn_code: '9964',
    cgst_rate: '2.5',
    sgst_rate: '2.5',
    igst_rate: '5',
  };
}

async function generateInvoiceNumber(db: Queryable, prefix: string): Promise<string> {
  const result = await db.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM invoices WHERE invoice_number LIKE $1',
    [`${prefix}-%`]
  );

  return `${prefix}-${String(Number(result.rows[0]?.count || 0) + 1).padStart(5, '0')}`;
}

export async function createGtInvoice(
  db: Queryable,
  header: GtInvoiceHeaderInput,
  items: GtInvoiceItemInput[]
): Promise<CreatedGtInvoice> {
  if (items.length === 0) {
    throw new Error('At least one invoice item is required.');
  }

  const [settings, gstRate] = await Promise.all([getGtInvoiceSettings(db), getActiveGstRate(db)]);
  const invoiceNumber = await generateInvoiceNumber(db, settings.invoice_prefix);
  const isInvoiceInterState = isInterState(settings.company_gstin, header.customer_gstin);

  const normalizedItems = items.map((item) => {
    const amount = roundCurrency(toNumber(item.amount));
    const gst = calculateGst({
      subtotal: amount,
      isInterState: isInvoiceInterState,
      cgstRate: Number(gstRate.cgst_rate),
      sgstRate: Number(gstRate.sgst_rate),
      igstRate: Number(gstRate.igst_rate),
    });

    return {
      ...item,
      amount,
      gst,
    };
  });

  const subtotal = roundCurrency(normalizedItems.reduce((sum, item) => sum + item.amount, 0));
  const cgstAmount = roundCurrency(normalizedItems.reduce((sum, item) => sum + item.gst.cgst_amount, 0));
  const sgstAmount = roundCurrency(normalizedItems.reduce((sum, item) => sum + item.gst.sgst_amount, 0));
  const igstAmount = roundCurrency(normalizedItems.reduce((sum, item) => sum + item.gst.igst_amount, 0));
  const totalAmount = roundCurrency(normalizedItems.reduce((sum, item) => sum + item.gst.total_amount, 0));
  const paymentTermsDays = header.payment_terms_days ?? null;
  const dueDate = addDays(header.invoice_date, paymentTermsDays);
  const interestNote = header.interest_note ?? buildInterestNote(paymentTermsDays);

  const invoiceResult = await db.query<{ id: string }>(
    `
      INSERT INTO invoices (
        invoice_number, invoice_date, customer_id, billing_address, customer_gstin,
        booking_date, duty_type_label, nature_of_journey, vehicle_number, vehicle_type_label,
        duty_slip_number, total_km, total_hours, payment_terms_days, interest_note,
        subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
        payment_status, due_date, remarks, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24
      )
      RETURNING id
    `,
    [
      invoiceNumber,
      header.invoice_date,
      header.customer_id,
      header.billing_address,
      header.customer_gstin,
      header.booking_date,
      header.duty_type_label,
      header.nature_of_journey,
      header.vehicle_number,
      header.vehicle_type_label,
      header.duty_slip_number,
      header.total_km,
      header.total_hours,
      paymentTermsDays,
      interestNote,
      subtotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
      'pending',
      dueDate,
      header.remarks,
      header.created_by,
    ]
  );

  const invoiceId = invoiceResult.rows[0].id;

  for (const item of normalizedItems) {
    await db.query(
      `
        INSERT INTO invoice_items (
          invoice_id, trip_id, annexure_id, description, hsn_code, quantity, rate, amount,
          cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15
        )
      `,
      [
        invoiceId,
        item.trip_id,
        item.annexure_id ?? null,
        item.description,
        gstRate.hsn_code,
        1,
        item.amount,
        item.amount,
        Number(gstRate.cgst_rate),
        Number(gstRate.sgst_rate),
        Number(gstRate.igst_rate),
        item.gst.cgst_amount,
        item.gst.sgst_amount,
        item.gst.igst_amount,
        item.gst.total_amount,
      ]
    );
  }

  return {
    id: invoiceId,
    invoice_number: invoiceNumber,
    subtotal,
    cgst_amount: cgstAmount,
    sgst_amount: sgstAmount,
    igst_amount: igstAmount,
    total_amount: totalAmount,
  };
}
