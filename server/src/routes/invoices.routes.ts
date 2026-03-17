import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { getGtInvoiceSettings } from '../utils/invoice-gt';
import { buildGtInvoicePdf } from '../utils/pdf-invoice-gt';
import { buildInvoicePdf } from '../utils/pdf-invoice';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';

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
  payment_status: string;
  due_date: string | null;
  remarks: string | null;
  source_type: 'manual' | 'trip' | 'annexures';
  item_count: string;
  annexure_item_count: string;
  customer: {
    id: string;
    name: string;
    customer_code: string;
  };
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

router.get('/', authRequired, async (_req, res) => {
  try {
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
          (SELECT COUNT(*)::text FROM invoice_items ii WHERE ii.invoice_id = i.id AND ii.annexure_id IS NOT NULL) AS annexure_item_count
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        ORDER BY i.invoice_date DESC, i.created_at DESC
      `
    );

    res.json(
      result.rows.map((row) => ({
        ...row,
        subtotal: Number(row.subtotal),
        cgst_amount: Number(row.cgst_amount),
        sgst_amount: Number(row.sgst_amount),
        igst_amount: Number(row.igst_amount),
        total_amount: Number(row.total_amount),
        total_km: toNumber(row.total_km),
        total_hours: toNumber(row.total_hours),
        item_count: Number(row.item_count),
        annexure_item_count: Number(row.annexure_item_count),
      }))
    );
  } catch (error) {
    console.error('Fetching invoices failed:', error);
    res.status(500).json({ message: 'Unable to fetch invoices.' });
  }
});

router.get('/:id/pdf', authRequired, async (req, res) => {
  try {
    const [invoiceResult, itemResult, settings] = await Promise.all([
      query<{
        id: string;
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
      }>(
        `
          SELECT
            i.id,
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
            c.name AS customer_name
          FROM invoices i
          JOIN customers c ON c.id = i.customer_id
          WHERE i.id = $1
          LIMIT 1
        `,
        [req.params.id]
      ),
      query<{
        description: string;
        hsn_code: string | null;
        quantity: string;
        rate: string;
        amount: string;
        cgst_amount: string;
        sgst_amount: string;
        igst_amount: string;
        total_amount: string;
        annexure_number: string | null;
        start_date: string | null;
        end_date: string | null;
      }>(
        `
          SELECT
            ii.description,
            ii.hsn_code,
            ii.quantity::text,
            ii.rate::text,
            ii.amount::text,
            ii.cgst_amount::text,
            ii.sgst_amount::text,
            ii.igst_amount::text,
            ii.total_amount::text,
            a.annexure_number,
            a.start_date::text,
            a.end_date::text
          FROM invoice_items ii
          LEFT JOIN annexures a ON a.id = ii.annexure_id
          WHERE ii.invoice_id = $1
          ORDER BY ii.created_at ASC
        `,
        [req.params.id]
      ),
      getGtInvoiceSettings({ query }),
    ]);

    const invoice = invoiceResult.rows[0];
    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    const hasGtSnapshot = Boolean(invoice.duty_slip_number || invoice.booking_date || invoice.duty_type_label || itemResult.rows.some((item) => item.annexure_number));

    const pdf = hasGtSnapshot
      ? await buildGtInvoicePdf(
          {
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
          },
          settings as unknown as Record<string, string>
        )
      : await buildInvoicePdf(
          {
            ...invoice,
            subtotal: Number(invoice.subtotal),
            cgst_amount: Number(invoice.cgst_amount),
            sgst_amount: Number(invoice.sgst_amount),
            igst_amount: Number(invoice.igst_amount),
            total_amount: Number(invoice.total_amount),
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

    const fileName = `${invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error) {
    console.error('Generating invoice PDF failed:', error);
    res.status(500).json({ message: 'Unable to generate invoice PDF.' });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    const [invoiceResult, itemResult] = await Promise.all([
      query<InvoiceListRow>(
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
            (SELECT COUNT(*)::text FROM invoice_items ii WHERE ii.invoice_id = i.id AND ii.annexure_id IS NOT NULL) AS annexure_item_count
          FROM invoices i
          JOIN customers c ON c.id = i.customer_id
          WHERE i.id = $1
          LIMIT 1
        `,
        [req.params.id]
      ),
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
        [req.params.id]
      ),
    ]);

    const invoice = invoiceResult.rows[0];
    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    res.json({
      ...invoice,
      subtotal: Number(invoice.subtotal),
      cgst_amount: Number(invoice.cgst_amount),
      sgst_amount: Number(invoice.sgst_amount),
      igst_amount: Number(invoice.igst_amount),
      total_amount: Number(invoice.total_amount),
      total_km: toNumber(invoice.total_km),
      total_hours: toNumber(invoice.total_hours),
      item_count: Number(invoice.item_count),
      annexure_item_count: Number(invoice.annexure_item_count),
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
      })),
    });
  } catch (error) {
    console.error('Fetching invoice detail failed:', error);
    res.status(500).json({ message: 'Unable to fetch invoice detail.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, invoiceFields);
  if (!payload.invoice_number || !payload.invoice_date || !payload.customer_id || payload.subtotal === undefined || payload.total_amount === undefined) {
    res.status(400).json({ message: 'Missing required invoice fields.' });
    return;
  }

  try {
    const result = await query(
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
        RETURNING *
      `,
      [
        payload.invoice_number,
        payload.invoice_date,
        payload.customer_id,
        payload.billing_address ?? null,
        payload.customer_gstin ?? null,
        payload.booking_date ?? null,
        payload.duty_type_label ?? null,
        payload.nature_of_journey ?? null,
        payload.vehicle_number ?? null,
        payload.vehicle_type_label ?? null,
        payload.duty_slip_number ?? null,
        payload.total_km ?? null,
        payload.total_hours ?? null,
        payload.payment_terms_days ?? null,
        payload.interest_note ?? null,
        payload.subtotal,
        payload.cgst_amount ?? 0,
        payload.sgst_amount ?? 0,
        payload.igst_amount ?? 0,
        payload.total_amount,
        payload.payment_status ?? 'pending',
        payload.due_date ?? null,
        payload.remarks ?? null,
        req.user?.id ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Creating invoice failed:', error);
    res.status(500).json({ message: 'Unable to create invoice.' });
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, invoiceFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No invoice fields supplied for update.' });
    return;
  }

  try {
    const update = buildUpdateClause(payload);
    const result = await query(
      `UPDATE invoices SET ${update.clause}, updated_at = now() WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, req.params.id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating invoice failed:', error);
    res.status(500).json({ message: 'Unable to update invoice.' });
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  try {
    const linkedResult = await query<{ id: string }>(
      'SELECT id FROM invoice_items WHERE invoice_id = $1 AND (trip_id IS NOT NULL OR annexure_id IS NOT NULL) LIMIT 1',
      [req.params.id]
    );
    if (linkedResult.rows[0]) {
      res.status(409).json({ message: 'Delete is blocked for GT source-linked invoices.' });
      return;
    }

    const result = await query('DELETE FROM invoices WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Invoice not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Deleting invoice failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('invoice', error) });
  }
});

export default router;

