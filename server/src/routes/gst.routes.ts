import { Router } from 'express';
import { query } from '../config/db';
import { authRequired } from '../middleware/auth';

const router = Router();

router.get('/rates', authRequired, async (_req, res) => {
  try {
    const result = await query('SELECT * FROM gst_rates WHERE is_active = true ORDER BY hsn_code ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching GST rates failed:', error);
    res.status(500).json({ message: 'Unable to fetch GST rates.' });
  }
});

export default router;
