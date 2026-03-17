CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'accountant', 'operator', 'viewer');
CREATE TYPE trip_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'completed', 'overdue');
CREATE TYPE payment_mode AS ENUM ('cash', 'cheque', 'bank_transfer', 'upi', 'card');
CREATE TYPE vehicle_type AS ENUM ('bus', 'mini_bus', 'van', 'car', 'truck');
CREATE TYPE duty_type AS ENUM ('local', 'outstation', 'drop_pickup', 'station_drop', 'long');
CREATE TYPE settlement_status AS ENUM ('pending', 'approved', 'paid');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'quoted', 'negotiating', 'converted', 'lost', 'on_hold');
CREATE TYPE lead_source AS ENUM ('walk_in', 'phone', 'email', 'whatsapp', 'website', 'referral', 'repeat_customer', 'agent', 'other');
CREATE TYPE lead_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  phone text,
  password_hash text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code text UNIQUE NOT NULL,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  pincode text,
  gstin text,
  credit_limit numeric(15,2) DEFAULT 0,
  credit_days integer DEFAULT 0,
  default_duty_start_time time,
  default_duty_end_time time,
  default_duty_hours numeric(5,2) CHECK (default_duty_hours IS NULL OR default_duty_hours >= 0),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owners_vendors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  pincode text,
  gstin text,
  pan text,
  bank_name text,
  bank_account text,
  ifsc_code text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_code text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  city text,
  state text,
  license_number text UNIQUE NOT NULL,
  license_expiry date NOT NULL,
  date_of_birth date,
  blood_group text,
  emergency_contact text,
  emergency_phone text,
  pan text,
  bank_name text,
  bank_account text,
  ifsc_code text,
  night_halt_rate numeric(12,2) DEFAULT 0 CHECK (night_halt_rate IS NULL OR night_halt_rate >= 0),
  ot_per_hour numeric(12,2) DEFAULT 0 CHECK (ot_per_hour IS NULL OR ot_per_hour >= 0),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_code text UNIQUE NOT NULL,
  from_location text NOT NULL,
  to_location text NOT NULL,
  distance_km numeric(10,2) NOT NULL,
  estimated_hours numeric(5,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_number text UNIQUE NOT NULL,
  vehicle_type vehicle_type NOT NULL,
  make text,
  model text,
  year integer,
  seating_capacity integer,
  owner_id uuid REFERENCES owners_vendors(id),
  registration_date date,
  insurance_expiry date,
  permit_expiry date,
  fitness_expiry date,
  pollution_expiry date,
  is_owned boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS default_vehicle_id uuid REFERENCES vehicles(id);

CREATE TABLE IF NOT EXISTS vehicle_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_category_mappings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_category_id uuid NOT NULL REFERENCES vehicle_categories(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vehicle_id)
);

