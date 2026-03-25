import { Router } from 'express';
import { query } from '../config/db';
import { authRequired } from '../middleware/auth';

const router = Router();

function getQueryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function buildWhereClause(
  filters: Array<{ column: string; value?: string }>,
  startIndex = 0
): { clause: string; values: string[] } {
  const values: string[] = [];
  const parts = filters
    .filter((filter) => filter.value !== undefined)
    .map((filter) => {
      values.push(filter.value as string);
      return `${filter.column} = $${startIndex + values.length}`;
    });

  return {
    clause: parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '',
    values,
  };
}

function buildDateFilters(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  fromColumn: string,
  toColumn?: string
): { clause: string; values: string[] } {
  const values: string[] = [];
  const parts: string[] = [];

  if (dateFrom) {
    values.push(dateFrom);
    parts.push(`${fromColumn} >= $${values.length}`);
  }

  if (dateTo) {
    values.push(dateTo);
    parts.push(`${toColumn ?? fromColumn} <= $${values.length}`);
  }

  return {
    clause: parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '',
    values,
  };
}

router.get('/', authRequired, async (_req, res) => {
  try {
    const [invoiceTotals, collectionTotals, driverTotals, ownerTotals, tripStatus] = await Promise.all([
      query<{ total: string }>("SELECT COALESCE(SUM(total_amount), 0) AS total FROM invoices WHERE invoice_status = 'active' AND invoice_type = 'invoice'"),
      query<{ total: string }>(`
        SELECT COALESCE(SUM(col.amount), 0) AS total
        FROM collections col
        JOIN invoices inv ON inv.id = col.invoice_id
        WHERE inv.invoice_type = 'invoice'
      `),
      query<{ total: string }>('SELECT COALESCE(SUM(net_amount), 0) AS total FROM driver_settlements'),
      query<{ total: string }>('SELECT COALESCE(SUM(net_amount), 0) AS total FROM owner_settlements'),
      query<{ status: string; count: string }>('SELECT status AS status, COUNT(*) AS count FROM trips GROUP BY status'),
    ]);

    const invoiceValue = Number(invoiceTotals.rows[0].total);
    const collectedValue = Number(collectionTotals.rows[0].total);

    res.json({
      invoiceValue,
      collectedValue,
      outstandingValue: invoiceValue - collectedValue,
      driverSettlementValue: Number(driverTotals.rows[0].total),
      ownerSettlementValue: Number(ownerTotals.rows[0].total),
      tripsByStatus: tripStatus.rows.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
    });
  } catch (error) {
    console.error('Fetching reports failed:', error);
    res.status(500).json({ message: 'Unable to fetch report data.' });
  }
});

router.get('/customer-outstanding', authRequired, async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          c.id AS customer_id,
          c.name AS customer_name,
          c.customer_code,
          COUNT(i.id) AS invoice_count,
          COALESCE(SUM(i.total_amount), 0) AS invoiced_amount,
          COALESCE(SUM(COALESCE(collections_by_invoice.collected_amount, 0)), 0) AS collected_amount,
          COALESCE(SUM(i.total_amount - COALESCE(collections_by_invoice.collected_amount, 0)), 0) AS outstanding_amount
        FROM customers c
        JOIN invoices i ON i.customer_id = c.id AND i.invoice_status = 'active' AND i.invoice_type = 'invoice'
        LEFT JOIN (
          SELECT c.invoice_id, COALESCE(SUM(c.amount), 0) AS collected_amount
          FROM collections c
          JOIN invoices i ON i.id = c.invoice_id AND i.invoice_type = 'invoice'
          GROUP BY c.invoice_id
        ) AS collections_by_invoice ON collections_by_invoice.invoice_id = i.id
        GROUP BY c.id, c.name, c.customer_code
        HAVING COALESCE(SUM(i.total_amount - COALESCE(collections_by_invoice.collected_amount, 0)), 0) > 0
        ORDER BY outstanding_amount DESC, customer_name ASC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetching customer outstanding failed:', error);
    res.status(500).json({ message: 'Unable to fetch customer outstanding data.' });
  }
});

