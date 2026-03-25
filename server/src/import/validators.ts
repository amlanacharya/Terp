import { Pool } from 'pg';
import {
  ImportedCustomer,
  ImportedVehicle,
  ImportedDriver,
  ImportedOwner,
  ImportedRateChart,
  ParsedImportData,
} from './parsers.js';

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
}

export class ImportValidator {
  constructor(private pool: Pool) {}

  /**
   * Validate all imported data
   */
  async validateAll(data: ParsedImportData): Promise<{
    customers: ValidationResult;
    vehicles: ValidationResult;
    drivers: ValidationResult;
    owners: ValidationResult;
    rateCharts: ValidationResult;
  }> {
    const results = {
      customers: data.customers ? await this.validateCustomers(data.customers) : this.emptyResult(),
      vehicles: data.vehicles ? await this.validateVehicles(data.vehicles) : this.emptyResult(),
      drivers: data.drivers ? await this.validateDrivers(data.drivers) : this.emptyResult(),
      owners: data.owners ? await this.validateOwners(data.owners) : this.emptyResult(),
      rateCharts: data.rateCharts ? await this.validateRateCharts(data.rateCharts) : this.emptyResult(),
    };

    return results;
  }

  /**
   * Validate customers
   */
  async validateCustomers(customers: ImportedCustomer[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const existingCodes = await this.getExistingCustomerCodes();

    customers.forEach((customer, index) => {
      // Required fields
      if (!customer.customer_code?.trim()) {
        errors.push({
          row: index + 1,
          field: 'customer_code',
          message: 'Customer code is required',
          severity: 'error',
        });
      } else if (existingCodes.includes(customer.customer_code)) {
        errors.push({
          row: index + 1,
          field: 'customer_code',
          message: `Customer code "${customer.customer_code}" already exists`,
          severity: 'error',
        });
      }

      if (!customer.name?.trim()) {
        errors.push({
          row: index + 1,
          field: 'name',
          message: 'Customer name is required',
          severity: 'error',
        });
      }

      // Email validation
      if (customer.email && !this.isValidEmail(customer.email)) {
        warnings.push({
          row: index + 1,
          field: 'email',
          message: 'Invalid email format',
          severity: 'warning',
        });
      }

      // GSTIN validation
      if (customer.gstin && !this.isValidGSTIN(customer.gstin)) {
        warnings.push({
          row: index + 1,
          field: 'gstin',
          message: 'GSTIN format may be invalid (expected 15 characters)',
          severity: 'warning',
        });
      }

      // Credit defaults
      if (!customer.credit_limit || customer.credit_limit <= 0) {
        warnings.push({
          row: index + 1,
          field: 'credit_limit',
          message: 'Credit limit not set, will default to 0',
          severity: 'warning',
        });
      }

      if (!customer.credit_days || customer.credit_days < 0) {
        warnings.push({
          row: index + 1,
          field: 'credit_days',
          message: 'Credit days not set, will default to 0',
          severity: 'warning',
        });
      }
    });

    return this.buildResult(errors, warnings, customers.length);
  }

  /**
   * Validate vehicles
   */
  async validateVehicles(vehicles: ImportedVehicle[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const existingNumbers = await this.getExistingVehicleNumbers();
    const existingOwnerCodes = await this.getExistingOwnerCodes();

    vehicles.forEach((vehicle, index) => {
      if (!vehicle.vehicle_number?.trim()) {
        errors.push({
          row: index + 1,
          field: 'vehicle_number',
          message: 'Vehicle number is required',
          severity: 'error',
        });
      } else if (existingNumbers.includes(vehicle.vehicle_number.toUpperCase())) {
        errors.push({
          row: index + 1,
          field: 'vehicle_number',
          message: `Vehicle number "${vehicle.vehicle_number}" already exists`,
          severity: 'error',
        });
      }

      if (!vehicle.vehicle_type?.trim()) {
        errors.push({
          row: index + 1,
          field: 'vehicle_type',
          message: 'Vehicle type is required',
          severity: 'error',
        });
      }

      // Owner validation
      if (vehicle.owner_code && !existingOwnerCodes.includes(vehicle.owner_code)) {
        warnings.push({
          row: index + 1,
          field: 'owner_code',
          message: `Owner code "${vehicle.owner_code}" does not exist`,
          severity: 'warning',
        });
      }

      // Year validation
      if (vehicle.year && (vehicle.year < 1990 || vehicle.year > new Date().getFullYear() + 1)) {
        warnings.push({
          row: index + 1,
          field: 'year',
          message: 'Vehicle year seems unusual',
          severity: 'warning',
        });
      }
    });

    return this.buildResult(errors, warnings, vehicles.length);
  }

  /**
   * Validate drivers
   */
  async validateDrivers(drivers: ImportedDriver[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const existingCodes = await this.getExistingDriverCodes();

    drivers.forEach((driver, index) => {
      if (!driver.driver_code?.trim()) {
        errors.push({
          row: index + 1,
          field: 'driver_code',
          message: 'Driver code is required',
          severity: 'error',
        });
      } else if (existingCodes.includes(driver.driver_code)) {
        errors.push({
          row: index + 1,
          field: 'driver_code',
          message: `Driver code "${driver.driver_code}" already exists`,
          severity: 'error',
        });
      }

      if (!driver.name?.trim()) {
        errors.push({
          row: index + 1,
          field: 'name',
          message: 'Driver name is required',
          severity: 'error',
        });
      }

      if (!driver.phone?.trim()) {
        errors.push({
          row: index + 1,
          field: 'phone',
          message: 'Phone number is required',
          severity: 'error',
        });
      } else if (!this.isValidPhone(driver.phone)) {
        warnings.push({
          row: index + 1,
          field: 'phone',
          message: 'Phone number format may be invalid',
          severity: 'warning',
        });
      }

      if (!driver.license_number?.trim()) {
        errors.push({
          row: index + 1,
          field: 'license_number',
          message: 'License number is required',
          severity: 'error',
        });
      }

      if (!driver.license_expiry?.trim()) {
        errors.push({
          row: index + 1,
          field: 'license_expiry',
          message: 'License expiry date is required',
          severity: 'error',
        });
      } else if (!this.isValidDate(driver.license_expiry)) {
        errors.push({
          row: index + 1,
          field: 'license_expiry',
          message: 'License expiry date format is invalid (expected YYYY-MM-DD)',
          severity: 'error',
        });
      } else if (new Date(driver.license_expiry) < new Date()) {
        warnings.push({
          row: index + 1,
          field: 'license_expiry',
          message: 'License has expired',
          severity: 'warning',
        });
      }
    });

    return this.buildResult(errors, warnings, drivers.length);
  }

  /**
   * Validate owners
   */
  async validateOwners(owners: ImportedOwner[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const existingCodes = await this.getExistingOwnerCodes();

    owners.forEach((owner, index) => {
      if (!owner.code?.trim()) {
        errors.push({
          row: index + 1,
          field: 'code',
          message: 'Owner code is required',
          severity: 'error',
        });
      } else if (existingCodes.includes(owner.code)) {
        errors.push({
          row: index + 1,
          field: 'code',
          message: `Owner code "${owner.code}" already exists`,
          severity: 'error',
        });
      }

      if (!owner.name?.trim()) {
        errors.push({
          row: index + 1,
          field: 'name',
          message: 'Owner name is required',
          severity: 'error',
        });
      }

      // Contact validation
      if (owner.email && !this.isValidEmail(owner.email)) {
        warnings.push({
          row: index + 1,
          field: 'email',
          message: 'Invalid email format',
          severity: 'warning',
        });
      }

      if (owner.phone && !this.isValidPhone(owner.phone)) {
        warnings.push({
          row: index + 1,
          field: 'phone',
          message: 'Phone number format may be invalid',
          severity: 'warning',
        });
      }

      // GSTIN validation
      if (owner.gstin && !this.isValidGSTIN(owner.gstin)) {
        warnings.push({
          row: index + 1,
          field: 'gstin',
          message: 'GSTIN format may be invalid (expected 15 characters)',
          severity: 'warning',
        });
      }
    });

    return this.buildResult(errors, warnings, owners.length);
  }

  /**
   * Validate rate charts
   */
  async validateRateCharts(rateCharts: ImportedRateChart[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const existingCustomerCodes = await this.getExistingCustomerCodes();
    const existingVehicleCategories = await this.getExistingVehicleCategories();

    rateCharts.forEach((chart, index) => {
      if (!chart.customer_code?.trim()) {
        errors.push({
          row: index + 1,
          field: 'customer_code',
          message: 'Customer code is required',
          severity: 'error',
        });
      } else if (!existingCustomerCodes.includes(chart.customer_code)) {
        errors.push({
          row: index + 1,
          field: 'customer_code',
          message: `Customer "${chart.customer_code}" does not exist`,
          severity: 'error',
        });
      }

      if (!chart.name?.trim()) {
        errors.push({
          row: index + 1,
          field: 'name',
          message: 'Rate chart name is required',
          severity: 'error',
        });
      }

      if (!chart.vehicle_category_name?.trim()) {
        errors.push({
          row: index + 1,
          field: 'vehicle_category_name',
          message: 'Vehicle category is required',
          severity: 'error',
        });
      } else if (!existingVehicleCategories.includes(chart.vehicle_category_name)) {
        warnings.push({
          row: index + 1,
          field: 'vehicle_category_name',
          message: `Vehicle category "${chart.vehicle_category_name}" does not exist`,
          severity: 'warning',
        });
      }

      // Duty type validation
      const validDutyTypes = ['local', 'outstation', 'drop_pickup', 'station_drop', 'long'];
      if (!chart.duty_type?.trim()) {
        errors.push({
          row: index + 1,
          field: 'duty_type',
          message: 'Duty type is required',
          severity: 'error',
        });
      } else if (!validDutyTypes.includes(chart.duty_type)) {
        errors.push({
          row: index + 1,
          field: 'duty_type',
          message: `Invalid duty type. Must be one of: ${validDutyTypes.join(', ')}`,
          severity: 'error',
        });
      }

      // Amount validation
      if (chart.base_amount !== undefined && chart.base_amount < 0) {
        errors.push({
          row: index + 1,
          field: 'base_amount',
          message: 'Base amount cannot be negative',
          severity: 'error',
        });
      }

      if (chart.extra_km_rate !== undefined && chart.extra_km_rate < 0) {
        errors.push({
          row: index + 1,
          field: 'extra_km_rate',
          message: 'Extra KM rate cannot be negative',
          severity: 'error',
        });
      }

      if (chart.extra_hr_rate !== undefined && chart.extra_hr_rate < 0) {
        errors.push({
          row: index + 1,
          field: 'extra_hr_rate',
          message: 'Extra hour rate cannot be negative',
          severity: 'error',
        });
      }
    });

    return this.buildResult(errors, warnings, rateCharts.length);
  }

  // Helper methods
  private emptyResult(): ValidationResult {
    return {
      valid: true,
      errors: [],
      warnings: [],
      summary: { total: 0, valid: 0, invalid: 0, warnings: 0 },
    };
  }

  private buildResult(errors: ValidationError[], warnings: ValidationError[], total: number): ValidationResult {
    const invalid = errors.filter(e => e.severity === 'error').length;
    const warningCount = warnings.filter(w => w.severity === 'warning').length;
    const valid = total - invalid;

    return {
      valid: invalid === 0,
      errors,
      warnings,
      summary: {
        total,
        valid,
        invalid,
        warnings: warningCount,
      },
    };
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidPhone(phone: string): boolean {
    return /^[+]?[\d\s\-()]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  private isValidGSTIN(gstin: string): boolean {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
  }

  private isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  // Database queries
  private async getExistingCustomerCodes(): Promise<string[]> {
    const result = await this.pool.query('SELECT customer_code FROM customers');
    return result.rows.map(r => r.customer_code);
  }

  private async getExistingVehicleNumbers(): Promise<string[]> {
    const result = await this.pool.query('SELECT vehicle_number FROM vehicles');
    return result.rows.map(r => r.vehicle_number.toUpperCase());
  }

  private async getExistingDriverCodes(): Promise<string[]> {
    const result = await this.pool.query('SELECT driver_code FROM drivers');
    return result.rows.map(r => r.driver_code);
  }

  private async getExistingOwnerCodes(): Promise<string[]> {
    const result = await this.pool.query('SELECT code FROM owners');
    return result.rows.map(r => r.code);
  }

  private async getExistingVehicleCategories(): Promise<string[]> {
    const result = await this.pool.query('SELECT name FROM vehicle_categories WHERE is_active = true');
    return result.rows.map(r => r.name);
  }
}
