import { Router } from 'express';
import { getDb } from '../config/db-sqlite';
import { authRequired } from '../middleware/auth';

const router = Router();

router.get('/rates', authRequired, (_req, res) => {
  try {
    const rows = getDb().prepare('SELECT * FROM gst_rates WHERE is_active = 1 ORDER BY hsn_code ASC').all();
    res.json(rows);
  } catch (error) {
    console.error('Fetching GST rates failed:', error);
    res.status(500).json({ message: 'Unable to fetch GST rates.' });
  }
});

export default router;
