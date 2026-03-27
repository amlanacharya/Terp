// Data import validation utilities

export interface ValidationError {
  row: number;
  field: string;
  error: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  totalRows: number;
  validRows: number;
}

export interface ImportSummary {
  [entityType: string]: {
    count: number;
    valid: boolean;
    errors: ValidationError[];
  };
}

export async function validateFiles(files: Record<string, File>): Promise<{
  summary: ImportSummary;
  hasErrors: boolean;
}> {
  const results = {
    summary: {} as ImportSummary,
    hasErrors: false
  };

  for (const [entityType, file] of Object.entries(files)) {
    try {
      const data = await parseFile(file);
      const validation = validateEntityType(entityType, data);

      results.summary[entityType] = {
        count: data.length,
        valid: validation.errors.length === 0,
        errors: validation.errors
      };

      if (validation.errors.length > 0) {
        results.hasErrors = true;
      }
    } catch (error) {
      results.summary[entityType] = {
        count: 0,
        valid: false,
        errors: [{ row: 0, field: 'file', error: 'Failed to parse file' }]
      };
      results.hasErrors = true;
    }
  }

  return results;
}

async function parseFile(file: File): Promise<any[]> {
  const arrayBuffer = await file.arrayBuffer();

  // Try to detect if it's CSV or Excel
  if (file.name.endsWith('.csv')) {
    // Parse as CSV
    const text = new TextDecoder().decode(arrayBuffer);
    return parseCSV(text);
  } else {
    // Parse as Excel (requires xlsx library)
    // For now, return empty array - will be implemented with xlsx library
    console.warn('Excel parsing requires xlsx library');
    return [];
  }
}

function parseCSV(text: string): any[] {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (values.length === headers.length && values.some(v => v !== '')) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }

  return data;
}

function validateEntityType(entityType: string, data: any[]): { errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data || data.length === 0) {
    return { errors: [{ row: 0, field: 'data', error: 'No data found' }] };
  }

  switch (entityType) {
    case 'customers':
      validateCustomers(data, errors);
      break;
    case 'vehicles':
      validateVehicles(data, errors);
      break;
    case 'drivers':
      validateDrivers(data, errors);
      break;
    case 'owners':
      validateOwners(data, errors);
      break;
    case 'rateCharts':
      validateRateCharts(data, errors);
      break;
  }

  return { errors };
}

function validateCustomers(data: any[], errors: ValidationError[]): void {
  const codes = new Set<string>();

  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 for header row and 0-based index

    if (!row.customer_code || !row.customer_code.trim()) {
      errors.push({ row: rowNum, field: 'customer_code', error: 'Required', value: row.customer_code });
    } else if (codes.has(row.customer_code)) {
      errors.push({ row: rowNum, field: 'customer_code', error: 'Duplicate customer code', value: row.customer_code });
    } else {
      codes.add(row.customer_code);
    }

    if (!row.name || !row.name.trim()) {
      errors.push({ row: rowNum, field: 'name', error: 'Required', value: row.name });
    }

    if (row.phone && !/^\d{10}$/.test(row.phone.replace(/\s/g, ''))) {
      errors.push({ row: rowNum, field: 'phone', error: 'Invalid phone number', value: row.phone });
    }

    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push({ row: rowNum, field: 'email', error: 'Invalid email format', value: row.email });
    }

    if (!row.city || !row.city.trim()) {
      errors.push({ row: rowNum, field: 'city', error: 'Required', value: row.city });
    }

    if (!row.state || !row.state.trim()) {
      errors.push({ row: rowNum, field: 'state', error: 'Required', value: row.state });
    }

    if (!row.pincode || !/^\d{6}$/.test(row.pincode)) {
      errors.push({ row: rowNum, field: 'pincode', error: 'Invalid PIN code (must be 6 digits)', value: row.pincode });
    }

    if (row.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(row.gstin)) {
      errors.push({ row: rowNum, field: 'gstin', error: 'Invalid GSTIN format', value: row.gstin });
    }
  });
}

