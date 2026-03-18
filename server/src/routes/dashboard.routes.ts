import { Router } from 'express';
import { query } from '../config/db';
import { authRequired } from '../middleware/auth';

const router = Router();

router.get('/stats', authRequired, async (_req, res) => {
  try {
    const [trips, drivers, vehicles, customers, invoices, financials, outstandingInvoices] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM trips'),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM drivers'),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM vehicles'),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM customers'),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM invoices WHERE invoice_status = 'active' AND invoice_type = 'invoice'"),
      query<{ invoiced_amount: string; collected_amount: string }>(
        `
          SELECT
            COALESCE((SELECT SUM(total_amount) FROM invoices WHERE invoice_status = 'active' AND invoice_type = 'invoice'), 0)::text AS invoiced_amount,
            COALESCE((
              SELECT SUM(col.amount)
              FROM collections col
              JOIN invoices inv ON inv.id = col.invoice_id
              WHERE inv.invoice_type = 'invoice'
            ), 0)::text AS collected_amount
        `
      ),
      query(
        `
          SELECT
            i.id,
            i.invoice_number,
            i.invoice_date,
            i.due_date,
            i.total_amount,
            i.payment_status,
            json_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code) AS customer
          FROM invoices i
          JOIN customers c ON c.id = i.customer_id
          WHERE i.invoice_status = 'active'
            AND i.invoice_type = 'invoice'
            AND i.payment_status IN ('pending', 'partial', 'overdue')
          ORDER BY COALESCE(i.due_date, i.invoice_date) ASC, i.created_at DESC
          LIMIT 10
        `
      ),
    ]);

    const invoicedAmount = Number(financials.rows[0].invoiced_amount);
    const collectedAmount = Number(financials.rows[0].collected_amount);

    res.json({
      trips: Number(trips.rows[0].count),
      drivers: Number(drivers.rows[0].count),
      vehicles: Number(vehicles.rows[0].count),
      customers: Number(customers.rows[0].count),
      invoices: Number(invoices.rows[0].count),
      invoicedAmount,
      collectedAmount,
      outstandingAmount: invoicedAmount - collectedAmount,
      recentOutstandingInvoices: outstandingInvoices.rows,
    });
  } catch (error) {
    console.error('Dashboard stats failed:', error);
    res.status(500).json({ message: 'Unable to load dashboard statistics.' });
  }
});

export default router;