router.get('/owner-settlements', authRequired, async (req, res) => {
  const dateFrom = getQueryString(req.query.date_from);
  const dateTo = getQueryString(req.query.date_to);
  const status = getQueryString(req.query.status);
  const dateFilter = buildDateFilters(dateFrom, dateTo, 'os.period_from', 'os.period_to');
  const statusFilter = buildWhereClause([{ column: 'os.status', value: status }], dateFilter.values.length);
  const values = [...dateFilter.values, ...statusFilter.values];
  const conditions = [dateFilter.clause.replace(/^WHERE /, ''), statusFilter.clause.replace(/^WHERE /, '')].filter(Boolean);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query<{
      id: string;
      settlement_number: string;
      period_from: string;
      period_to: string;
      vehicle_number: string | null;
      total_trips: number;
      total_km: string;
      gross_amount: string;
      tds_amount: string;
      other_deductions: string;
      net_paid: string;
      payment_mode: string | null;
      reference_number: string | null;
      status: string;
      owner_id: string;
      owner_name: string;
      owner_code: string;
    }>(
      `
        SELECT
          os.id,
          os.settlement_number,
          os.period_from,
          os.period_to,
          v.vehicle_number,
          os.total_trips,
          os.total_km,
          os.total_amount AS gross_amount,
          os.tds_amount,
          os.other_deductions,
          os.net_amount AS net_paid,
          os.payment_mode,
          os.reference_number,
          os.status,
          o.id AS owner_id,
          o.name AS owner_name,
          o.code AS owner_code
        FROM owner_settlements os
        JOIN owners_vendors o ON o.id = os.owner_id
        LEFT JOIN vehicles v ON v.id = os.vehicle_id
        ${whereClause}
        ORDER BY o.name ASC, os.period_from DESC, os.created_at DESC
      `,
      values
    );

    const grouped = new Map<string, {
      owner_id: string;
      owner_name: string;
      owner_code: string;
      vehicles: Set<string>;
      total_trips: number;
      total_km: number;
      gross_amount: number;
      tds_amount: number;
      other_deductions: number;
      net_paid: number;
      payment_modes: Set<string>;
      reference_numbers: Set<string>;
      settlements: Array<Record<string, unknown>>;
    }>();

    for (const row of result.rows) {
      const current = grouped.get(row.owner_id) ?? {
        owner_id: row.owner_id,
        owner_name: row.owner_name,
        owner_code: row.owner_code,
        vehicles: new Set<string>(),
        total_trips: 0,
        total_km: 0,
        gross_amount: 0,
        tds_amount: 0,
        other_deductions: 0,
        net_paid: 0,
        payment_modes: new Set<string>(),
        reference_numbers: new Set<string>(),
        settlements: [],
      };

      if (row.vehicle_number) {
        current.vehicles.add(row.vehicle_number);
      }
      if (row.payment_mode) {
        current.payment_modes.add(row.payment_mode);
      }
      if (row.reference_number) {
        current.reference_numbers.add(row.reference_number);
      }

      current.total_trips += Number(row.total_trips);
      current.total_km += Number(row.total_km);
      current.gross_amount += Number(row.gross_amount);
      current.tds_amount += Number(row.tds_amount);
      current.other_deductions += Number(row.other_deductions);
      current.net_paid += Number(row.net_paid);
      current.settlements.push({
        id: row.id,
        settlement_number: row.settlement_number,
        period_from: row.period_from,
        period_to: row.period_to,
        vehicle_number: row.vehicle_number,
        total_trips: Number(row.total_trips),
        total_km: Number(row.total_km),
        gross_amount: Number(row.gross_amount),
        tds_amount: Number(row.tds_amount),
        other_deductions: Number(row.other_deductions),
        net_paid: Number(row.net_paid),
        payment_mode: row.payment_mode,
        reference_number: row.reference_number,
        status: row.status,
      });

      grouped.set(row.owner_id, current);
    }

    res.json(
      Array.from(grouped.values()).map((entry) => ({
        owner_id: entry.owner_id,
        owner_name: entry.owner_name,
        owner_code: entry.owner_code,
        vehicles: Array.from(entry.vehicles),
        total_trips: entry.total_trips,
        total_km: entry.total_km,
        gross_amount: entry.gross_amount,
        tds_amount: entry.tds_amount,
        other_deductions: entry.other_deductions,
        net_paid: entry.net_paid,
        payment_modes: Array.from(entry.payment_modes),
        reference_numbers: Array.from(entry.reference_numbers),
        settlements: entry.settlements,
      }))
    );
  } catch (error) {
    console.error('Fetching owner settlement report failed:', error);
    res.status(500).json({ message: 'Unable to fetch vendor settlement report.' });
  }
});

