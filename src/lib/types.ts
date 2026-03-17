export type UserRole = 'admin' | 'manager' | 'accountant' | 'operator' | 'viewer';

export type DutyType = 'local' | 'outstation' | 'drop_pickup' | 'station_drop' | 'long';

export type PageKey =
  | 'dashboard'
  | 'leads'
  | 'trips'
  | 'drivers'
  | 'vehicles'
  | 'vehicle-categories'
  | 'rate-charts'
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
  invoicedAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  recentOutstandingInvoices: OutstandingInvoice[];
}

export interface GstRate {
  id: string;
  hsn_code: string;
  description: string;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
}

export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address?: string | null;
  city: string | null;
  state: string | null;
  gstin?: string | null;
  credit_limit: number;
  credit_days: number;
  default_duty_start_time: string | null;
  default_duty_end_time: string | null;
  default_duty_hours: number | null;
  is_active: boolean;
}

export interface LeadCustomerSummary {
  id: string;
  customer_code: string;
  name: string;
}

export interface LeadAssigneeSummary {
  id: string;
  full_name: string;
  role: UserRole;
}

export interface Lead {
  id: string;
  lead_number: string;
  lead_date: string;
  source: string;
  customer_id: string | null;
  prospect_name: string | null;
  prospect_phone: string;
  prospect_email: string | null;
  prospect_company: string | null;
  trip_type: string;
  from_location: string;
  to_location: string | null;
  travel_date: string;
  return_date: string | null;
  pax_count: number;
  vehicle_preference: string | null;
  num_vehicles: number;
  special_requirements: string | null;
  estimated_amount: number | null;
  status: string;
  assigned_to: string | null;
  priority: string;
  lost_reason: string | null;
  converted_booking_id: string | null;
  remarks: string | null;
  customer: LeadCustomerSummary | null;
  assigned_user: LeadAssigneeSummary | null;
  last_follow_up_date: string | null;
  next_follow_up: string | null;
  last_follow_up_summary: string | null;
  follow_up_count: number;
}

export interface LeadFollowUp {
  id: string;
  lead_id: string;
  follow_up_date: string;
  next_follow_up: string | null;
  contact_mode: string;
  summary: string;
  quoted_amount: number | null;
  created_at: string;
  created_by_user: LeadAssigneeSummary | null;
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
  default_vehicle_id: string | null;
  night_halt_rate: number | null;
  ot_per_hour: number | null;
  is_active: boolean;
}

export interface VehicleCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  vehicle_count?: number;
}

export interface RateChartCustomerSummary {
  id: string;
  name: string;
  customer_code: string;
}

export interface RateChartSummary {
  id: string;
  customer_id: string;
  name: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer: RateChartCustomerSummary;
  item_count: number;
  fixed_route_count: number;
}

export interface RateChartItem {
  id: string;
  rate_chart_id: string;
  vehicle_category_id: string;
  duty_type: DutyType;
  package_code: string;
  package_label: string;
  sort_order: number;
  is_default: boolean;
  base_hours: number | null;
  base_km: number | null;
  base_amount: number | null;
  extra_km_rate: number | null;
  extra_hr_rate: number | null;
  fuel_divisor: number | null;
  fuel_price_per_unit: number | null;
  night_halt_rate: number | null;
  fixed_amount: number | null;
  use_higher_of_km_hr: boolean;
  per_km_rate: number | null;
  ot_rate: number | null;
  long_km_threshold: number | null;
  no_km_limit_cap_km: number | null;
  long_day_hours: number | null;
  long_night_halt_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle_category: VehicleCategory;
}

export interface RateChartFixedRoute {
  id: string;
  rate_chart_id: string;
  vehicle_category_id: string;
  duty_type: DutyType;
  from_location: string;
  to_location: string;
  from_location_key: string;
  to_location_key: string;
  fixed_amount: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  vehicle_category: VehicleCategory;
}

export interface RateChart {
  id: string;
  customer_id: string;
  name: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer: RateChartCustomerSummary;
  items: RateChartItem[];
  fixed_routes: RateChartFixedRoute[];
}

