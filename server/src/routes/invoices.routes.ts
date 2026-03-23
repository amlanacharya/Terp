import { QueryResultRow } from 'pg';
import { Router } from 'express';
import pool, { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { buildInterestNote, generateCreditNoteNumber, getGtInvoiceSettings } from '../utils/invoice-gt';
import { AnnexurePdfData } from '../utils/pdf-annexure';
import { buildGtInvoicePdf, buildGtInvoiceWithAnnexuresPdf } from '../utils/pdf-invoice-gt';
import { buildInvoicePdf } from '../utils/pdf-invoice';
import { formatLedgerAmount, writeLedgerEntry } from '../utils/ledger';
import { Queryable } from '../utils/rate-engine';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';
import { calculateInvoiceTaxes, persistInvoiceTaxSnapshots } from '../utils/tax-engine';

const router = Router();
const invoiceFields = [
  'invoice_number',
  'invoice_date',
  'customer_id',
  'billing_address',
  'customer_gstin',
  'booking_date',
  'duty_type_label',
  'nature_of_journey',
  'vehicle_number',
  'vehicle_type_label',
  'duty_slip_number',
  'total_km',
  'total_hours',
  'payment_terms_days',
  'interest_note',
  'subtotal',
  'cgst_amount',
  'sgst_amount',
  'igst_amount',
  'total_amount',
  'payment_status',
  'due_date',
  'remarks',
] as const;

interface InvoiceListRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  booking_date: string | null;
  duty_type_label: string | null;
  nature_of_journey: string | null;
  vehicle_number: string | null;
  vehicle_type_label: string | null;
  duty_slip_number: string | null;
  total_km: number | string | null;
  total_hours: number | string | null;
  payment_terms_days: number | null;
  interest_note: string | null;
  subtotal: number | string;
  cgst_amount: number | string;
  sgst_amount: number | string;
  igst_amount: number | string;
  total_amount: number | string;
  collected_amount: string;
  payment_status: string;
  due_date: string | null;
  remarks: string | null;
  invoice_type: 'invoice' | 'credit_note';
  reference_invoice_id: string | null;
  invoice_status: 'active' | 'void' | 'written_off';
  void_reason: string | null;
  voided_at: string | null;
  voided_by: string | null;
  source_type: 'manual' | 'trip' | 'annexures';
  item_count: string;
  annexure_item_count: string;
  customer: {
    id: string;
    name: string;
    customer_code: string;
  };
}

interface InvoiceTaxComponentRow {
  id: string;
  invoice_id: string;
  component_code: string;
  component_name: string;
  applies_to: string;
  hsn_code: string | null;
  taxable_base: string;
  rate: string | null;
  is_percentage: boolean;
  flat_amount: string | null;
  tax_amount: string;
  sort_order: number;
  created_at: string;
}

interface InvoiceItemTaxComponentRow extends InvoiceTaxComponentRow {
  invoice_item_id: string;
}

interface FinancialLedgerRow extends QueryResultRow {
  id: string;
  event_type: string;
  invoice_id: string;
  invoice_number: string;
  collection_id: string | null;
  amount: string;
  direction: 'AR_INCREASE' | 'AR_DECREASE';
  description: string;
  performed_by: string | null;
  performed_by_name: string | null;
  created_at: string;
}

type InvoicePdfMode = 'invoice_only' | 'invoice_with_annexures';

const invoicePdfModes: InvoicePdfMode[] = ['invoice_only', 'invoice_with_annexures'];

interface InvoicePdfHeaderRow {
  id: string;
  customer_id: string;
  invoice_type: 'invoice' | 'credit_note';
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  booking_date: string | null;
  duty_type_label: string | null;
  nature_of_journey: string | null;
  vehicle_number: string | null;
  vehicle_type_label: string | null;
  duty_slip_number: string | null;
  total_km: string | null;
  total_hours: string | null;
  payment_terms_days: number | null;
  interest_note: string | null;
  subtotal: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  total_amount: string;
  billing_address: string | null;
  customer_gstin: string | null;
  remarks: string | null;
  customer_name: string;
  invoice_pdf_mode: InvoicePdfMode;
}

interface InvoicePdfItemRow {
  id: string;
  description: string;
  hsn_code: string | null;
  quantity: string;
  rate: string;
  amount: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  total_amount: string;
  annexure_id: string | null;
  annexure_number: string | null;
  start_date: string | null;
  end_date: string | null;
  start_km: string | null;
  end_km: string | null;
  total_km: string | null;
  total_hours: string | null;
  night_halts: number | null;
  calculated_amount: string | null;
  annexure_is_billed: boolean | null;
  duty_slip_number: string | null;
  annexure_vehicle_number: string | null;
  annexure_vehicle_type_label: string | null;
  vehicle_category_name: string | null;
}

