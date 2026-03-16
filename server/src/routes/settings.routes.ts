import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleCheck } from '../middleware/auth';

const router = Router();

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query('SELECT * FROM system_settings ORDER BY setting_key ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching settings failed:', error);
    res.status(500).json({ message: 'Unable to fetch settings.' });
  }
});

router.put('/:key', authRequired, roleCheck(['admin']), async (req, res) => {
  const { setting_value, description } = req.body as { setting_value?: string; description?: string };

  if (setting_value === undefined) {
    res.status(400).json({ message: 'setting_value is required.' });
    return;
  }

  try {
    const result = await query(
      `
        UPDATE system_settings
        SET setting_value = $1, description = COALESCE($2, description), updated_by = $3, updated_at = now()
        WHERE setting_key = $4
        RETURNING *
      `,
      [setting_value, description ?? null, req.user?.id ?? null, req.params.key]
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Setting not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Updating setting failed:', error);
    res.status(500).json({ message: 'Unable to update setting.' });
  }
});

export default router;
