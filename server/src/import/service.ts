import { Pool } from 'pg';
import { parseImportFile, ImportFileType, ParsedImportData, ImportResult } from './parsers.js';
import { ImportValidator } from './validators.js';

export interface ImportProgress {
  stage: 'parsing' | 'validating' | 'importing' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  imported: {
    customers: number;
    vehicles: number;
    drivers: number;
    owners: number;
    rateCharts: number;
  };
  errors: string[];
  warnings: string[];
}

export class ImportService {
  constructor(private pool: Pool) {}

  /**
   * Main import method - orchestrates the entire import process
   */
  async importData(
    buffer: Buffer,
    fileType: ImportFileType,
    entityType?: string,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportProgress> {
    const result: ImportProgress = {
      stage: 'parsing',
      progress: 0,
      message: 'Parsing file...',
      imported: { customers: 0, vehicles: 0, drivers: 0, owners: 0, rateCharts: 0 },
      errors: [],
      warnings: [],
    };

    try {
      // Stage 1: Parse
      onProgress?.(result);
      const parseResult: ImportResult = await parseImportFile(buffer, fileType, entityType);

      if (!parseResult.success) {
        result.stage = 'failed';
        result.message = 'Parsing failed';
        result.errors = parseResult.errors;
        result.warnings = parseResult.warnings;
        return result;
      }

      result.progress = 20;
      result.message = 'Validating data...';

      // Stage 2: Validate
      result.stage = 'validating';
      onProgress?.(result);

      const validator = new ImportValidator(this.pool);
      const validationResults = await validator.validateAll(parseResult.data);

      // Collect all errors and warnings
      Object.entries(validationResults).forEach(([entity, validation]) => {
        validation.errors.forEach(err => {
          result.errors.push(`${entity}: Row ${err.row} - ${err.field}: ${err.message}`);
        });
        validation.warnings.forEach(warn => {
          result.warnings.push(`${entity}: Row ${warn.row} - ${warn.field}: ${warn.message}`);
        });
      });

      const hasErrors = Object.values(validationResults).some(v => !v.valid);
      if (hasErrors) {
        result.stage = 'failed';
        result.message = 'Validation failed';
        return result;
      }

      result.progress = 40;
      result.message = 'Importing data...';

      // Stage 3: Import
      result.stage = 'importing';
      onProgress?.(result);

      // Import in transaction
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Import entities in order (dependencies first)
        if (parseResult.data.owners?.length) {
          const count = await this.importOwners(client, parseResult.data.owners);
          result.imported.owners = count;
          result.progress = 50;
          onProgress?.(result);
        }

        if (parseResult.data.customers?.length) {
          const count = await this.importCustomers(client, parseResult.data.customers);
          result.imported.customers = count;
          result.progress = 65;
          onProgress?.(result);
        }

        if (parseResult.data.vehicles?.length) {
          const count = await this.importVehicles(client, parseResult.data.vehicles);
          result.imported.vehicles = count;
          result.progress = 75;
          onProgress?.(result);
        }

        if (parseResult.data.drivers?.length) {
          const count = await this.importDrivers(client, parseResult.data.drivers);
          result.imported.drivers = count;
          result.progress = 85;
          onProgress?.(result);
        }

        if (parseResult.data.rateCharts?.length) {
          const count = await this.importRateCharts(client, parseResult.data.rateCharts);
          result.imported.rateCharts = count;
          result.progress = 95;
          onProgress?.(result);
        }

        await client.query('COMMIT');

        result.stage = 'completed';
        result.progress = 100;
        result.message = 'Import completed successfully';

        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      result.stage = 'failed';
      result.message = `Import failed: ${error.message}`;
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Import owners
   */
  private async importOwners(client: any, owners: any[]): Promise<number> {
    let count = 0;
    for (const owner of owners) {
      await client.query(
        `INSERT INTO owners (
          id, code, name, phone, email, address, city, state, pincode,
          gstin, pan, aadhar_number, is_active, created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW()
        )`,
        [
          owner.code,
          owner.name,
          owner.phone || null,
          owner.email || null,
          owner.address || null,
          owner.city || null,
          owner.state || null,
          owner.pincode || null,
          owner.gstin || null,
          owner.pan || null,
          owner.aadhar_number || null,
        ]
      );
      count++;
    }
    return count;
  }

  /**
   * Import customers
   */
  private async importCustomers(client: any, customers: any[]): Promise<number> {
    let count = 0;
    for (const customer of customers) {
      await client.query(
        `INSERT INTO customers (
          id, customer_code, name, contact_person, phone, email,
          address, city, state, pincode, gstin, pan,
          credit_limit, credit_days, is_active, created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW(), NOW()
        )`,
        [
          customer.customer_code,
          customer.name,
          customer.contact_person || null,
          customer.phone || null,
          customer.email || null,
          customer.address || null,
          customer.city || null,
          customer.state || null,
          customer.pincode || null,
          customer.gstin || null,
          customer.pan || null,
          customer.credit_limit || 0,
          customer.credit_days || 0,
        ]
      );
      count++;
    }
    return count;
  }

  /**
   * Import vehicles
   */
  private async importVehicles(client: any, vehicles: any[]): Promise<number> {
    let count = 0;
    for (const vehicle of vehicles) {
      // Get owner ID if owner_code is provided
      let ownerId = null;
      if (vehicle.owner_code) {
        const ownerResult = await client.query(
          'SELECT id FROM owners WHERE code = $1',
          [vehicle.owner_code]
        );
        if (ownerResult.rows.length > 0) {
          ownerId = ownerResult.rows[0].id;
        }
      }

      await client.query(
        `INSERT INTO vehicles (
          id, vehicle_number, vehicle_type, make, model, year, seating_capacity,
          is_owned, owner_id, is_active, created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW()
        )`,
        [
          vehicle.vehicle_number.toUpperCase(),
          vehicle.vehicle_type,
          vehicle.make || null,
          vehicle.model || null,
          vehicle.year || null,
          vehicle.seating_capacity || null,
          vehicle.is_owned !== undefined ? vehicle.is_owned : true,
          ownerId,
        ]
      );
      count++;
    }
    return count;
  }

  /**
   * Import drivers
   */
  private async importDrivers(client: any, drivers: any[]): Promise<number> {
    let count = 0;
    for (const driver of drivers) {
      await client.query(
        `INSERT INTO drivers (
          id, driver_code, name, phone, email, address, city, state,
          license_number, license_expiry, date_of_birth, blood_group,
          emergency_contact, emergency_phone, is_active, created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW(), NOW()
        )`,
        [
          driver.driver_code,
          driver.name,
          driver.phone,
          driver.email || null,
          driver.address || null,
          driver.city || null,
          driver.state || null,
          driver.license_number,
          driver.license_expiry,
          driver.date_of_birth || null,
          driver.blood_group || null,
          driver.emergency_contact || null,
          driver.emergency_phone || null,
        ]
      );
      count++;
    }
    return count;
  }

  /**
   * Import rate charts
   */
  private async importRateCharts(client: any, rateCharts: any[]): Promise<number> {
    let count = 0;
    const chartMap = new Map<string, string>(); // Maps (customer_code + name) to ID

    for (const chart of rateCharts) {
      const key = `${chart.customer_code}-${chart.name}`;

      // Get customer ID
      const customerResult = await client.query(
        'SELECT id FROM customers WHERE customer_code = $1',
        [chart.customer_code]
      );
      if (customerResult.rows.length === 0) {
        throw new Error(`Customer "${chart.customer_code}" not found`);
      }
      const customerId = customerResult.rows[0].id;

      // Get or create rate chart
      let rateChartId = chartMap.get(key);
      if (!rateChartId) {
        const chartResult = await client.query(
          `INSERT INTO rate_charts (
            id, customer_id, name, effective_from, is_active, created_at, updated_at
          ) VALUES (
            uuid_generate_v4(), $1, $2, CURRENT_DATE, true, NOW(), NOW()
          ) RETURNING id`,
          [customerId, chart.name]
        );
        rateChartId = chartResult.rows[0].id;
        chartMap.set(key, rateChartId);
      }

      // Get vehicle category ID
      const categoryResult = await client.query(
        'SELECT id FROM vehicle_categories WHERE name = $1',
        [chart.vehicle_category_name]
      );
      if (categoryResult.rows.length === 0) {
        // Create vehicle category if it doesn't exist
        const newCategoryResult = await client.query(
          `INSERT INTO vehicle_categories (id, name, is_active, created_at, updated_at)
           VALUES (uuid_generate_v4(), $1, true, NOW(), NOW()) RETURNING id`,
          [chart.vehicle_category_name]
        );
        // @ts-ignore
        var categoryId = newCategoryResult.rows[0].id;
      } else {
        // @ts-ignore
        var categoryId = categoryResult.rows[0].id;
      }

      // Create rate chart item
      await client.query(
        `INSERT INTO rate_chart_items (
          id, rate_chart_id, vehicle_category_id, duty_type,
          package_code, package_label, sort_order, is_default,
          base_hours, base_km, base_amount,
          extra_km_rate, extra_hr_rate, night_halt_rate,
          created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3,
          'IMPORT', 'Imported Rate', 1, true,
          $4, $5, $6, $7, $8, $9, NOW(), NOW()
        )`,
        [
          rateChartId,
          categoryId,
          chart.duty_type,
          chart.base_hours || null,
          chart.base_km || null,
          chart.base_amount || null,
          chart.extra_km_rate || null,
          chart.extra_hr_rate || null,
          chart.night_halt_rate || null,
        ]
      );

      count++;
    }
    return count;
  }

  /**
   * Get import template for download
   */
  getTemplate(entityType: string): any {
    const templates: Record<string, any[]> = {
      customers: [
        {
          customer_code: 'CUST001',
          name: 'Example Customer Pvt Ltd',
          contact_person: 'John Doe',
          phone: '+91 98765 43210',
          email: 'contact@example.com',
          address: '123 Main Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          gstin: '27AABCU9603R1ZN',
          pan: 'AABCU9603R',
          credit_limit: 100000,
          credit_days: 30,
        },
      ],
      vehicles: [
        {
          vehicle_number: 'MH01AB1234',
          vehicle_type: 'Sedan',
          make: 'Maruti Suzuki',
          model: 'Dzire',
          year: 2022,
          seating_capacity: 4,
          owner_code: 'OWNER001',
          is_owned: false,
        },
      ],
      drivers: [
        {
          driver_code: 'DRV001',
          name: 'Raj Kumar',
          phone: '+91 98765 43211',
          email: 'raj.driver@example.com',
          license_number: 'DL-012012000123',
          license_expiry: '2025-12-31',
          address: '456 Driver Colony',
          city: 'Delhi',
          state: 'Delhi',
        },
      ],
      owners: [
        {
          code: 'OWNER001',
          name: 'XYZ Fleet Services',
          phone: '+91 98765 43212',
          email: 'fleet@xyz.com',
          address: '789 Fleet Street',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
          gstin: '29ABCDE1234F1Z5',
          pan: 'ABCDE1234F',
        },
      ],
      ratecharts: [
        {
          customer_code: 'CUST001',
          name: 'Standard Local Rates',
          vehicle_category_name: 'Sedan',
          duty_type: 'local',
          base_hours: 8,
          base_km: 80,
          base_amount: 3000,
          extra_km_rate: 18,
          extra_hr_rate: 180,
          night_halt_rate: 500,
        },
      ],
    };

    return templates[entityType] || [];
  }
}