function isInvoicePdfMode(value: unknown): value is InvoicePdfMode {
  return typeof value === 'string' && invoicePdfModes.includes(value as InvoicePdfMode);
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeTaxComponent(row: InvoiceTaxComponentRow) {
  return {
    ...row,
    taxable_base: Number(row.taxable_base),
    rate: toNumber(row.rate),
    flat_amount: toNumber(row.flat_amount),
    tax_amount: Number(row.tax_amount),
  };
}

function normalizeInvoiceRow(row: InvoiceListRow) {
  const totalAmount = Number(row.total_amount);
  const collectedAmount = Number(row.collected_amount ?? 0);

  return {
    ...row,
    subtotal: Number(row.subtotal),
    cgst_amount: Number(row.cgst_amount),
    sgst_amount: Number(row.sgst_amount),
    igst_amount: Number(row.igst_amount),
    total_amount: totalAmount,
    collected_amount: collectedAmount,
    outstanding_amount: Math.max(0, totalAmount - collectedAmount),
    total_km: toNumber(row.total_km),
    total_hours: toNumber(row.total_hours),
    item_count: Number(row.item_count),
    annexure_item_count: Number(row.annexure_item_count),
  };
}

async function loadInvoiceSummary(invoiceId: string): Promise<InvoiceListRow | null> {
  const result = await query<InvoiceListRow>(
    `
      SELECT
        i.*,
        json_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code) AS customer,
        CASE
          WHEN EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = i.id AND ii.annexure_id IS NOT NULL) THEN 'annexures'
          WHEN EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = i.id AND ii.trip_id IS NOT NULL) THEN 'trip'
          ELSE 'manual'
        END AS source_type,
        (SELECT COUNT(*)::text FROM invoice_items ii WHERE ii.invoice_id = i.id) AS item_count,
        (SELECT COUNT(*)::text FROM invoice_items ii WHERE ii.invoice_id = i.id AND ii.annexure_id IS NOT NULL) AS annexure_item_count,
        COALESCE((SELECT SUM(c.amount) FROM collections c WHERE c.invoice_id = i.id), 0)::text AS collected_amount
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      WHERE i.id = $1
      LIMIT 1
    `,
    [invoiceId]
  );

  return result.rows[0] ?? null;
}

async function loadInvoiceTaxComponents(invoiceId: string) {
  const [invoiceRows, itemRows] = await Promise.all([
    query<InvoiceTaxComponentRow>(
      `
        SELECT *
        FROM invoice_tax_components
        WHERE invoice_id = $1
        ORDER BY sort_order ASC, component_code ASC, created_at ASC
      `,
      [invoiceId]
    ),
    query<InvoiceItemTaxComponentRow>(
      `
        SELECT *
        FROM invoice_item_tax_components
        WHERE invoice_id = $1
        ORDER BY invoice_item_id ASC, sort_order ASC, component_code ASC, created_at ASC
      `,
      [invoiceId]
    ),
  ]);

  const groupedItemLines = new Map<string, ReturnType<typeof normalizeTaxComponent>[]>();
  for (const row of itemRows.rows) {
    const current = groupedItemLines.get(row.invoice_item_id) ?? [];
    current.push(normalizeTaxComponent(row));
    groupedItemLines.set(row.invoice_item_id, current);
  }

  return {
    tax_components: invoiceRows.rows.map(normalizeTaxComponent),
    item_tax_components: groupedItemLines,
  };
}

async function isSourceLinkedInvoice(invoiceId: string, db: Queryable = { query }): Promise<boolean> {
  const linkedResult = await db.query<{ id: string }>(
    'SELECT id FROM invoice_items WHERE invoice_id = $1 AND (trip_id IS NOT NULL OR annexure_id IS NOT NULL) LIMIT 1',
    [invoiceId]
  );

  return Boolean(linkedResult.rows[0]);
}

async function isVoidInvoice(invoiceId: string, db: Queryable = { query }): Promise<boolean> {
  const result = await db.query<{ invoice_status: string }>('SELECT invoice_status FROM invoices WHERE id = $1 LIMIT 1', [invoiceId]);
  if (!result.rows[0]) return false;
  return result.rows[0].invoice_status !== 'active';
}

async function createOrUpdateManualInvoice(
  payload: Record<string, unknown>,
  userId: string | null,
  existingInvoiceId?: string,
  db: Queryable = { query }
): Promise<string> {
  if (!payload.invoice_number || !payload.invoice_date || !payload.customer_id || payload.subtotal === undefined) {
    throw new Error('Missing required invoice fields.');
  }

  const customerResult = await db.query<{
    id: string;
    gstin: string | null;
    address: string | null;
  }>('SELECT id, gstin, address FROM customers WHERE id = $1 LIMIT 1', [payload.customer_id]);
  const customer = customerResult.rows[0];
  if (!customer) {
    throw new Error('Customer not found.');
  }

  const settings = await getGtInvoiceSettings(db);
  const resolvedCustomerGstin = typeof payload.customer_gstin === 'string' && payload.customer_gstin.trim().length > 0
    ? payload.customer_gstin.trim()
    : customer.gstin;
  const resolvedBillingAddress = typeof payload.billing_address === 'string' && payload.billing_address.trim().length > 0
    ? payload.billing_address.trim()
    : customer.address;
  const paymentTermsDays = payload.payment_terms_days == null ? null : Number(payload.payment_terms_days);
  const taxCalculation = await calculateInvoiceTaxes(db, {
    items: [{ taxable_base: Number(payload.subtotal), hsn_code: null }],
    companyGstin: settings.company_gstin,
    customerGstin: resolvedCustomerGstin,
  });
  const interestNote = typeof payload.interest_note === 'string' && payload.interest_note.trim().length > 0
    ? payload.interest_note.trim()
    : buildInterestNote(paymentTermsDays);

  let invoiceId = existingInvoiceId ?? null;
  if (invoiceId) {
    await db.query('DELETE FROM invoice_item_tax_components WHERE invoice_id = $1', [invoiceId]);
    await db.query('DELETE FROM invoice_tax_components WHERE invoice_id = $1', [invoiceId]);
    await db.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);

    const updatePayload = {
      invoice_number: payload.invoice_number,
      invoice_date: payload.invoice_date,
      customer_id: payload.customer_id,
      billing_address: resolvedBillingAddress,
      customer_gstin: resolvedCustomerGstin,
      booking_date: payload.booking_date ?? null,
      duty_type_label: payload.duty_type_label ?? null,
      nature_of_journey: payload.nature_of_journey ?? null,
      vehicle_number: payload.vehicle_number ?? null,
      vehicle_type_label: payload.vehicle_type_label ?? null,
      duty_slip_number: payload.duty_slip_number ?? null,
      total_km: payload.total_km ?? null,
      total_hours: payload.total_hours ?? null,
      payment_terms_days: paymentTermsDays,
      interest_note: interestNote,
      subtotal: taxCalculation.subtotal,
      cgst_amount: taxCalculation.legacy.cgst_amount,
      sgst_amount: taxCalculation.legacy.sgst_amount,
      igst_amount: taxCalculation.legacy.igst_amount,
      total_amount: taxCalculation.total_amount,
      payment_status: payload.payment_status ?? 'pending',
      due_date: payload.due_date ?? null,
      remarks: payload.remarks ?? null,
    };
    const update = buildUpdateClause(updatePayload);
    await db.query(
      `UPDATE invoices SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1}`,
      [...update.values, invoiceId]
    );
  } else {
    const result = await db.query<{ id: string }>(
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
        payload.invoice_number,
        payload.invoice_date,
        payload.customer_id,
        resolvedBillingAddress,
        resolvedCustomerGstin,
        payload.booking_date ?? null,
        payload.duty_type_label ?? null,
        payload.nature_of_journey ?? null,
        payload.vehicle_number ?? null,
        payload.vehicle_type_label ?? null,
        payload.duty_slip_number ?? null,
        payload.total_km ?? null,
        payload.total_hours ?? null,
        paymentTermsDays,
        interestNote,
        taxCalculation.subtotal,
        taxCalculation.legacy.cgst_amount,
        taxCalculation.legacy.sgst_amount,
        taxCalculation.legacy.igst_amount,
        taxCalculation.total_amount,
        payload.payment_status ?? 'pending',
        payload.due_date ?? null,
        payload.remarks ?? null,
        userId,
      ]
    );

    invoiceId = result.rows[0].id;
  }

  const itemResult = await db.query<{ id: string }>(
    `
      INSERT INTO invoice_items (
        invoice_id, trip_id, annexure_id, description, hsn_code, quantity, rate, amount,
        cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
      ) VALUES (
        $1, NULL, NULL, $2, $3, 1, $4, $5,
        $6, $7, $8, $9, $10, $11, $12
      )
      RETURNING id
    `,
    [
      invoiceId,
      'Manual invoice amount',
      taxCalculation.items[0].hsn_code,
      taxCalculation.items[0].taxable_base,
      taxCalculation.items[0].taxable_base,
      taxCalculation.items[0].legacy.cgst_rate,
      taxCalculation.items[0].legacy.sgst_rate,
      taxCalculation.items[0].legacy.igst_rate,
      taxCalculation.items[0].legacy.cgst_amount,
      taxCalculation.items[0].legacy.sgst_amount,
      taxCalculation.items[0].legacy.igst_amount,
      taxCalculation.items[0].total_amount,
    ]
  );

  await persistInvoiceTaxSnapshots(db, {
    invoiceId,
    items: [{ invoiceItemId: itemResult.rows[0].id, tax: taxCalculation.items[0] }],
    taxComponents: taxCalculation.tax_components,
  });

  return invoiceId;
}