router.get('/driver-settlements', authRequired, async (req, res) => {
  const dateFrom = getQueryString(req.query.date_from);
  const dateTo = getQueryString(req.query.date_to);
  const status = getQueryString(req.query.status);
  const dateFilter = buildDateFilters(dateFrom, dateTo, 'ds.period_from', 'ds.period_to');
  const statusFilter = buildWhereClause([{ column: 'ds.status', value: status }], dateFilter.values.length);
  const values = [...dateFilter.values, ...statusFilter.values];
  const conditions = [dateFilter.clause.replace(/^WHERE /, ''), statusFilter.clause.replace(/^WHERE /, '')].filter(Boolean);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query<{
      id: string;
      settlement_number: string;
      period_from: string;
      period_to: string;
      total_trips: number;
      total_km: string;
      total_allowance: string;
      advances: string;
      deductions: string;
      net_paid: string;
      payment_mode: string | null;
      reference_number: string | null;
      status: string;
      driver_id: string;
      driver_name: string;
      driver_code: string;
    }>(
      `
        SELECT
          ds.id,
          ds.settlement_number,
          ds.period_from,
          ds.period_to,
          ds.total_trips,
          ds.total_km,
          ds.total_allowance,
          ds.advances,
          ds.deductions,
          ds.net_amount AS net_paid,
          ds.payment_mode,
          ds.reference_number,
          ds.status,
          d.id AS driver_id,
          d.name AS driver_name,
          d.driver_code
        FROM driver_settlements ds
        JOIN drivers d ON d.id = ds.driver_id
        ${whereClause}
        ORDER BY d.name ASC, ds.period_from DESC, ds.created_at DESC
      `,
      values
    );

    const grouped = new Map<string, {
      driver_id: string;
      driver_name: string;
      driver_code: string;
      total_trips: number;
      total_km: number;
      total_allowance: number;
      advances: number;
      deductions: number;
      net_paid: number;
      payment_modes: Set<string>;
      reference_numbers: Set<string>;
      settlements: Array<Record<string, unknown>>;
    }>();

    for (const row of result.rows) {
      const current = grouped.get(row.driver_id) ?? {
        driver_id: row.driver_id,
        driver_name: row.driver_name,
        driver_code: row.driver_code,
        total_trips: 0,
        total_km: 0,
        total_allowance: 0,
        advances: 0,
        deductions: 0,
        net_paid: 0,
        payment_modes: new Set<string>(),
        reference_numbers: new Set<string>(),
        settlements: [],
      };

      if (row.payment_mode) {
        current.payment_modes.add(row.payment_mode);
      }
      if (row.reference_number) {
        current.reference_numbers.add(row.reference_number);
      }

      current.total_trips += Number(row.total_trips);
      current.total_km += Number(row.total_km);
      current.total_allowance += Number(row.total_allowance);
      current.advances += Number(row.advances);
      current.deductions += Number(row.deductions);
      current.net_paid += Number(row.net_paid);
      current.settlements.push({
        id: row.id,
        settlement_number: row.settlement_number,
        period_from: row.period_from,
        period_to: row.period_to,
        total_trips: Number(row.total_trips),
        total_km: Number(row.total_km),
        total_allowance: Number(row.total_allowance),
        advances: Number(row.advances),
        deductions: Number(row.deductions),
        net_paid: Number(row.net_paid),
        payment_mode: row.payment_mode,
        reference_number: row.reference_number,
        status: row.status,
      });

      grouped.set(row.driver_id, current);
    }

    res.json(
      Array.from(grouped.values()).map((entry) => ({
        driver_id: entry.driver_id,
        driver_name: entry.driver_name,
        driver_code: entry.driver_code,
        total_trips: entry.total_trips,
        total_km: entry.total_km,
        total_allowance: entry.total_allowance,
        advances: entry.advances,
        deductions: entry.deductions,
        net_paid: entry.net_paid,
        payment_modes: Array.from(entry.payment_modes),
        reference_numbers: Array.from(entry.reference_numbers),
        settlements: entry.settlements,
      }))
    );
  } catch (error) {
    console.error('Fetching driver settlement report failed:', error);
    res.status(500).json({ message: 'Unable to fetch driver salary report.' });
  }
});