CREATE TABLE IF NOT EXISTS rate_charts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  name text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS rate_chart_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_chart_id uuid NOT NULL REFERENCES rate_charts(id) ON DELETE CASCADE,
  vehicle_category_id uuid NOT NULL REFERENCES vehicle_categories(id),
  duty_type duty_type NOT NULL,
  package_code text NOT NULL,
  package_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  base_hours numeric(6,2),
  base_km numeric(10,2),
  base_amount numeric(12,2),
  extra_km_rate numeric(12,2),
  extra_hr_rate numeric(12,2),
  fuel_divisor numeric(10,4),
  fuel_price_per_unit numeric(12,4),
  night_halt_rate numeric(12,2),
  fixed_amount numeric(12,2),
  use_higher_of_km_hr boolean NOT NULL DEFAULT false,
  per_km_rate numeric(12,2),
  ot_rate numeric(12,2),
  long_km_threshold numeric(10,2),
  no_km_limit_cap_km numeric(10,2),
  long_day_hours numeric(6,2),
  long_night_halt_hours numeric(6,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(package_code)) > 0),
  CHECK (length(btrim(package_label)) > 0),
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_chart_id uuid NOT NULL REFERENCES rate_charts(id) ON DELETE CASCADE,
  vehicle_category_id uuid NOT NULL REFERENCES vehicle_categories(id),
  duty_type duty_type NOT NULL,
  from_location text NOT NULL,
  to_location text NOT NULL,
  from_location_key text NOT NULL,
  to_location_key text NOT NULL,
  fixed_amount numeric(12,2) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(from_location)) > 0),
  CHECK (length(btrim(to_location)) > 0),
  CHECK (length(btrim(from_location_key)) > 0),
  CHECK (length(btrim(to_location_key)) > 0),
  CHECK (fixed_amount > 0)
);
CREATE TABLE IF NOT EXISTS gst_rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  hsn_code text UNIQUE NOT NULL,
  description text NOT NULL,
  cgst_rate numeric(5,2) NOT NULL,
  sgst_rate numeric(5,2) NOT NULL,
  igst_rate numeric(5,2) NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_number text UNIQUE NOT NULL,
  lead_date timestamptz NOT NULL DEFAULT now(),
  source lead_source NOT NULL,
  customer_id uuid REFERENCES customers(id),
  prospect_name text,
  prospect_phone text NOT NULL,
  prospect_email text,
  prospect_company text,
  trip_type text NOT NULL,
  from_location text NOT NULL,
  to_location text,
  travel_date date NOT NULL,
  return_date date,
  pax_count integer NOT NULL,
  vehicle_preference vehicle_type,
  num_vehicles integer DEFAULT 1,
  special_requirements text,
  estimated_amount numeric(12,2),
  status lead_status NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES profiles(id),
  priority lead_priority NOT NULL DEFAULT 'medium',
  lost_reason text,
  converted_booking_id uuid,
  remarks text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_follow_ups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  follow_up_date timestamptz NOT NULL,
  next_follow_up timestamptz,
  contact_mode text NOT NULL,
  summary text NOT NULL,
  quoted_amount numeric(12,2),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) NOT NULL,
  route_id uuid REFERENCES routes(id),
  vehicle_id uuid REFERENCES vehicles(id) NOT NULL,
  driver_id uuid REFERENCES drivers(id) NOT NULL,
  trip_date date NOT NULL,
  start_time timestamptz,
  end_time timestamptz,
  start_km numeric(10,2),
  end_km numeric(10,2),
  actual_km numeric(10,2),
  from_location text NOT NULL,
  to_location text NOT NULL,
  purpose text,
  passengers integer,
  status trip_status DEFAULT 'scheduled',
  trip_amount numeric(15,2) NOT NULL,
  driver_allowance numeric(15,2) DEFAULT 0,
  toll_charges numeric(15,2) DEFAULT 0,
  parking_charges numeric(15,2) DEFAULT 0,
  other_charges numeric(15,2) DEFAULT 0,
  remarks text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  expense_type text NOT NULL,
  amount numeric(15,2) NOT NULL,
  description text,
  receipt_number text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number text UNIQUE NOT NULL,
  invoice_date date NOT NULL,
  customer_id uuid REFERENCES customers(id) NOT NULL,
  billing_address text,
  customer_gstin text,
  subtotal numeric(15,2) NOT NULL,
  cgst_amount numeric(15,2) DEFAULT 0,
  sgst_amount numeric(15,2) DEFAULT 0,
  igst_amount numeric(15,2) DEFAULT 0,
  total_amount numeric(15,2) NOT NULL,
  payment_status payment_status DEFAULT 'pending',
  due_date date,
  remarks text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id),
  description text NOT NULL,
  hsn_code text,
  quantity numeric(10,2) DEFAULT 1,
  rate numeric(15,2) NOT NULL,
  amount numeric(15,2) NOT NULL,
  cgst_rate numeric(5,2) DEFAULT 0,
  sgst_rate numeric(5,2) DEFAULT 0,
  igst_rate numeric(5,2) DEFAULT 0,
  cgst_amount numeric(15,2) DEFAULT 0,
  sgst_amount numeric(15,2) DEFAULT 0,
  igst_amount numeric(15,2) DEFAULT 0,
  total_amount numeric(15,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_number text UNIQUE NOT NULL,
  collection_date date NOT NULL,
  invoice_id uuid REFERENCES invoices(id) NOT NULL,
  amount numeric(15,2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  reference_number text,
  bank_name text,
  remarks text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_settlements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_number text UNIQUE NOT NULL,
  driver_id uuid REFERENCES drivers(id) NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  total_trips integer DEFAULT 0,
  total_km numeric(10,2) DEFAULT 0,
  total_allowance numeric(15,2) DEFAULT 0,
  advances numeric(15,2) DEFAULT 0,
  deductions numeric(15,2) DEFAULT 0,
  net_amount numeric(15,2) NOT NULL,
  payment_mode payment_mode,
  payment_date date,
  reference_number text,
  status settlement_status DEFAULT 'pending',
  remarks text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_settlements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_number text UNIQUE NOT NULL,
  owner_id uuid REFERENCES owners_vendors(id) NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id),
  period_from date NOT NULL,
  period_to date NOT NULL,
  total_trips integer DEFAULT 0,
  total_km numeric(10,2) DEFAULT 0,
  total_amount numeric(15,2) DEFAULT 0,
  tds_amount numeric(15,2) DEFAULT 0,
  other_deductions numeric(15,2) DEFAULT 0,
  net_amount numeric(15,2) NOT NULL,
  payment_mode payment_mode,
  payment_date date,
  reference_number text,
  status settlement_status DEFAULT 'pending',
  remarks text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  description text,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
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
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_categories_name_unique ON vehicle_categories (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_vehicle_categories_active ON vehicle_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicle_category_mappings_category ON vehicle_category_mappings(vehicle_category_id);
CREATE INDEX IF NOT EXISTS idx_rate_charts_customer ON rate_charts(customer_id);
CREATE INDEX IF NOT EXISTS idx_rate_charts_customer_active_dates ON rate_charts(customer_id, is_active, effective_from, effective_to);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_chart_items_unique_package ON rate_chart_items(rate_chart_id, vehicle_category_id, duty_type, package_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_chart_items_default_per_group ON rate_chart_items(rate_chart_id, vehicle_category_id, duty_type) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_rate_chart_items_chart ON rate_chart_items(rate_chart_id);
CREATE INDEX IF NOT EXISTS idx_rate_chart_items_category ON rate_chart_items(vehicle_category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_chart_fixed_routes_unique ON rate_chart_fixed_routes(rate_chart_id, vehicle_category_id, duty_type, from_location_key, to_location_key);
CREATE INDEX IF NOT EXISTS idx_rate_chart_fixed_routes_chart ON rate_chart_fixed_routes(rate_chart_id);
CREATE INDEX IF NOT EXISTS idx_rate_chart_fixed_routes_category ON rate_chart_fixed_routes(vehicle_category_id);CREATE INDEX IF NOT EXISTS idx_collections_invoice ON collections(invoice_id);
CREATE INDEX IF NOT EXISTS idx_driver_settlements_driver ON driver_settlements(driver_id);
CREATE INDEX IF NOT EXISTS idx_owner_settlements_owner ON owner_settlements(owner_id);

INSERT INTO gst_rates (hsn_code, description, cgst_rate, sgst_rate, igst_rate) VALUES
  ('9964', 'Passenger Transport Services', 2.5, 2.5, 5),
  ('9967', 'Renting of Transport Vehicles', 2.5, 2.5, 5)
ON CONFLICT (hsn_code) DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('company_name', 'Travel ERP', 'Company Name'),
  ('company_address', 'Mumbai, Maharashtra', 'Company Address'),
  ('company_gstin', '27ABCDE1234F1Z5', 'Company GSTIN'),
  ('company_pan', 'ABCDE1234F', 'Company PAN'),
  ('bank_name', '', 'Company Bank Name'),
  ('bank_account', '', 'Company Bank Account'),
  ('bank_ifsc', '', 'Company Bank IFSC'),
  ('lead_prefix', 'LEAD', 'Lead Number Prefix'),
  ('booking_prefix', 'BK', 'Booking Number Prefix'),
  ('invoice_prefix', 'INV', 'Invoice Number Prefix'),
  ('trip_prefix', 'TRP', 'Trip Number Prefix'),
  ('financial_year_start', '04', 'Financial Year Start Month')
ON CONFLICT (setting_key) DO NOTHING;