router.get('/', authRequired, async (req, res) => {
  try {
    const includeVoid = req.query.include_void === 'true';
    const typeFilter = typeof req.query.type === 'string' ? req.query.type : null;

    const result = await query<InvoiceListRow>(
      `
        SELECT
          i.*,
          (SELECT ii.trip_id FROM invoice_items ii WHERE ii.invoice_id = i.id AND ii.trip_id IS NOT NULL LIMIT 1) AS trip_id,
          json_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code) AS customer,
          CASE
            WHEN EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = i.id AND ii.annexure_id IS NOT NULL) THEN 'annexures'
            WHEN EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = i.id AND ii.trip_id IS NOT NULL) THEN 'trip'
            ELSE 'manual'
          END AS source_type,
          (SELECT COUNT(*)::text FROM invoice_items ii WHERE ii.invoice_id = i.id) AS item_count,
          (SELECT COUNT(*)::text FROM invoice_items ii WHERE ii.invoice_id = i.id AND ii.annexure_id IS NOT NULL) AS annexure_item_count,
          COALESCE((SELECT SUM(c.amount) FROM collections c WHERE c.invoice_id = i.id), 0)::text AS collected_amount
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        WHERE ($1 OR i.invoice_status = 'active')
          AND ($2::text IS NULL OR i.invoice_type = $2)
        ORDER BY i.invoice_date DESC, i.created_at DESC
      `,
      [includeVoid, typeFilter]
    );

    res.json(result.rows.map(normalizeInvoiceRow));
  } catch (error) {
    console.error('Fetching invoices failed:', error);
    res.status(500).json({ message: 'Unable to fetch invoices.' });
  }
});