export interface RateCalculationLineItem {
  code: string;
  label: string;
  amount: number;
  meta?: Record<string, unknown>;
}

export interface RateCalculationResult {
  rate_chart_id: string;
  rate_chart_item_id: string | null;
  package_code: string | null;
  package_label: string | null;
  requested_duty_type: DutyType;
  applied_duty_type: DutyType;
  applied_fixed_route_id: string | null;
  line_items: RateCalculationLineItem[];
  totals: {
    base_charge: number;
    extra_km_charge: number;
    extra_hr_charge: number;
    fuel_charge: number;
    night_halt_charge: number;
    ot_charge: number;
    fixed_amount: number;
    final_amount: number;
  };
  warnings: string[];
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
  vehicle_category: VehicleCategory | null;
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
  total_expenses?: number;
  customer: TripCustomerSummary;
  driver: TripDriverSummary;
  vehicle: TripVehicleSummary;
}

export interface TripExpense {
  id: string;
  trip_id: string;
  expense_type: string;
  amount: number;
  description: string | null;
  receipt_number: string | null;
  created_at?: string;
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
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  subtotal: number;
  total_amount: number;
  payment_status: string;
  due_date: string | null;
  remarks: string | null;
  customer: InvoiceCustomerSummary;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  trip_id: string | null;
  description: string;
  hsn_code: string | null;
  quantity: number;
  rate: number;
  amount: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

export interface InvoiceDetail extends Invoice {
  billing_address?: string | null;
  customer_gstin?: string | null;
  items: InvoiceItem[];
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
  advances?: number;
  deductions?: number;
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
  tds_amount?: number;
  other_deductions?: number;
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

export interface OutstandingInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  payment_status: string;
  customer: InvoiceCustomerSummary;
}

export interface CustomerOutstanding {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  invoice_count: number;
  invoiced_amount: number;
  collected_amount: number;
  outstanding_amount: number;
}

export interface OwnerSettlementReportItem {
  id: string;
  settlement_number: string;
  period_from: string;
  period_to: string;
  vehicle_number: string | null;
  total_trips: number;
  total_km: number;
  gross_amount: number;
  tds_amount: number;
  other_deductions: number;
  net_paid: number;
  payment_mode: string | null;
  reference_number: string | null;
  status: string;
}

export interface OwnerSettlementReport {
  owner_id: string;
  owner_name: string;
  owner_code: string;
  vehicles: string[];
  total_trips: number;
  total_km: number;
  gross_amount: number;
  tds_amount: number;
  other_deductions: number;
  net_paid: number;
  payment_modes: string[];
  reference_numbers: string[];
  settlements: OwnerSettlementReportItem[];
}

export interface DriverSettlementReportItem {
  id: string;
  settlement_number: string;
  period_from: string;
  period_to: string;
  total_trips: number;
  total_km: number;
  total_allowance: number;
  advances: number;
  deductions: number;
  net_paid: number;
  payment_mode: string | null;
  reference_number: string | null;
  status: string;
}

export interface DriverSettlementReport {
  driver_id: string;
  driver_name: string;
  driver_code: string;
  total_trips: number;
  total_km: number;
  total_allowance: number;
  advances: number;
  deductions: number;
  net_paid: number;
  payment_modes: string[];
  reference_numbers: string[];
  settlements: DriverSettlementReportItem[];
}

export interface CollectionRegisterEntry {
  id: string;
  collection_number: string;
  collection_date: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  payment_mode: string;
  bank_name: string | null;
  reference_number: string | null;
  remarks: string | null;
}

export interface CollectionRegisterTotals {
  total_collected: number;
  by_mode: Array<{
    payment_mode: string;
    total_amount: number;
  }>;
}

export interface CollectionRegisterResponse {
  entries: CollectionRegisterEntry[];
  totals: CollectionRegisterTotals;
}

export interface CustomerProfitabilityReport {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  total_invoiced: number;
  total_collected: number;
  outstanding: number;
  total_expenses: number;
  net_income: number;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_at: string;
}



