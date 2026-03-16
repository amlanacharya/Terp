import { Router } from 'express';
import { query } from '../config/db';
import { authRequired } from '../middleware/auth';

const router = Router();

router.get('/stats', authRequired, async (_req, res) => {
  try {
    const [trips, drivers, vehicles, customers, invoices] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM trips'),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM drivers'),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM vehicles'),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM customers'),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM invoices'),
    ]);

    res.json({
      trips: Number(trips.rows[0].count),
      drivers: Number(drivers.rows[0].count),
      vehicles: Number(vehicles.rows[0].count),
      customers: Number(customers.rows[0].count),
      invoices: Number(invoices.rows[0].count),
    });
  } catch (error) {
    console.error('Dashboard stats failed:', error);
    res.status(500).json({ message: 'Unable to load dashboard statistics.' });
  }
});

export default router;
