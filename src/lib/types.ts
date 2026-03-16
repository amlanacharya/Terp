export type UserRole = 'admin' | 'manager' | 'accountant' | 'operator' | 'viewer';

export type PageKey =
  | 'dashboard'
  | 'trips'
  | 'drivers'
  | 'vehicles'
  | 'customers'
  | 'owners'
  | 'invoices'
  | 'collections'
  | 'driver-settlements'
  | 'owner-settlements'
  | 'reports'
  | 'settings';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthSessionResponse {
  token?: string;
  user: AuthUser;
  profile: Profile;
}

export interface DashboardStats {
  trips: number;
  drivers: number;
  vehicles: number;
  customers: number;
  invoices: number;
}

export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  credit_limit: number;
  credit_days: number;
  is_active: boolean;
}

export interface Owner {
  id: string;
  code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  gstin: string | null;
  is_active: boolean;
}

export interface Driver {
  id: string;
  driver_code: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  state: string | null;
  license_number: string;
  license_expiry: string;
  is_active: boolean;
}

export interface VehicleOwnerSummary {
  id: string;
  name: string;
  code: string;
  phone: string | null;
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  seating_capacity: number | null;
  is_owned: boolean;
  is_active: boolean;
  owner: VehicleOwnerSummary | null;
}

export interface TripCustomerSummary {
  id: string;
  name: string;
  customer_code: string;
}

export interface TripDriverSummary {
  id: string;
  name: string;
  driver_code: string;
  phone: string;
}

export interface TripVehicleSummary {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
}

export interface Trip {
  id: string;
  trip_number: string;
  trip_date: string;
  from_location: string;
  to_location: string;
  purpose: string | null;
  passengers: number | null;
  status: string;
  trip_amount: number;
  driver_allowance: number;
  toll_charges: number;
  parking_charges: number;
  remarks: string | null;
  customer: TripCustomerSummary;
  driver: TripDriverSummary;
  vehicle: TripVehicleSummary;
}

export interface InvoiceCustomerSummary {
  id: string;
  name: string;
  customer_code: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  total_amount: number;
  payment_status: string;
  due_date: string | null;
  remarks: string | null;
  customer: InvoiceCustomerSummary;
}

export interface CollectionInvoiceSummary {
  id: string;
  invoice_number: string;
  total_amount: number;
  payment_status: string;
  customer: InvoiceCustomerSummary;
}

export interface Collection {
  id: string;
  collection_number: string;
  collection_date: string;
  amount: number;
  payment_mode: string;
  reference_number: string | null;
  bank_name: string | null;
  remarks: string | null;
  invoice: CollectionInvoiceSummary;
}

export interface DriverSettlement {
  id: string;
  settlement_number: string;
  period_from: string;
  period_to: string;
  total_trips: number;
  total_km: number;
  total_allowance: number;
  net_amount: number;
  payment_mode: string | null;
  status: string;
  driver: TripDriverSummary;
}

export interface OwnerSettlementVehicleSummary {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
}

export interface OwnerSettlement {
  id: string;
  settlement_number: string;
  period_from: string;
  period_to: string;
  total_trips: number;
  total_km: number;
  total_amount: number;
  net_amount: number;
  payment_mode: string | null;
  status: string;
  owner: VehicleOwnerSummary;
  vehicle: OwnerSettlementVehicleSummary | null;
}

export interface ReportStatusRow {
  status: string;
  count: number;
}

export interface ReportSummary {
  invoiceValue: number;
  collectedValue: number;
  outstandingValue: number;
  driverSettlementValue: number;
  ownerSettlementValue: number;
  tripsByStatus: ReportStatusRow[];
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_at: string;
}