router.get('/:id/pdf', authRequired, async (req, res) => {
  const invoiceId = String(req.params.id);
  const requestedMode = typeof req.query.mode === 'string' && req.query.mode.trim().length > 0
    ? req.query.mode.trim()
    : null;

  if (requestedMode && !isInvoicePdfMode(requestedMode)) {
    res.status(400).json({ message: 'Invalid invoice PDF mode.' });
    return;
  }

  try {
    const [invoiceResult, itemResult, taxData, settings] = await Promise.all([
      query<InvoicePdfHeaderRow>(
        `
          SELECT
            i.id,
            i.customer_id,
            i.invoice_type,
            i.invoice_number,
            i.invoice_date::text,
            i.due_date::text,
            i.booking_date::text,
            i.duty_type_label,
            i.nature_of_journey,
            i.vehicle_number,
            i.vehicle_type_label,
            i.duty_slip_number,
            i.total_km::text,
            i.total_hours::text,
            i.payment_terms_days,
            i.interest_note,
            i.subtotal::text,
            i.cgst_amount::text,
            i.sgst_amount::text,
            i.igst_amount::text,
            i.total_amount::text,
            i.billing_address,
            i.customer_gstin,
            i.remarks,
            c.name AS customer_name,
            c.invoice_pdf_mode
          FROM invoices i
          JOIN customers c ON c.id = i.customer_id
          WHERE i.id = $1
          LIMIT 1
        `,
        [invoiceId]
      ),
      query<InvoicePdfItemRow>(
        `
          SELECT
            ii.id,
            ii.description,
            ii.hsn_code,
            ii.quantity::text,
            ii.rate::text,
            ii.amount::text,
            ii.cgst_amount::text,
            ii.sgst_amount::text,
            ii.igst_amount::text,
            ii.total_amount::text,
            ii.annexure_id,
            a.annexure_number,
            a.start_date::text,
            a.end_date::text,
            a.start_km::text,
            a.end_km::text,
            a.total_km::text,
            a.total_hours::text,
            a.night_halts,
            a.calculated_amount::text,
            a.is_billed AS annexure_is_billed,
            t.trip_number AS duty_slip_number,
            v.vehicle_number AS annexure_vehicle_number,
            COALESCE(vc.name, v.vehicle_type::text) AS annexure_vehicle_type_label,
            vc.name AS vehicle_category_name
          FROM invoice_items ii
          LEFT JOIN annexures a ON a.id = ii.annexure_id
          LEFT JOIN trips t ON t.id = a.trip_id
          LEFT JOIN vehicles v ON v.id = t.vehicle_id
          LEFT JOIN vehicle_categories vc ON vc.id = t.vehicle_category_id
          WHERE ii.invoice_id = $1
          ORDER BY ii.created_at ASC
        `,
        [invoiceId]
      ),
      loadInvoiceTaxComponents(invoiceId),
      getGtInvoiceSettings({ query }),
    ]);

    const invoice = invoiceResult.rows[0];
    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    const effectiveMode: InvoicePdfMode = requestedMode ? (requestedMode as InvoicePdfMode) : invoice.invoice_pdf_mode;
    const hasAnnexureItems = itemResult.rows.some((item) => Boolean(item.annexure_id));
    const hasGtSnapshot = Boolean(
      invoice.duty_slip_number ||
      invoice.booking_date ||
      invoice.duty_type_label ||
      itemResult.rows.some((item) => item.annexure_number)
    );

    const gtInvoiceData = {
      invoice_type: invoice.invoice_type,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      booking_date: invoice.booking_date,
      duty_type_label: invoice.duty_type_label,
      nature_of_journey: invoice.nature_of_journey,
      vehicle_number: invoice.vehicle_number,
      vehicle_type_label: invoice.vehicle_type_label,
      duty_slip_number: invoice.duty_slip_number,
      total_km: toNumber(invoice.total_km),
      total_hours: toNumber(invoice.total_hours),
      payment_terms_days: invoice.payment_terms_days,
      interest_note: invoice.interest_note,
      subtotal: Number(invoice.subtotal),
      cgst_amount: Number(invoice.cgst_amount),
      sgst_amount: Number(invoice.sgst_amount),
      igst_amount: Number(invoice.igst_amount),
      total_amount: Number(invoice.total_amount),
      customer_name: invoice.customer_name,
      billing_address: invoice.billing_address,
      customer_gstin: invoice.customer_gstin,
      remarks: invoice.remarks,
      tax_components: taxData.tax_components,
      items: itemResult.rows.map((item) => ({
        description: item.description,
        amount: Number(item.amount),
        cgst_amount: Number(item.cgst_amount),
        sgst_amount: Number(item.sgst_amount),
        igst_amount: Number(item.igst_amount),
        total_amount: Number(item.total_amount),
        annexure_number: item.annexure_number,
        start_date: item.start_date,
        end_date: item.end_date,
      })),
    };

    let pdf: Buffer;
    if (hasGtSnapshot) {
      if (effectiveMode === 'invoice_with_annexures' && hasAnnexureItems) {
        const annexures: AnnexurePdfData[] = itemResult.rows
          .filter((item) => Boolean(item.annexure_id))
          .map((item, index) => {
            if (
              !item.annexure_number ||
              !item.start_date ||
              !item.end_date ||
              item.start_km == null ||
              item.end_km == null ||
              item.total_km == null ||
              item.total_hours == null ||
              item.night_halts == null ||
              item.calculated_amount == null ||
              !item.duty_slip_number ||
              !item.annexure_vehicle_number ||
              !item.annexure_vehicle_type_label
            ) {
              throw new Error(`Missing annexure PDF data for appended annexure #${index + 1}.`);
            }

            return {
              annexure_number: item.annexure_number,
              duty_slip_number: item.duty_slip_number,
              customer_name: invoice.customer_name,
              vehicle_number: item.annexure_vehicle_number,
              vehicle_type_label: item.annexure_vehicle_type_label,
              vehicle_category_name: item.vehicle_category_name,
              start_date: item.start_date,
              end_date: item.end_date,
              start_km: Number(item.start_km),
              end_km: Number(item.end_km),
              total_km: Number(item.total_km),
              total_hours: Number(item.total_hours),
              night_halts: item.night_halts,
              calculated_amount: Number(item.calculated_amount),
              is_billed: item.annexure_is_billed ?? true,
              invoice_number: invoice.invoice_number,
            };
          });

        pdf = await buildGtInvoiceWithAnnexuresPdf(
          gtInvoiceData,
          annexures,
          settings as unknown as Record<string, string>
        );
      } else {
        pdf = await buildGtInvoicePdf(
          gtInvoiceData,
          settings as unknown as Record<string, string>
        );
      }
    } else {
      // Non-GT/legacy invoices ignore the annexure PDF mode and continue using the base invoice builder.
      pdf = await buildInvoicePdf(
        {
          ...invoice,
          subtotal: Number(invoice.subtotal),
          cgst_amount: Number(invoice.cgst_amount),
          sgst_amount: Number(invoice.sgst_amount),
          igst_amount: Number(invoice.igst_amount),
          total_amount: Number(invoice.total_amount),
          tax_components: taxData.tax_components,
          items: itemResult.rows.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
            rate: Number(item.rate),
            amount: Number(item.amount),
            cgst_amount: Number(item.cgst_amount),
            sgst_amount: Number(item.sgst_amount),
            igst_amount: Number(item.igst_amount),
            total_amount: Number(item.total_amount),
          })),
        },
        settings as unknown as Record<string, string>
      );
    }

    const fileName = `${invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error) {
    console.error('Generating invoice PDF failed:', error);
    res.status(500).json({ message: 'Unable to generate invoice PDF.' });
  }
});

router.get('/:id/ledger', authRequired, async (req, res) => {
  const invoiceId = String(req.params.id);

  try {
    const result = await query<FinancialLedgerRow>(
      `
        SELECT
          l.id,
          l.event_type,
          l.invoice_id,
          l.invoice_number,
          l.collection_id,
          l.amount::text AS amount,
          l.direction,
          l.description,
          l.performed_by,
          p.full_name AS performed_by_name,
          l.created_at::text AS created_at
        FROM financial_ledger l
        LEFT JOIN profiles p ON p.id = l.performed_by
        WHERE l.invoice_id = $1
        ORDER BY l.created_at ASC, l.id ASC
      `,
      [invoiceId]
    );

    res.json(result.rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
    })));
  } catch (error) {
    console.error('Fetching invoice ledger failed:', error);
    res.status(500).json({ message: 'Unable to fetch invoice ledger.' });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  const invoiceId = String(req.params.id);
  try {
    const [invoice, itemResult, taxData] = await Promise.all([
      loadInvoiceSummary(invoiceId),
      query(
        `
          SELECT
            ii.*,
            a.annexure_number,
            a.start_date::text,
            a.end_date::text,
            CASE
              WHEN a.id IS NULL THEN NULL
              ELSE json_build_object(
                'id', a.id,
                'annexure_number', a.annexure_number,
                'start_date', a.start_date::text,
                'end_date', a.end_date::text
              )
            END AS annexure
          FROM invoice_items ii
          LEFT JOIN annexures a ON a.id = ii.annexure_id
          WHERE ii.invoice_id = $1
          ORDER BY ii.created_at ASC
        `,
        [invoiceId]
      ),
      loadInvoiceTaxComponents(invoiceId),
    ]);

    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    // Embed credit note or reference invoice
    let creditNote: Record<string, unknown> | null = null;
    let referenceInvoice: Record<string, unknown> | null = null;

    if (invoice.invoice_type === 'credit_note' && invoice.reference_invoice_id) {
      const refResult = await query<{ id: string; invoice_number: string; invoice_date: string; total_amount: string }>(
        'SELECT id, invoice_number, invoice_date::text, total_amount::text FROM invoices WHERE id = $1 LIMIT 1',
        [invoice.reference_invoice_id]
      );
      if (refResult.rows[0]) {
        referenceInvoice = { ...refResult.rows[0], total_amount: Number(refResult.rows[0].total_amount) };
      }
    } else {
      const cnResult = await query<{ id: string; invoice_number: string; invoice_date: string; total_amount: string }>(
        `SELECT id, invoice_number, invoice_date::text, total_amount::text
         FROM invoices WHERE reference_invoice_id = $1 AND invoice_type = 'credit_note' LIMIT 1`,
        [invoiceId]
      );
      if (cnResult.rows[0]) {
        creditNote = { ...cnResult.rows[0], total_amount: Number(cnResult.rows[0].total_amount) };
      }
    }

    res.json({
      ...normalizeInvoiceRow(invoice),
      tax_components: taxData.tax_components,
      items: itemResult.rows.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        amount: Number(item.amount),
        cgst_rate: Number(item.cgst_rate),
        sgst_rate: Number(item.sgst_rate),
        igst_rate: Number(item.igst_rate),
        cgst_amount: Number(item.cgst_amount),
        sgst_amount: Number(item.sgst_amount),
        igst_amount: Number(item.igst_amount),
        total_amount: Number(item.total_amount),
        tax_components: taxData.item_tax_components.get(item.id) ?? [],
      })),
      credit_note: creditNote,
      reference_invoice: referenceInvoice,
    });
  } catch (error) {
    console.error('Fetching invoice detail failed:', error);
    res.status(500).json({ message: 'Unable to fetch invoice detail.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, invoiceFields);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const invoiceId = await createOrUpdateManualInvoice(payload, req.user?.id ?? null, undefined, client);
    const invoiceResult = await client.query<{ customer_id: string; invoice_number: string; total_amount: string }>(
      'SELECT customer_id, invoice_number, total_amount::text AS total_amount FROM invoices WHERE id = $1 LIMIT 1',
      [invoiceId]
    );
    const createdInvoice = invoiceResult.rows[0];

    await writeLedgerEntry(client, {
      event_type: 'invoice_issued',
      customer_id: createdInvoice.customer_id,
      invoice_id: invoiceId,
      invoice_number: createdInvoice.invoice_number,
      amount: Number(createdInvoice.total_amount),
      direction: 'AR_INCREASE',
      description: `Invoice ${createdInvoice.invoice_number} issued for Rs.${formatLedgerAmount(Number(createdInvoice.total_amount))}.`,
      performed_by: req.user?.id ?? null,
    });

    await client.query('COMMIT');
    const invoice = await loadInvoiceSummary(invoiceId);
    res.status(201).json(normalizeInvoiceRow(invoice as InvoiceListRow));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating invoice failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to create invoice.';
    const status = message === 'Missing required invoice fields.' || message === 'Customer not found.' ? 400 : 500;
    res.status(status).json({ message });
  } finally {
    client.release();
  }
});

router.post('/mark-overdue', authRequired, roleCheck(['admin', 'manager']), async (_req, res) => {
  try {
    const result = await query<{ id: string; invoice_number: string }>(
      `UPDATE invoices
       SET payment_status = 'overdue', updated_at = now()
       WHERE invoice_status = 'active'
         AND invoice_type = 'invoice'
         AND due_date < CURRENT_DATE
         AND payment_status IN ('pending', 'partial')
       RETURNING id, invoice_number`
    );
    res.json({ count: result.rowCount ?? 0, invoices: result.rows });
  } catch (error) {
    console.error('Marking overdue failed:', error);
    res.status(500).json({ message: 'Unable to mark overdue invoices.' });
  }
});

router.post('/:id/void', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const invoiceId = String(req.params.id);
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim().length > 0
    ? req.body.reason.trim()
    : null;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query<{
      id: string;
      customer_id: string;
      invoice_number: string;
      invoice_type: string;
      invoice_status: string;
      total_amount: string;
      total_collected: string;
    }>(
      `SELECT i.id, i.customer_id, i.invoice_number, i.invoice_type, i.invoice_status, i.total_amount::text,
              COALESCE((
                SELECT SUM(c.amount)
                FROM collections c
                WHERE c.invoice_id = i.id
              ), 0)::text AS total_collected
       FROM invoices i
       WHERE i.id = $1
       FOR UPDATE OF i`,
      [invoiceId]
    );

    const inv = invoiceResult.rows[0];
    if (!inv) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    if (inv.invoice_type === 'credit_note') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Credit notes cannot be voided.' });
      return;
    }

    if (inv.invoice_status !== 'active') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: `Invoice is already ${inv.invoice_status}.` });
      return;
    }

    const collectedAmount = Number(inv.total_collected);
    let creditNoteId: string | null = null;
    let creditNoteNumber: string | null = null;

    if (collectedAmount > 0) {
      creditNoteNumber = await generateCreditNoteNumber(client);
      const cnRemarks = `Credit note for refund received on voided invoice ${inv.invoice_number}.${reason ? ` Reason: ${reason}` : ''}`;

      const cnResult = await client.query<{ id: string }>(
        `INSERT INTO invoices (
           invoice_number, invoice_date, customer_id, billing_address, customer_gstin,
           subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
           payment_status, due_date, remarks,
           invoice_type, reference_invoice_id, invoice_status, created_by
         ) SELECT
           $2, CURRENT_DATE, customer_id, billing_address, customer_gstin,
           $3, 0, 0, 0, $3,
           'pending', CURRENT_DATE, $4,
           'credit_note', id, 'active', $5
         FROM invoices WHERE id = $1
         RETURNING id`,
        [invoiceId, creditNoteNumber, collectedAmount, cnRemarks, req.user?.id ?? null]
      );
      creditNoteId = cnResult.rows[0].id;

      await client.query(
        `INSERT INTO invoice_items (
           invoice_id, description, hsn_code, quantity, rate, amount,
           cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
         ) VALUES (
           $1, $2, NULL, 1, $3, $3,
           0, 0, 0, 0, 0, 0, $3
         )`,
        [creditNoteId, `Refund credit for voided invoice ${inv.invoice_number}`, collectedAmount]
      );
    }

    // Unlink annexures so they can be re-billed
    const itemResult = await client.query<{ annexure_id: string | null }>(
      'SELECT annexure_id FROM invoice_items WHERE invoice_id = $1',
      [invoiceId]
    );
    const annexureIds = Array.from(new Set(
      itemResult.rows.map((r) => r.annexure_id).filter((v): v is string => Boolean(v))
    ));
    if (annexureIds.length > 0) {
      await client.query(
        'UPDATE annexures SET is_billed = false, invoice_id = NULL, updated_at = now() WHERE id = ANY($1::uuid[])',
        [annexureIds]
      );
    }

    // Remove invoice_items for the voided invoice so the trip becomes rebillable.
    // NOTE: invoiceId is the voided invoice — this does NOT affect the credit note's items.
    await client.query(
      'DELETE FROM invoice_items WHERE invoice_id = $1',
      [invoiceId]
    );

    await client.query(
      `UPDATE invoices
       SET invoice_status = 'void', void_reason = $2, voided_at = now(), voided_by = $3, updated_at = now()
       WHERE id = $1`,
      [invoiceId, reason, req.user?.id ?? null]
    );

    await writeLedgerEntry(client, {
      event_type: 'invoice_voided',
      customer_id: inv.customer_id,
      invoice_id: invoiceId,
      invoice_number: inv.invoice_number,
      amount: 0,
      direction: 'AR_DECREASE',
      description: `Invoice ${inv.invoice_number} voided.${creditNoteNumber ? ` Credit note ${creditNoteNumber} for Rs.${formatLedgerAmount(collectedAmount)} issued for received amount.` : ''}${reason ? ` Reason: ${reason}` : ''}`,
      performed_by: req.user?.id ?? null,
    });

    if (creditNoteId && creditNoteNumber) {
      await writeLedgerEntry(client, {
        event_type: 'credit_note_issued',
        customer_id: inv.customer_id,
        invoice_id: creditNoteId,
        invoice_number: creditNoteNumber,
        amount: collectedAmount,
        direction: 'AR_DECREASE',
        description: `Credit note ${creditNoteNumber} of Rs.${formatLedgerAmount(collectedAmount)} issued for received amount on voided invoice ${inv.invoice_number}.`,
        performed_by: req.user?.id ?? null,
      });
    }

    await client.query('COMMIT');

    const [invoice, creditNote] = await Promise.all([
      loadInvoiceSummary(invoiceId),
      creditNoteId ? loadInvoiceSummary(creditNoteId) : Promise.resolve(null),
    ]);

    res.json({
      invoice: normalizeInvoiceRow(invoice as InvoiceListRow),
      credit_note: creditNote ? normalizeInvoiceRow(creditNote as InvoiceListRow) : null,
      released_annexure_count: annexureIds.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Voiding invoice failed:', error);
    res.status(500).json({ message: 'Unable to void invoice.' });
  } finally {
    client.release();
  }
});

router.post('/:id/write-off', authRequired, roleCheck(['admin']), async (req, res) => {
  const invoiceId = String(req.params.id);
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim().length > 0
    ? req.body.reason.trim()
    : null;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<{
      customer_id: string;
      invoice_number: string;
      invoice_status: string;
      invoice_type: string;
      total_amount: string;
      total_collected: string;
    }>(
      `
        SELECT
          i.customer_id,
            i.invoice_type,
            i.invoice_number,
          i.invoice_status,
          i.invoice_type,
          i.total_amount::text,
          COALESCE((SELECT SUM(c.amount) FROM collections c WHERE c.invoice_id = i.id), 0)::text AS total_collected
        FROM invoices i
        WHERE i.id = $1
        LIMIT 1
        FOR UPDATE OF i
      `,
      [invoiceId]
    );
    const inv = existing.rows[0];
    if (!inv) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }
    if (inv.invoice_type === 'credit_note') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Credit notes cannot be written off.' });
      return;
    }
    if (inv.invoice_status !== 'active') {
      await client.query('ROLLBACK');
      res.status(409).json({ message: `Invoice is already ${inv.invoice_status}.` });
      return;
    }

    const outstandingAmount = Math.max(0, Number(inv.total_amount) - Number(inv.total_collected));

    await client.query(
      `UPDATE invoices
       SET invoice_status = 'written_off', void_reason = $2, voided_at = now(), voided_by = $3, updated_at = now()
       WHERE id = $1`,
      [invoiceId, reason, req.user?.id ?? null]
    );

    await writeLedgerEntry(client, {
      event_type: 'write_off',
      customer_id: inv.customer_id,
      invoice_id: invoiceId,
      invoice_number: inv.invoice_number,
      amount: outstandingAmount,
      direction: 'AR_DECREASE',
      description: `Outstanding Rs.${formatLedgerAmount(outstandingAmount)} on ${inv.invoice_number} written off.${reason ? ` Reason: ${reason}` : ''}`,
      performed_by: req.user?.id ?? null,
    });

    await client.query('COMMIT');
    const invoice = await loadInvoiceSummary(invoiceId);
    res.json(normalizeInvoiceRow(invoice as InvoiceListRow));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Writing off invoice failed:', error);
    res.status(500).json({ message: 'Unable to write off invoice.' });
  } finally {
    client.release();
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, invoiceFields);
  const invoiceId = String(req.params.id);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No invoice fields supplied for update.' });
    return;
  }

  try {
    if (await isVoidInvoice(invoiceId)) {
      res.status(409).json({ message: 'Void invoices cannot be edited.' });
      return;
    }

    if (await isSourceLinkedInvoice(invoiceId)) {
      res.status(409).json({ message: 'Edit is blocked for GT source-linked invoices.' });
      return;
    }

    const savedInvoiceId = await createOrUpdateManualInvoice(payload, req.user?.id ?? null, invoiceId);
    const invoice = await loadInvoiceSummary(savedInvoiceId);
    res.json(normalizeInvoiceRow(invoice as InvoiceListRow));
  } catch (error) {
    console.error('Updating invoice failed:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to update invoice.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const invoiceId = String(req.params.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query<{
      id: string;
      customer_id: string;
      invoice_number: string;
      total_amount: string;
    }>('SELECT id, customer_id, invoice_number, total_amount::text AS total_amount FROM invoices WHERE id = $1 LIMIT 1 FOR UPDATE', [invoiceId]);
    const invoice = invoiceResult.rows[0];
    if (!invoice) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    const collectionCheck = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM collections WHERE invoice_id = $1',
      [invoiceId]
    );
    if (Number(collectionCheck.rows[0]?.count) > 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'Invoice has collections recorded. Use void to cancel it instead.' });
      return;
    }

    if (await isVoidInvoice(invoiceId, client)) {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Void invoices cannot be deleted.' });
      return;
    }

    if (await isSourceLinkedInvoice(invoiceId, client)) {
      await client.query('ROLLBACK');
      res.status(409).json({ message: 'Delete is blocked for GT source-linked invoices.' });
      return;
    }

    await writeLedgerEntry(client, {
      event_type: 'invoice_deleted',
      customer_id: invoice.customer_id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount: Number(invoice.total_amount),
      direction: 'AR_DECREASE',
      description: `Invoice ${invoice.invoice_number} deleted (no collections) for Rs.${formatLedgerAmount(Number(invoice.total_amount))}.`,
      performed_by: req.user?.id ?? null,
    });

    await client.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
    await client.query('COMMIT');

    res.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Deleting invoice failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('invoice', error) });
  } finally {
    client.release();
  }
});

export default router;
