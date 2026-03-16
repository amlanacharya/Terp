import { Router } from 'express';
import { query } from '../config/db';
import { authRequired } from '../middleware/auth';

const router = Router();

router.get('/', authRequired, async (_req, res) => {
  try {
    const [invoiceTotals, collectionTotals, driverTotals, ownerTotals, tripStatus] = await Promise.all([
      query<{ total: string }>('SELECT COALESCE(SUM(total_amount), 0)::text AS total FROM invoices'),
      query<{ total: string }>('SELECT COALESCE(SUM(amount), 0)::text AS total FROM collections'),
      query<{ total: string }>('SELECT COALESCE(SUM(net_amount), 0)::text AS total FROM driver_settlements'),
      query<{ total: string }>('SELECT COALESCE(SUM(net_amount), 0)::text AS total FROM owner_settlements'),
      query<{ status: string; count: string }>('SELECT status::text AS status, COUNT(*)::text AS count FROM trips GROUP BY status'),
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

export default router;