function validateVehicles(data: any[], errors: ValidationError[]): void {
  const numbers = new Set<string>();

  data.forEach((row, index) => {
    const rowNum = index + 2;

    if (!row.vehicle_number || !row.vehicle_number.trim()) {
      errors.push({ row: rowNum, field: 'vehicle_number', error: 'Required', value: row.vehicle_number });
    } else if (numbers.has(row.vehicle_number.toUpperCase())) {
      errors.push({ row: rowNum, field: 'vehicle_number', error: 'Duplicate vehicle number', value: row.vehicle_number });
    } else {
      numbers.add(row.vehicle_number.toUpperCase());
    }

    if (!row.vehicle_type || !['car', 'suv', 'van', 'bus'].includes(row.vehicle_type.toLowerCase())) {
      errors.push({ row: rowNum, field: 'vehicle_type', error: 'Must be car, suv, van, or bus', value: row.vehicle_type });
    }

    if (!row.category || !row.category.trim()) {
      errors.push({ row: rowNum, field: 'category', error: 'Required', value: row.category });
    }

    if (!row.owner_code || !row.owner_code.trim()) {
      errors.push({ row: rowNum, field: 'owner_code', error: 'Required', value: row.owner_code });
    }

    if (row.year && (isNaN(row.year) || row.year < 1990 || row.year > new Date().getFullYear() + 1)) {
      errors.push({ row: rowNum, field: 'year', error: 'Invalid year', value: row.year });
    }
  });
}

function validateDrivers(data: any[], errors: ValidationError[]): void {
  const codes = new Set<string>();

  data.forEach((row, index) => {
    const rowNum = index + 2;

    if (!row.driver_code || !row.driver_code.trim()) {
      errors.push({ row: rowNum, field: 'driver_code', error: 'Required', value: row.driver_code });
    } else if (codes.has(row.driver_code)) {
      errors.push({ row: rowNum, field: 'driver_code', error: 'Duplicate driver code', value: row.driver_code });
    } else {
      codes.add(row.driver_code);
    }

    if (!row.name || !row.name.trim()) {
      errors.push({ row: rowNum, field: 'name', error: 'Required', value: row.name });
    }

    if (!row.phone || !/^\d{10}$/.test(row.phone.replace(/\s/g, ''))) {
      errors.push({ row: rowNum, field: 'phone', error: 'Invalid phone number', value: row.phone });
    }

    if (!row.license_number || !row.license_number.trim()) {
      errors.push({ row: rowNum, field: 'license_number', error: 'Required', value: row.license_number });
    }

    if (row.license_valid_until) {
      const date = new Date(row.license_valid_until);
      if (isNaN(date.getTime())) {
        errors.push({ row: rowNum, field: 'license_valid_until', error: 'Invalid date format', value: row.license_valid_until });
      }
    }
  });
}

function validateOwners(data: any[], errors: ValidationError[]): void {
  const codes = new Set<string>();

  data.forEach((row, index) => {
    const rowNum = index + 2;

    if (!row.owner_code || !row.owner_code.trim()) {
      errors.push({ row: rowNum, field: 'owner_code', error: 'Required', value: row.owner_code });
    } else if (codes.has(row.owner_code)) {
      errors.push({ row: rowNum, field: 'owner_code', error: 'Duplicate owner code', value: row.owner_code });
    } else {
      codes.add(row.owner_code);
    }

    if (!row.name || !row.name.trim()) {
      errors.push({ row: rowNum, field: 'name', error: 'Required', value: row.name });
    }

    if (!row.phone || !/^\d{10}$/.test(row.phone.replace(/\s/g, ''))) {
      errors.push({ row: rowNum, field: 'phone', error: 'Invalid phone number', value: row.phone });
    }

    if (row.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(row.pan)) {
      errors.push({ row: rowNum, field: 'pan', error: 'Invalid PAN format', value: row.pan });
    }
  });
}

function validateRateCharts(data: any[], errors: ValidationError[]): void {
  data.forEach((row, index) => {
    const rowNum = index + 2;

    if (!row.customer_code || !row.customer_code.trim()) {
      errors.push({ row: rowNum, field: 'customer_code', error: 'Required', value: row.customer_code });
    }

    if (!row.vehicle_category || !row.vehicle_category.trim()) {
      errors.push({ row: rowNum, field: 'vehicle_category', error: 'Required', value: row.vehicle_category });
    }

    if (!row.duty_type || !['local', 'outstation'].includes(row.duty_type.toLowerCase())) {
      errors.push({ row: rowNum, field: 'duty_type', error: 'Must be local or outstation', value: row.duty_type });
    }

    if (!row.base_km || isNaN(row.base_km)) {
      errors.push({ row: rowNum, field: 'base_km', error: 'Required and must be a number', value: row.base_km });
    }

    if (!row.base_hrs || isNaN(row.base_hrs)) {
      errors.push({ row: rowNum, field: 'base_hrs', error: 'Required and must be a number', value: row.base_hrs });
    }

    if (!row.base_rate || isNaN(row.base_rate)) {
      errors.push({ row: rowNum, field: 'base_rate', error: 'Required and must be a number', value: row.base_rate });
    }
  });
}
