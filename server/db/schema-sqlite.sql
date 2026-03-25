-- FleetSync Lite SQLite Schema
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'accountant', 'operator', 'viewer')),
  phone TEXT,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  customer_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  gstin TEXT,
  pan TEXT,
  sac_code TEXT,
  vendor_code TEXT,
  credit_limit NUMERIC DEFAULT 0,
  credit_days INTEGER DEFAULT 0,
  default_duty_start_time TEXT,
  default_duty_end_time TEXT,
  default_duty_hours NUMERIC CHECK (default_duty_hours IS NULL OR default_duty_hours >= 0),
  invoice_pdf_mode TEXT NOT NULL DEFAULT 'invoice_with_annexures'
    CHECK (invoice_pdf_mode IN ('invoice_only', 'invoice_with_annexures')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS owners_vendors (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  gstin TEXT,
  pan TEXT,
  aadhar_number TEXT,
  bank_name TEXT,
  bank_account TEXT,
  ifsc_code TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  driver_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  license_number TEXT UNIQUE NOT NULL,
  license_expiry TEXT NOT NULL,
  date_of_birth TEXT,
  blood_group TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  pan TEXT,
  aadhar_number TEXT,
  bank_name TEXT,
  bank_account TEXT,
  ifsc_code TEXT,
  night_halt_rate NUMERIC DEFAULT 0 CHECK (night_halt_rate IS NULL OR night_halt_rate >= 0),
  ot_per_hour NUMERIC DEFAULT 0 CHECK (ot_per_hour IS NULL OR ot_per_hour >= 0),
  default_vehicle_id TEXT REFERENCES vehicles(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  route_code TEXT UNIQUE NOT NULL,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  distance_km NUMERIC NOT NULL,
  estimated_hours NUMERIC,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  vehicle_number TEXT UNIQUE NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('bus', 'mini_bus', 'van', 'car', 'truck')),
  make TEXT,
  model TEXT,
  year INTEGER,
  seating_capacity INTEGER,
  owner_id TEXT REFERENCES owners_vendors(id),
  registration_date TEXT,
  insurance_expiry TEXT,
  permit_expiry TEXT,
  fitness_expiry TEXT,
  pollution_expiry TEXT,
  is_owned INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vehicle_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vehicle_category_mappings (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_category_id TEXT NOT NULL REFERENCES vehicle_categories(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (vehicle_id)
);

CREATE TABLE IF NOT EXISTS rate_charts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_by TEXT REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS rate_chart_items (
  id TEXT PRIMARY KEY,
  rate_chart_id TEXT NOT NULL REFERENCES rate_charts(id) ON DELETE CASCADE,
  vehicle_category_id TEXT NOT NULL REFERENCES vehicle_categories(id),
  duty_type TEXT NOT NULL CHECK (duty_type IN ('local', 'outstation', 'drop_pickup', 'station_drop', 'long')),
  package_code TEXT NOT NULL,
  package_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  base_hours NUMERIC,
  base_km NUMERIC,
  base_amount NUMERIC,
  extra_km_rate NUMERIC,
  extra_hr_rate NUMERIC,
  fuel_divisor NUMERIC,
  fuel_price_per_unit NUMERIC,
  night_halt_rate NUMERIC,
  fixed_amount NUMERIC,
  use_higher_of_km_hr INTEGER NOT NULL DEFAULT 0,
  per_km_rate NUMERIC,
  ot_rate NUMERIC,
  long_km_threshold NUMERIC,
  no_km_limit_cap_km NUMERIC,
  long_day_hours NUMERIC,
  long_night_halt_hours NUMERIC,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (length(trim(package_code)) > 0),
  CHECK (length(trim(package_label)) > 0),
  CHECK (base_hours IS NULL OR base_hours >= 0),
  CHECK (base_km IS NULL OR base_km >= 0),
  CHECK (base_amount IS NULL OR base_amount >= 0),
  CHECK (extra_km_rate IS NULL OR extra_km_rate >= 0),
  CHECK (extra_hr_rate IS NULL OR extra_hr_rate >= 0),
  CHECK (fuel_divisor IS NULL OR fuel_divisor > 0),
  CHECK (fuel_price_per_unit IS NULL OR fuel_price_per_unit >= 0),
  CHECK (night_halt_rate IS NULL OR night_halt_rate >= 0),
  CHECK (fixed_amount IS NULL OR fixed_amount >= 0),
  CHECK (per_km_rate IS NULL OR per_km_rate >= 0),
  CHECK (ot_rate IS NULL OR ot_rate >= 0),
  CHECK (long_km_threshold IS NULL OR long_km_threshold >= 0),
  CHECK (no_km_limit_cap_km IS NULL OR no_km_limit_cap_km >= 0),
  CHECK (long_day_hours IS NULL OR long_day_hours >= 0),
  CHECK (long_night_halt_hours IS NULL OR long_night_halt_hours >= 0)
);

CREATE TABLE IF NOT EXISTS rate_chart_fixed_routes (
  id TEXT PRIMARY KEY,
  rate_chart_id TEXT NOT NULL REFERENCES rate_charts(id) ON DELETE CASCADE,
  vehicle_category_id TEXT NOT NULL REFERENCES vehicle_categories(id),
  duty_type TEXT NOT NULL CHECK (duty_type IN ('local', 'outstation', 'drop_pickup', 'station_drop', 'long')),
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  from_location_key TEXT NOT NULL,
  to_location_key TEXT NOT NULL,
  fixed_amount NUMERIC NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (length(trim(from_location)) > 0),
  CHECK (length(trim(to_location)) > 0),
  CHECK (length(trim(from_location_key)) > 0),
  CHECK (length(trim(to_location_key)) > 0),
  CHECK (fixed_amount > 0)
);

CREATE TABLE IF NOT EXISTS gst_rates (
  id TEXT PRIMARY KEY,
  hsn_code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  cgst_rate NUMERIC NOT NULL,
  sgst_rate NUMERIC NOT NULL,
  igst_rate NUMERIC NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tax_components (
  id TEXT PRIMARY KEY,
  component_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  rate NUMERIC,
  is_percentage INTEGER NOT NULL DEFAULT 1,
  flat_amount NUMERIC,
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('intra_state', 'inter_state', 'all')),
  hsn_code TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (length(trim(component_code)) > 0),
  CHECK (length(trim(name)) > 0),
  CHECK (rate IS NULL OR rate >= 0),
  CHECK (flat_amount IS NULL OR flat_amount >= 0),
  CHECK (
    (is_percentage = 1 AND rate IS NOT NULL AND flat_amount IS NULL)
    OR (is_percentage = 0 AND rate IS NULL AND flat_amount IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  lead_number TEXT UNIQUE NOT NULL,
  lead_date TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL CHECK (source IN ('walk_in', 'phone', 'email', 'whatsapp', 'website', 'referral', 'repeat_customer', 'agent', 'other')),
  customer_id TEXT REFERENCES customers(id),
  prospect_name TEXT,
  prospect_phone TEXT NOT NULL,
  prospect_email TEXT,
  prospect_company TEXT,
  trip_type TEXT NOT NULL,
  from_location TEXT NOT NULL,
  to_location TEXT,
  travel_date TEXT NOT NULL,
  return_date TEXT,
  pax_count INTEGER NOT NULL,
  vehicle_preference TEXT CHECK (vehicle_preference IN ('bus', 'mini_bus', 'van', 'car', 'truck')),
  num_vehicles INTEGER DEFAULT 1,
  special_requirements TEXT,
  estimated_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quoted', 'negotiating', 'converted', 'lost', 'on_hold')),
  assigned_to TEXT REFERENCES profiles(id),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  lost_reason TEXT,
  converted_booking_id TEXT,
  remarks TEXT,
  created_by TEXT REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lead_follow_ups (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  follow_up_date TEXT NOT NULL,
  next_follow_up TEXT,
  contact_mode TEXT NOT NULL,
  summary TEXT NOT NULL,
  quoted_amount NUMERIC,
  created_by TEXT REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  trip_number TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  route_id TEXT REFERENCES routes(id),
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  trip_date TEXT NOT NULL,
  duty_type TEXT CHECK (duty_type IN ('local', 'outstation', 'drop_pickup', 'station_drop', 'long')),
  booked_by TEXT,
  report_to TEXT,
  vehicle_category_id TEXT REFERENCES vehicle_categories(id),
  rate_chart_id TEXT REFERENCES rate_charts(id),
  rate_chart_item_id TEXT REFERENCES rate_chart_items(id),
  rate_chart_fixed_route_id TEXT REFERENCES rate_chart_fixed_routes(id),
  start_time TEXT,
  end_time TEXT,
  start_km NUMERIC,
  end_km NUMERIC,
  actual_km NUMERIC,
  total_hours NUMERIC,
  night_halts INTEGER,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  purpose TEXT,
  passengers INTEGER,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  trip_amount NUMERIC NOT NULL,
  advance_hirer NUMERIC NOT NULL DEFAULT 0,
  advance_travels NUMERIC NOT NULL DEFAULT 0,
  fuel_advance NUMERIC NOT NULL DEFAULT 0,
  cash_advance NUMERIC NOT NULL DEFAULT 0,
  base_charge NUMERIC NOT NULL DEFAULT 0,
  extra_km_charge NUMERIC NOT NULL DEFAULT 0,
  extra_hr_charge NUMERIC NOT NULL DEFAULT 0,
  night_halt_charge NUMERIC NOT NULL DEFAULT 0,
  fuel_charge NUMERIC NOT NULL DEFAULT 0,
  fixed_route_charge NUMERIC NOT NULL DEFAULT 0,
  ot_charge NUMERIC NOT NULL DEFAULT 0,
  calculated_amount NUMERIC,
  is_long_trip INTEGER NOT NULL DEFAULT 0,
  parent_trip_id TEXT REFERENCES trips(id),
  annexure_number TEXT,
  driver_allowance NUMERIC DEFAULT 0,
  toll_charges NUMERIC DEFAULT 0,
  parking_charges NUMERIC DEFAULT 0,
  other_charges NUMERIC DEFAULT 0,
  remarks TEXT,
  created_by TEXT REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (start_km IS NULL OR start_km >= 0),
  CHECK (end_km IS NULL OR end_km >= 0),
  CHECK (actual_km IS NULL OR actual_km >= 0),
  CHECK (total_hours IS NULL OR total_hours >= 0),
  CHECK (night_halts IS NULL OR night_halts >= 0),
  CHECK (advance_hirer >= 0),
  CHECK (advance_travels >= 0),
  CHECK (fuel_advance >= 0),
  CHECK (cash_advance >= 0),
  CHECK (base_charge >= 0),
  CHECK (extra_km_charge >= 0),
  CHECK (extra_hr_charge >= 0),
  CHECK (night_halt_charge >= 0),
  CHECK (fuel_charge >= 0),
  CHECK (fixed_route_charge >= 0),
  CHECK (ot_charge >= 0),
  CHECK (calculated_amount IS NULL OR calculated_amount >= 0)
);

CREATE TABLE IF NOT EXISTS trip_travel_metrics (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  start_km NUMERIC NOT NULL,
  end_date TEXT,
  end_time TEXT,
  end_km NUMERIC,
  source_metric_id TEXT REFERENCES trip_travel_metrics(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (seq > 0),
  CHECK (start_km >= 0),
  CHECK (end_km IS NULL OR end_km >= start_km),
  CHECK (
    (end_date IS NULL AND end_time IS NULL AND end_km IS NULL)
    OR (end_date IS NOT NULL AND end_time IS NOT NULL AND end_km IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS trip_expenses (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  receipt_number TEXT,
  is_billable_to_hirer INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_date TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  billing_address TEXT,
  customer_gstin TEXT,
  booking_date TEXT,
  duty_type_label TEXT,
  nature_of_journey TEXT,
  vehicle_number TEXT,
  vehicle_type_label TEXT,
  duty_slip_number TEXT,
  total_km NUMERIC,
  total_hours NUMERIC,
  payment_terms_days INTEGER,
  interest_note TEXT,
  subtotal NUMERIC NOT NULL,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'completed', 'overdue')),
  due_date TEXT,
  remarks TEXT,
  invoice_type TEXT NOT NULL DEFAULT 'invoice' CHECK (invoice_type IN ('invoice', 'credit_note')),
  reference_invoice_id TEXT REFERENCES invoices(id),
  invoice_status TEXT NOT NULL DEFAULT 'active' CHECK (invoice_status IN ('active', 'void', 'written_off')),
  void_reason TEXT,
  voided_at TEXT,
  voided_by TEXT REFERENCES profiles(id),
  created_by TEXT REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (total_km IS NULL OR total_km >= 0),
  CHECK (total_hours IS NULL OR total_hours >= 0),
  CHECK (payment_terms_days IS NULL OR payment_terms_days >= 0)
);

CREATE TABLE IF NOT EXISTS annexures (
  id TEXT PRIMARY KEY,
  annexure_number TEXT NOT NULL,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_km NUMERIC NOT NULL,
  end_km NUMERIC NOT NULL,
  total_km NUMERIC NOT NULL DEFAULT 0,
  total_hours NUMERIC NOT NULL DEFAULT 0,
  night_halts INTEGER NOT NULL DEFAULT 0,
  calculated_amount NUMERIC NOT NULL DEFAULT 0,
  is_billed INTEGER NOT NULL DEFAULT 0,
  invoice_id TEXT REFERENCES invoices(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (length(trim(annexure_number)) > 0),
  CHECK (end_date >= start_date),
  CHECK (start_km >= 0),
  CHECK (end_km >= start_km),
  CHECK (total_km >= 0),
  CHECK (total_hours >= 0),
  CHECK (night_halts >= 0),
  CHECK (calculated_amount >= 0),
  CHECK (
    (is_billed = 0 AND invoice_id IS NULL)
    OR (is_billed = 1 AND invoice_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS annexure_metrics (
  id TEXT PRIMARY KEY,
  annexure_id TEXT NOT NULL REFERENCES annexures(id) ON DELETE CASCADE,
  metric_id TEXT NOT NULL REFERENCES trip_travel_metrics(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (metric_id),
  UNIQUE (annexure_id, seq),
  CHECK (seq > 0)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  trip_id TEXT REFERENCES trips(id),
  annexure_id TEXT REFERENCES annexures(id),
  description TEXT NOT NULL,
  hsn_code TEXT,
  quantity NUMERIC DEFAULT 1,
  rate NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  cgst_rate NUMERIC DEFAULT 0,
  sgst_rate NUMERIC DEFAULT 0,
  igst_rate NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoice_tax_components (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tax_component_id TEXT REFERENCES tax_components(id),
  component_code TEXT NOT NULL,
  component_name TEXT NOT NULL,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('intra_state', 'inter_state', 'all')),
  hsn_code TEXT,
  taxable_base NUMERIC NOT NULL DEFAULT 0,
  rate NUMERIC,
  is_percentage INTEGER NOT NULL,
  flat_amount NUMERIC,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (taxable_base >= 0),
  CHECK (tax_amount >= 0),
  CHECK (rate IS NULL OR rate >= 0),
  CHECK (flat_amount IS NULL OR flat_amount >= 0)
);

CREATE TABLE IF NOT EXISTS invoice_item_tax_components (
  id TEXT PRIMARY KEY,
  invoice_item_id TEXT NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tax_component_id TEXT REFERENCES tax_components(id),
  component_code TEXT NOT NULL,
  component_name TEXT NOT NULL,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('intra_state', 'inter_state', 'all')),
  hsn_code TEXT,
  taxable_base NUMERIC NOT NULL DEFAULT 0,
  rate NUMERIC,
  is_percentage INTEGER NOT NULL,
  flat_amount NUMERIC,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (taxable_base >= 0),
  CHECK (tax_amount >= 0),
  CHECK (rate IS NULL OR rate >= 0),
  CHECK (flat_amount IS NULL OR flat_amount >= 0)
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  collection_number TEXT UNIQUE NOT NULL,
  collection_date TEXT NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount NUMERIC NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card')),
  reference_number TEXT,
  bank_name TEXT,
  remarks TEXT,
  created_by TEXT REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS financial_ledger (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'invoice_issued',
    'invoice_deleted',
    'payment_received',
    'payment_amended',
    'payment_reversed',
    'refund_paid',
    'refund_amended',
    'refund_reversed',
    'invoice_voided',
    'credit_note_issued',
    'credit_note_applied',
    'write_off'
  )),
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  invoice_id TEXT,
  invoice_number TEXT NOT NULL,
  collection_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  direction TEXT NOT NULL CHECK (direction IN ('AR_INCREASE', 'AR_DECREASE')),
  description TEXT NOT NULL,
  performed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS driver_settlements (
  id TEXT PRIMARY KEY,
  settlement_number TEXT UNIQUE NOT NULL,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  total_trips INTEGER DEFAULT 0,
  total_km NUMERIC DEFAULT 0,
  total_allowance NUMERIC DEFAULT 0,
  advances NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  payment_mode TEXT CHECK (payment_mode IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card')),
  payment_date TEXT,
  reference_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  remarks TEXT,
  created_by TEXT REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS owner_settlements (
  id TEXT PRIMARY KEY,
  settlement_number TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL REFERENCES owners_vendors(id),
  vehicle_id TEXT REFERENCES vehicles(id),
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  total_trips INTEGER DEFAULT 0,
  total_km NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  tds_amount NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  payment_mode TEXT CHECK (payment_mode IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card')),
  payment_date TEXT,
  reference_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  remarks TEXT,
  created_by TEXT REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data TEXT,
  new_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_by TEXT REFERENCES profiles(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_leads_customer ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_date ON leads(lead_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON lead_follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_trips_customer ON trips(customer_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_category ON trips(vehicle_category_id);
CREATE INDEX IF NOT EXISTS idx_trips_rate_chart ON trips(rate_chart_id);
CREATE INDEX IF NOT EXISTS idx_trips_rate_chart_item ON trips(rate_chart_item_id);
CREATE INDEX IF NOT EXISTS idx_trips_rate_chart_fixed_route ON trips(rate_chart_fixed_route_id);
CREATE INDEX IF NOT EXISTS idx_trips_parent_trip ON trips(parent_trip_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_travel_metrics_trip_seq ON trip_travel_metrics(trip_id, seq);
CREATE INDEX IF NOT EXISTS idx_trip_travel_metrics_trip ON trip_travel_metrics(trip_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_travel_metrics_source_metric_unique ON trip_travel_metrics(source_metric_id) WHERE source_metric_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_tax_components_active_scope_sort ON tax_components(is_active, applies_to, sort_order);
CREATE INDEX IF NOT EXISTS idx_tax_components_active_hsn ON tax_components(is_active, hsn_code);
CREATE INDEX IF NOT EXISTS idx_invoice_tax_components_invoice ON invoice_tax_components(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_tax_components_component ON invoice_tax_components(component_code);
CREATE INDEX IF NOT EXISTS idx_invoice_item_tax_components_item ON invoice_item_tax_components(invoice_item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_item_tax_components_invoice ON invoice_item_tax_components(invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_annexures_trip_number_unique ON annexures(trip_id, annexure_number);
CREATE INDEX IF NOT EXISTS idx_annexures_trip ON annexures(trip_id);
CREATE INDEX IF NOT EXISTS idx_annexures_invoice ON annexures(invoice_id);
CREATE INDEX IF NOT EXISTS idx_annexures_billed ON annexures(is_billed);
CREATE INDEX IF NOT EXISTS idx_annexure_metrics_annexure ON annexure_metrics(annexure_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_annexure ON invoice_items(annexure_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_annexure_unique ON invoice_items(annexure_id) WHERE annexure_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_categories_name_unique ON vehicle_categories(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_vehicle_categories_active ON vehicle_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicle_category_mappings_category ON vehicle_category_mappings(vehicle_category_id);
CREATE INDEX IF NOT EXISTS idx_rate_charts_customer ON rate_charts(customer_id);
CREATE INDEX IF NOT EXISTS idx_rate_charts_customer_active_dates ON rate_charts(customer_id, is_active, effective_from, effective_to);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_chart_items_unique_package ON rate_chart_items(rate_chart_id, vehicle_category_id, duty_type, package_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_chart_items_default_per_group ON rate_chart_items(rate_chart_id, vehicle_category_id, duty_type) WHERE is_default = 1;
CREATE INDEX IF NOT EXISTS idx_rate_chart_items_chart ON rate_chart_items(rate_chart_id);
CREATE INDEX IF NOT EXISTS idx_rate_chart_items_category ON rate_chart_items(vehicle_category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_chart_fixed_routes_unique ON rate_chart_fixed_routes(rate_chart_id, vehicle_category_id, duty_type, from_location_key, to_location_key);
CREATE INDEX IF NOT EXISTS idx_rate_chart_fixed_routes_chart ON rate_chart_fixed_routes(rate_chart_id);
CREATE INDEX IF NOT EXISTS idx_rate_chart_fixed_routes_category ON rate_chart_fixed_routes(vehicle_category_id);
CREATE INDEX IF NOT EXISTS idx_collections_invoice ON collections(invoice_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_invoice ON financial_ledger(invoice_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_customer ON financial_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_created_at_desc ON financial_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_type_status ON invoices(invoice_type, invoice_status);
CREATE INDEX IF NOT EXISTS idx_invoices_reference ON invoices(reference_invoice_id);
CREATE INDEX IF NOT EXISTS idx_driver_settlements_driver ON driver_settlements(driver_id);
CREATE INDEX IF NOT EXISTS idx_owner_settlements_owner ON owner_settlements(owner_id);

INSERT INTO gst_rates (id, hsn_code, description, cgst_rate, sgst_rate, igst_rate, is_active, created_at) VALUES
  ('gst-9964', '9964', 'Passenger Transport Services', 2.5, 2.5, 5, 1, datetime('now')),
  ('gst-9967', '9967', 'Renting of Transport Vehicles', 2.5, 2.5, 5, 1, datetime('now'))
ON CONFLICT (hsn_code) DO NOTHING;

INSERT INTO tax_components (
  id, component_code, name, rate, is_percentage, flat_amount, applies_to, hsn_code, is_active, sort_order, created_at, updated_at
) VALUES
  ('tax-cgst', 'CGST', 'CGST', 2.5, 1, NULL, 'intra_state', '9964', 1, 10, datetime('now'), datetime('now')),
  ('tax-sgst', 'SGST', 'SGST', 2.5, 1, NULL, 'intra_state', '9964', 1, 20, datetime('now'), datetime('now')),
  ('tax-igst', 'IGST', 'IGST', 5, 1, NULL, 'inter_state', '9964', 1, 10, datetime('now'), datetime('now'))
ON CONFLICT (component_code) DO NOTHING;

INSERT INTO system_settings (id, setting_key, setting_value, description, updated_at) VALUES
  ('setting-company-name', 'company_name', 'Travel ERP', 'Company Name', datetime('now')),
  ('setting-company-address', 'company_address', 'Mumbai, Maharashtra', 'Company Address', datetime('now')),
  ('setting-company-gstin', 'company_gstin', '27ABCDE1234F1Z5', 'Company GSTIN', datetime('now')),
  ('setting-company-pan', 'company_pan', 'ABCDE1234F', 'Company PAN', datetime('now')),
  ('setting-bank-name', 'bank_name', '', 'Company Bank Name', datetime('now')),
  ('setting-bank-account', 'bank_account', '', 'Company Bank Account', datetime('now')),
  ('setting-bank-ifsc', 'bank_ifsc', '', 'Company Bank IFSC', datetime('now')),
  ('setting-lead-prefix', 'lead_prefix', 'LEAD', 'Lead Number Prefix', datetime('now')),
  ('setting-booking-prefix', 'booking_prefix', 'BK', 'Booking Number Prefix', datetime('now')),
  ('setting-invoice-prefix', 'invoice_prefix', 'INV', 'Invoice Number Prefix', datetime('now')),
  ('setting-trip-prefix', 'trip_prefix', 'TRP', 'Trip Number Prefix', datetime('now')),
  ('setting-financial-year-start', 'financial_year_start', '04', 'Financial Year Start Month', datetime('now'))
ON CONFLICT (setting_key) DO NOTHING;