router.get('/collections', authRequired, async (req, res) => {
  const dateFrom = getQueryString(req.query.date_from);
  const dateTo = getQueryString(req.query.date_to);
  const paymentMode = getQueryString(req.query.payment_mode);
  const dateFilter = buildDateFilters(dateFrom, dateTo, 'col.collection_date');
  const modeFilter = buildWhereClause([{ column: 'col.payment_mode', value: paymentMode }], dateFilter.values.length);
  const values = [...dateFilter.values, ...modeFilter.values];
  const conditions = [dateFilter.clause.replace(/^WHERE /, ''), modeFilter.clause.replace(/^WHERE /, '')].filter(Boolean);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query<{
      id: string;
      collection_number: string;
      collection_date: string;
      invoice_number: string;
      customer_name: string;
      amount: string;
      payment_mode: string;
      bank_name: string | null;
      reference_number: string | null;
      remarks: string | null;
    }>(
      `
        SELECT
          col.id,
          col.collection_number,
          col.collection_date,
          inv.invoice_number,
          cust.name AS customer_name,
          col.amount,
          col.payment_mode,
          col.bank_name,
          col.reference_number,
          col.remarks
        FROM collections col
        JOIN invoices inv ON inv.id = col.invoice_id AND inv.invoice_status = 'active' AND inv.invoice_type = 'invoice'
        JOIN customers cust ON cust.id = inv.customer_id
        ${whereClause}
        ORDER BY col.collection_date DESC, col.created_at DESC
      `,
      values
    );

    const entries = result.rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
    }));

    const totalsByMode = new Map<string, number>();
    let totalCollected = 0;

    for (const entry of entries) {
      totalCollected += entry.amount;
      totalsByMode.set(entry.payment_mode, (totalsByMode.get(entry.payment_mode) ?? 0) + entry.amount);
    }

    res.json({
      entries,
      totals: {
        total_collected: totalCollected,
        by_mode: Array.from(totalsByMode.entries()).map(([mode, totalAmount]) => ({
          payment_mode: mode,
          total_amount: totalAmount,
        })),
      },
    });
  } catch (error) {
    console.error('Fetching collection register failed:', error);
    res.status(500).json({ message: 'Unable to fetch collection register.' });
  }
});

router.get('/customer-profitability', authRequired, async (req, res) => {
  const dateFrom = getQueryString(req.query.date_from);
  const dateTo = getQueryString(req.query.date_to);
  const invoiceFilter = buildDateFilters(dateFrom, dateTo, 'invoice_date');
  const filteredInvoiceClause = invoiceFilter.clause
    ? invoiceFilter.clause.replace(/^WHERE /, "WHERE invoice_status = 'active' AND invoice_type = 'invoice' AND ")
    : "WHERE invoice_status = 'active' AND invoice_type = 'invoice'";

  try {
    const result = await query<{
      customer_id: string;
      customer_name: string;
      customer_code: string;
      total_invoiced: string;
      total_collected: string;
      outstanding: string;
      total_expenses: string;
      net_income: string;
    }>(
      `
        WITH filtered_invoices AS (
          SELECT *
          FROM invoices
          ${filteredInvoiceClause}
        ),
        invoice_totals AS (
          SELECT customer_id, COALESCE(SUM(total_amount), 0) AS total_invoiced
          FROM filtered_invoices
          GROUP BY customer_id
        ),
        collection_totals AS (
          SELECT fi.customer_id, COALESCE(SUM(c.amount), 0) AS total_collected
          FROM filtered_invoices fi
          LEFT JOIN collections c ON c.invoice_id = fi.id
          GROUP BY fi.customer_id
        ),
        expense_totals AS (
          SELECT fi.customer_id, COALESCE(SUM(te.amount), 0) AS total_expenses
          FROM filtered_invoices fi
          LEFT JOIN invoice_items ii ON ii.invoice_id = fi.id
          LEFT JOIN trip_expenses te ON te.trip_id = ii.trip_id
          GROUP BY fi.customer_id
        )
        SELECT
          c.id AS customer_id,
          c.name AS customer_name,
          c.customer_code,
          COALESCE(it.total_invoiced, 0) AS total_invoiced,
          COALESCE(ct.total_collected, 0) AS total_collected,
          (COALESCE(it.total_invoiced, 0) - COALESCE(ct.total_collected, 0)) AS outstanding,
          COALESCE(et.total_expenses, 0) AS total_expenses,
          (COALESCE(it.total_invoiced, 0) - COALESCE(et.total_expenses, 0)) AS net_income
        FROM customers c
        JOIN invoice_totals it ON it.customer_id = c.id
        LEFT JOIN collection_totals ct ON ct.customer_id = c.id
        LEFT JOIN expense_totals et ON et.customer_id = c.id
        ORDER BY c.name ASC
      `,
      invoiceFilter.values
    );

    res.json(
      result.rows.map((row) => ({
        ...row,
        total_invoiced: Number(row.total_invoiced),
        total_collected: Number(row.total_collected),
        outstanding: Number(row.outstanding),
        total_expenses: Number(row.total_expenses),
        net_income: Number(row.net_income),
      }))
    );
  } catch (error) {
    console.error('Fetching customer profitability failed:', error);
    res.status(500).json({ message: 'Unable to fetch customer profitability report.' });
  }
});

export default router;
