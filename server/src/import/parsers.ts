import * as XLSX from 'xlsx';
import { CompanySettings } from '../license/db.js';

export interface ParsedImportData {
  customers?: ImportedCustomer[];
  vehicles?: ImportedVehicle[];
  drivers?: ImportedDriver[];
  owners?: ImportedOwner[];
  rateCharts?: ImportedRateChart[];
}

export interface ImportedCustomer {
  customer_code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  credit_limit?: number;
  credit_days?: number;
}

export interface ImportedVehicle {
  vehicle_number: string;
  vehicle_type: string;
  make?: string;
  model?: string;
  year?: number;
  seating_capacity?: number;
  owner_code?: string;
  is_owned?: boolean;
}

export interface ImportedDriver {
  driver_code: string;
  name: string;
  phone: string;
  license_number: string;
  license_expiry: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  date_of_birth?: string;
  blood_group?: string;
  emergency_contact?: string;
  emergency_phone?: string;
}

export interface ImportedOwner {
  code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  aadhar_number?: string;
}

export interface ImportedRateChart {
  customer_code: string;
  name: string;
  vehicle_category_name: string;
  duty_type: string;
  base_hours?: number;
  base_km?: number;
  base_amount?: number;
  extra_km_rate?: number;
  extra_hr_rate?: number;
  night_halt_rate?: number;
}

export type ImportFileType = 'excel' | 'csv' | 'json';

export interface ImportResult {
  success: boolean;
  data: ParsedImportData;
  errors: string[];
  warnings: string[];
  rowCount: number;
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
export async function parseExcelFile(buffer: Buffer): Promise<ImportResult> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const result: ImportResult = {
      success: true,
      data: {},
      errors: [],
      warnings: [],
      rowCount: 0,
    };

    // Process each sheet
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      result.rowCount += rawData.length;

      // Route data based on sheet name
      switch (sheetName.toLowerCase()) {
        case 'customers':
        case 'customer':
          result.data.customers = rawData as ImportedCustomer[];
          break;
        case 'vehicles':
        case 'vehicle':
          result.data.vehicles = rawData as ImportedVehicle[];
          break;
        case 'drivers':
        case 'driver':
          result.data.drivers = rawData as ImportedDriver[];
          break;
        case 'owners':
        case 'owner':
          result.data.owners = rawData as ImportedOwner[];
          break;
        case 'ratecharts':
        case 'ratecharts':
        case 'rate_charts':
          result.data.rateCharts = rawData as ImportedRateChart[];
          break;
        default:
          result.warnings.push(`Unknown sheet "${sheetName}" skipped`);
      }
    });

    if (Object.keys(result.data).length === 0) {
      result.success = false;
      result.errors.push('No recognized sheets found. Expected: customers, vehicles, drivers, owners, ratecharts');
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      data: {},
      errors: [`Excel parsing failed: ${error.message}`],
      warnings: [],
      rowCount: 0,
    };
  }
}

/**
 * Parse CSV file
 * Assumes first row indicates entity type or we auto-detect from columns
 */
export async function parseCsvFile(content: string, entityType: string): Promise<ImportResult> {
  try {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return {
        success: false,
        data: {},
        errors: ['CSV file is empty or has no data rows'],
        warnings: [],
        rowCount: 0,
      };
    }

    // Parse header and rows
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });

    const result: ImportResult = {
      success: true,
      data: {},
      errors: [],
      warnings: [],
      rowCount: rows.length,
    };

    // Assign data based on entity type
    switch (entityType.toLowerCase()) {
      case 'customers':
        result.data.customers = rows as ImportedCustomer[];
        break;
      case 'vehicles':
        result.data.vehicles = rows as ImportedVehicle[];
        break;
      case 'drivers':
        result.data.drivers = rows as ImportedDriver[];
        break;
      case 'owners':
        result.data.owners = rows as ImportedOwner[];
        break;
      case 'ratecharts':
        result.data.rateCharts = rows as ImportedRateChart[];
        break;
      default:
        result.success = false;
        result.errors.push(`Unknown entity type: ${entityType}`);
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      data: {},
      errors: [`CSV parsing failed: ${error.message}`],
      warnings: [],
      rowCount: 0,
    };
  }
}

/**
 * Parse JSON file
 * Expected structure: { customers: [], vehicles: [], ... }
 */
export async function parseJsonFile(content: string): Promise<ImportResult> {
  try {
    const jsonData = JSON.parse(content);
    const result: ImportResult = {
      success: true,
      data: {},
      errors: [],
      warnings: [],
      rowCount: 0,
    };

    // Extract arrays
    if (jsonData.customers && Array.isArray(jsonData.customers)) {
      result.data.customers = jsonData.customers as ImportedCustomer[];
      result.rowCount += jsonData.customers.length;
    }
    if (jsonData.vehicles && Array.isArray(jsonData.vehicles)) {
      result.data.vehicles = jsonData.vehicles as ImportedVehicle[];
      result.rowCount += jsonData.vehicles.length;
    }
    if (jsonData.drivers && Array.isArray(jsonData.drivers)) {
      result.data.drivers = jsonData.drivers as ImportedDriver[];
      result.rowCount += jsonData.drivers.length;
    }
    if (jsonData.owners && Array.isArray(jsonData.owners)) {
      result.data.owners = jsonData.owners as ImportedOwner[];
      result.rowCount += jsonData.owners.length;
    }
    if (jsonData.rateCharts && Array.isArray(jsonData.rateCharts)) {
      result.data.rateCharts = jsonData.rateCharts as ImportedRateChart[];
      result.rowCount += jsonData.rateCharts.length;
    }

    if (Object.keys(result.data).length === 0) {
      result.success = false;
      result.errors.push('No valid data arrays found in JSON. Expected: customers, vehicles, drivers, owners, rateCharts');
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      data: {},
      errors: [`JSON parsing failed: ${error.message}`],
      warnings: [],
      rowCount: 0,
    };
  }
}

/**
 * Main parser router - detects file type and routes to appropriate parser
 */
export async function parseImportFile(
  buffer: Buffer,
  fileType: ImportFileType,
  entityType?: string
): Promise<ImportResult> {
  switch (fileType) {
    case 'excel':
      return parseExcelFile(buffer);
    case 'csv':
      if (!entityType) {
        return {
          success: false,
          data: {},
          errors: ['Entity type is required for CSV imports'],
          warnings: [],
          rowCount: 0,
        };
      }
      return parseCsvFile(buffer.toString(), entityType);
    case 'json':
      return parseJsonFile(buffer.toString());
    default:
      return {
        success: false,
        data: {},
        errors: [`Unsupported file type: ${fileType}`],
        warnings: [],
        rowCount: 0,
      };
  }
}
