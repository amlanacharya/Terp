import { Router } from 'express';
import { query } from '../config/db';

const router = Router();

// Validate import data
router.post('/validate/:entityType', async (req, res) => {
  const { entityType } = req.params;
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  try {
    const errors = validateImportData(entityType, data);
    res.json({ valid: errors.length === 0, errors });
  } catch (error) {
    console.error('Validation failed:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

// Import data
router.post('/:entityType', async (req, res) => {
  const { entityType } = req.params;
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  try {
    const result = await importData(entityType, data);
    res.json({ success: true, imported: result.imported, errors: result.errors });
  } catch (error) {
    console.error('Import failed:', error);
    res.status(500).json({ error: 'Import failed' });
  }
});

function validateImportData(entityType: string, data: any[]): any[] {
  const errors: any[] = [];

  // Validation logic for each entity type
  switch (entityType) {
    case 'customers':
      data.forEach((row, index) => {
        if (!row.customer_code) errors.push({ row: index + 1, field: 'customer_code', error: 'Required' });
        if (!row.name) errors.push({ row: index + 1, field: 'name', error: 'Required' });
        if (!row.phone) errors.push({ row: index + 1, field: 'phone', error: 'Required' });
        if (!row.email) errors.push({ row: index + 1, field: 'email', error: 'Required' });
      });
      break;

    case 'vehicles':
      data.forEach((row, index) => {
        if (!row.vehicle_number) errors.push({ row: index + 1, field: 'vehicle_number', error: 'Required' });
        if (!row.vehicle_type) errors.push({ row: index + 1, field: 'vehicle_type', error: 'Required' });
        if (!row.category) errors.push({ row: index + 1, field: 'category', error: 'Required' });
        if (!row.owner_code) errors.push({ row: index + 1, field: 'owner_code', error: 'Required' });
      });
      break;

    case 'drivers':
      data.forEach((row, index) => {
        if (!row.driver_code) errors.push({ row: index + 1, field: 'driver_code', error: 'Required' });
        if (!row.name) errors.push({ row: index + 1, field: 'name', error: 'Required' });
        if (!row.phone) errors.push({ row: index + 1, field: 'phone', error: 'Required' });
        if (!row.license_number) errors.push({ row: index + 1, field: 'license_number', error: 'Required' });
      });
      break;

    case 'owners':
      data.forEach((row, index) => {
        if (!row.owner_code) errors.push({ row: index + 1, field: 'owner_code', error: 'Required' });
        if (!row.name) errors.push({ row: index + 1, field: 'name', error: 'Required' });
        if (!row.phone) errors.push({ row: index + 1, field: 'phone', error: 'Required' });
      });
      break;

    case 'rateCharts':
      data.forEach((row, index) => {
        if (!row.customer_code) errors.push({ row: index + 1, field: 'customer_code', error: 'Required' });
        if (!row.vehicle_category) errors.push({ row: index + 1, field: 'vehicle_category', error: 'Required' });
        if (!row.duty_type) errors.push({ row: index + 1, field: 'duty_type', error: 'Required' });
        if (!row.base_rate) errors.push({ row: index + 1, field: 'base_rate', error: 'Required' });
      });
      break;
  }

  return errors;
}

async function importData(entityType: string, data: any[]): Promise<{ imported: number; errors: any[] }> {
  let imported = 0;
  const errors: any[] = [];

  try {
    await query('BEGIN', []);

    for (const row of data) {
      try {
        switch (entityType) {
          case 'customers':
            await query(
              `INSERT INTO customers (customer_code, name, contact_person, phone, email, address, city, state, pincode, gstin, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW())
               ON CONFLICT (customer_code) DO NOTHING`,
              [row.customer_code, row.name, row.contact_person || null, row.phone, row.email, row.address, row.city, row.state, row.pincode, row.gstin || null]
            );
            imported++;
            break;

          case 'vehicles':
            await query(
              `INSERT INTO vehicles (vehicle_number, vehicle_type, category, model, year, capacity, owner_code, fuel_type, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
               ON CONFLICT (vehicle_number) DO NOTHING`,
              [row.vehicle_number.toUpperCase(), row.vehicle_type, row.category, row.model || null, row.year || null, row.capacity || null, row.owner_code, row.fuel_type || null]
            );
            imported++;
            break;

          case 'drivers':
            await query(
              `INSERT INTO drivers (driver_code, name, phone, alternate_phone, license_number, license_valid_until, address, city, state, pincode, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW())
               ON CONFLICT (driver_code) DO NOTHING`,
              [row.driver_code, row.name, row.phone, row.alternate_phone || null, row.license_number, row.license_valid_until || null, row.address, row.city, row.state, row.pincode]
            );
            imported++;
            break;

          case 'owners':
            await query(
              `INSERT INTO owners (owner_code, name, contact_person, phone, alternate_phone, email, address, city, state, pincode, gstin, pan, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), NOW())
               ON CONFLICT (owner_code) DO NOTHING`,
              [row.owner_code, row.name, row.contact_person || null, row.phone, row.alternate_phone || null, row.email || null, row.address, row.city, row.state, row.pincode, row.gstin || null, row.pan || null]
            );
            imported++;
            break;

          case 'rateCharts':
            await query(
              `INSERT INTO rate_charts (customer_code, vehicle_category, duty_type, base_km, base_hrs, base_rate, extra_km_rate, extra_hr_rate, night_halt_charge, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
               ON CONFLICT (customer_code, vehicle_category, duty_type) DO NOTHING`,
              [row.customer_code, row.vehicle_category, row.duty_type, row.base_km || 80, row.base_hrs || 8, row.base_rate, row.extra_km_rate || null, row.extra_hr_rate || null, row.night_halt_charge || null]
            );
            imported++;
            break;
        }
      } catch (error) {
        errors.push({ row, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    await query('COMMIT', []);

    return { imported, errors };
  } catch (error) {
    await query('ROLLBACK', []);
    throw error;
  }
}

export default router;
