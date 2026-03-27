import { Router } from 'express';
import multer from 'multer';
import { ImportService } from '../import/service.js';
import { getPool } from '../config/db.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * POST /api/import/validate
 * Validate import file without importing
 */
router.post('/validate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileType = req.body.type as 'excel' | 'csv' | 'json';
    const entityType = req.body.entityType as string;

    if (!fileType) {
      return res.status(400).json({ error: 'File type is required' });
    }

    if (fileType === 'csv' && !entityType) {
      return res.status(400).json({ error: 'Entity type is required for CSV files' });
    }

    // Parse file
    const { parseImportFile } = await import('../import/parsers.js');
    const parseResult = await parseImportFile(req.file.buffer, fileType, entityType);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
      });
    }

    // Validate data
    const pool = getPool();
    const { ImportValidator } = await import('../import/validators.js');
    const validator = new ImportValidator(pool);
    const validationResults = await validator.validateAll(parseResult.data);

    res.json({
      success: true,
      data: parseResult.data,
      validation: validationResults,
      warnings: parseResult.warnings,
    });
  } catch (error: any) {
    console.error('Import validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/import/import
 * Import data from file
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileType = req.body.type as 'excel' | 'csv' | 'json';
    const entityType = req.body.entityType as string;

    if (!fileType) {
      return res.status(400).json({ error: 'File type is required' });
    }

    if (fileType === 'csv' && !entityType) {
      return res.status(400).json({ error: 'Entity type is required for CSV files' });
    }

    const pool = getPool();
    const importService = new ImportService(pool);

    // Run import (in production, this should be a background job with WebSocket updates)
    const result = await importService.importData(
      req.file.buffer,
      fileType,
      entityType,
      (progress) => {
        // In production, emit progress via WebSocket
        console.log(`Import progress: ${progress.progress}% - ${progress.message}`);
      }
    );

    if (result.stage === 'failed') {
      return res.status(400).json({
        success: false,
        message: result.message,
        errors: result.errors,
        warnings: result.warnings,
      });
    }

    res.json({
      success: true,
      message: result.message,
      imported: result.imported,
      warnings: result.warnings,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/import/template/:entityType
 * Get import template for download
 */
router.get('/template/:entityType', async (req, res) => {
  try {
    const { entityType } = req.params;

    const pool = getPool();
    const importService = new ImportService(pool);
    const template = importService.getTemplate(entityType);

    if (!template || template.length === 0) {
      return res.status(404).json({ error: 'Unknown entity type' });
    }

    res.json({
      success: true,
      entityType,
      template,
    });
  } catch (error: any) {
    console.error('Template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/import/templates
 * List available import templates
 */
router.get('/templates', (_req, res) => {
  res.json({
    success: true,
    templates: [
      {
        id: 'customers',
        name: 'Customers',
        description: 'Import customer master data',
        fields: [
          'customer_code', 'name', 'contact_person', 'phone', 'email',
          'address', 'city', 'state', 'pincode', 'gstin', 'pan',
          'credit_limit', 'credit_days'
        ],
      },
      {
        id: 'vehicles',
        name: 'Vehicles',
        description: 'Import vehicle master data',
        fields: [
          'vehicle_number', 'vehicle_type', 'make', 'model', 'year',
          'seating_capacity', 'owner_code', 'is_owned'
        ],
      },
      {
        id: 'drivers',
        name: 'Drivers',
        description: 'Import driver master data',
        fields: [
          'driver_code', 'name', 'phone', 'email', 'license_number',
          'license_expiry', 'address', 'city', 'state', 'date_of_birth',
          'blood_group', 'emergency_contact', 'emergency_phone'
        ],
      },
      {
        id: 'owners',
        name: 'Vehicle Owners',
        description: 'Import vehicle owner master data',
        fields: [
          'code', 'name', 'phone', 'email', 'address', 'city', 'state',
          'pincode', 'gstin', 'pan', 'aadhar_number'
        ],
      },
      {
        id: 'ratecharts',
        name: 'Rate Charts',
        description: 'Import rate chart data',
        fields: [
          'customer_code', 'name', 'vehicle_category_name', 'duty_type',
          'base_hours', 'base_km', 'base_amount', 'extra_km_rate',
          'extra_hr_rate', 'night_halt_rate'
        ],
      },
    ],
  });
});

export default router;
