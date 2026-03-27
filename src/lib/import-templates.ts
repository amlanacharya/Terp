// Excel/CSV import template generators

export interface TemplateField {
  name: string;
  label: string;
  required: boolean;
  type: 'text' | 'number' | 'email' | 'phone' | 'date' | 'select';
  options?: string[];
  example?: string;
}

export interface ImportTemplate {
  entityType: string;
  fields: TemplateField[];
}

export const importTemplates: Record<string, ImportTemplate> = {
  customers: {
    entityType: 'customers',
    fields: [
      { name: 'customer_code', label: 'Customer Code', required: true, type: 'text', example: 'CUST001' },
      { name: 'name', label: 'Customer Name', required: true, type: 'text', example: 'ABC Travels' },
      { name: 'contact_person', label: 'Contact Person', required: false, type: 'text', example: 'John Doe' },
      { name: 'phone', label: 'Phone', required: true, type: 'phone', example: '9876543210' },
      { name: 'email', label: 'Email', required: true, type: 'email', example: 'contact@abc.com' },
      { name: 'address', label: 'Address', required: true, type: 'text', example: '123 Main Street' },
      { name: 'city', label: 'City', required: true, type: 'text', example: 'Bhubaneswar' },
      { name: 'state', label: 'State', required: true, type: 'text', example: 'Odisha' },
      { name: 'pincode', label: 'PIN Code', required: true, type: 'text', example: '751001' },
      { name: 'gstin', label: 'GSTIN', required: false, type: 'text', example: '19ABCDE1234F1Z5' }
    ]
  },
  vehicles: {
    entityType: 'vehicles',
    fields: [
      { name: 'vehicle_number', label: 'Vehicle Number', required: true, type: 'text', example: 'OD02AB1234' },
      { name: 'vehicle_type', label: 'Vehicle Type', required: true, type: 'select', options: ['car', 'suv', 'van', 'bus'], example: 'car' },
      { name: 'category', label: 'Category', required: true, type: 'text', example: 'CRYSTA' },
      { name: 'model', label: 'Model', required: false, type: 'text', example: 'Toyota Innova' },
      { name: 'year', label: 'Year', required: false, type: 'number', example: '2020' },
      { name: 'capacity', label: 'Capacity (seats)', required: false, type: 'number', example: '7' },
      { name: 'owner_code', label: 'Owner Code', required: true, type: 'text', example: 'OWNER001' },
      { name: 'fuel_type', label: 'Fuel Type', required: false, type: 'select', options: ['petrol', 'diesel', 'cng', 'electric'], example: 'diesel' }
    ]
  },
  drivers: {
    entityType: 'drivers',
    fields: [
      { name: 'driver_code', label: 'Driver Code', required: true, type: 'text', example: 'DRV001' },
      { name: 'name', label: 'Driver Name', required: true, type: 'text', example: 'Raj Kumar' },
      { name: 'phone', label: 'Phone', required: true, type: 'phone', example: '9876543210' },
      { name: 'alternate_phone', label: 'Alternate Phone', required: false, type: 'phone', example: '9123456789' },
      { name: 'license_number', label: 'License Number', required: true, type: 'text', example: 'DL-1234567890123' },
      { name: 'license_valid_until', label: 'License Valid Until', required: true, type: 'date', example: '2025-12-31' },
      { name: 'address', label: 'Address', required: true, type: 'text', example: '456 Market Road' },
      { name: 'city', label: 'City', required: true, type: 'text', example: 'Bhubaneswar' },
      { name: 'state', label: 'State', required: true, type: 'text', example: 'Odisha' },
      { name: 'pincode', label: 'PIN Code', required: true, type: 'text', example: '751001' }
    ]
  },
  owners: {
    entityType: 'owners',
    fields: [
      { name: 'owner_code', label: 'Owner Code', required: true, type: 'text', example: 'OWNER001' },
      { name: 'name', label: 'Owner Name', required: true, type: 'text', example: 'XYZ Transport' },
      { name: 'contact_person', label: 'Contact Person', required: false, type: 'text', example: 'Amit Sharma' },
      { name: 'phone', label: 'Phone', required: true, type: 'phone', example: '9876543210' },
      { name: 'alternate_phone', label: 'Alternate Phone', required: false, type: 'phone', example: '9123456789' },
      { name: 'email', label: 'Email', required: false, type: 'email', example: 'owner@xyz.com' },
      { name: 'address', label: 'Address', required: true, type: 'text', example: '789 Industrial Area' },
      { name: 'city', label: 'City', required: true, type: 'text', example: 'Bhubaneswar' },
      { name: 'state', label: 'State', required: true, type: 'text', example: 'Odisha' },
      { name: 'pincode', label: 'PIN Code', required: true, type: 'text', example: '751001' },
      { name: 'gstin', label: 'GSTIN', required: false, type: 'text', example: '19ABCDE1234F1Z5' },
      { name: 'pan', label: 'PAN', required: false, type: 'text', example: 'ABCDE1234F' }
    ]
  },
  rateCharts: {
    entityType: 'rateCharts',
    fields: [
      { name: 'customer_code', label: 'Customer Code', required: true, type: 'text', example: 'CUST001' },
      { name: 'vehicle_category', label: 'Vehicle Category', required: true, type: 'text', example: 'CRYSTA' },
      { name: 'duty_type', label: 'Duty Type', required: true, type: 'select', options: ['local', 'outstation'], example: 'local' },
      { name: 'base_km', label: 'Base KM', required: true, type: 'number', example: '80' },
      { name: 'base_hrs', label: 'Base Hours', required: true, type: 'number', example: '8' },
      { name: 'base_rate', label: 'Base Rate', required: true, type: 'number', example: '3000' },
      { name: 'extra_km_rate', label: 'Extra KM Rate', required: false, type: 'number', example: '18' },
      { name: 'extra_hr_rate', label: 'Extra Hour Rate', required: false, type: 'number', example: '180' },
      { name: 'night_halt_charge', label: 'Night Halt Charge', required: false, type: 'number', example: '500' }
    ]
  }
};

export function getTemplate(entityType: string): ImportTemplate | null {
  return importTemplates[entityType] || null;
}

export function getAllTemplateTypes(): string[] {
  return Object.keys(importTemplates);
}

export function generateExampleData(entityType: string): Record<string, any>[] {
  const template = getTemplate(entityType);
  if (!template) return [];

  const examples: Record<string, any> = {};
  template.fields.forEach(field => {
    examples[field.name] = field.example || '';
  });

  return [examples];
}
