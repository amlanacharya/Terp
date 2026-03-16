/*
  # Travel ERP Database Schema
  
  ## Overview
  Complete schema for a travel ERP system with trip management, driver/vehicle allocation,
  invoicing, collections, settlements, GST compliance, and reporting.
  
  ## Tables Created
  
  ### 1. User Management
  - `profiles` - Extended user profiles with roles and permissions
  
  ### 2. Master Data
  - `drivers` - Driver master with license and contact details
  - `vehicles` - Vehicle master with ownership and registration details
  - `owners_vendors` - Vehicle owners and vendor master
  - `customers` - Customer master for billing
  - `routes` - Predefined routes with distances
  - `gst_rates` - GST rate master
  
  ### 3. Operational Tables
  - `trips` - Trip/duty records with route, vehicle, driver allocation
  - `trip_expenses` - Expenses incurred during trips
  - `invoices` - Customer invoices for trips
  - `invoice_items` - Line items in invoices
  - `collections` - Payment collections against invoices
  - `driver_settlements` - Payment settlements to drivers
  - `owner_settlements` - Payment settlements to owners/vendors
  
  ### 4. Audit & Configuration
  - `audit_log` - System audit trail
  - `system_settings` - Application configuration
  
  ## Security
  - RLS enabled on all tables
  - Policies based on user roles and ownership
  - Authenticated users only access
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'accountant', 'operator', 'viewer');
CREATE TYPE trip_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'completed', 'overdue');
CREATE TYPE payment_mode AS ENUM ('cash', 'cheque', 'bank_transfer', 'upi', 'card');
CREATE TYPE vehicle_type AS ENUM ('bus', 'mini_bus', 'van', 'car', 'truck');
CREATE TYPE settlement_status AS ENUM ('pending', 'approved', 'paid');

-- ============================================================================
-- USER MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- MASTER DATA
-- ============================================================================

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
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and admins can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
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

ALTER TABLE owners_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view owners_vendors"
  ON owners_vendors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and admins can manage owners_vendors"
  ON owners_vendors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
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
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and admins can manage drivers"
  ON drivers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'operator')
    )
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

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and admins can manage vehicles"
  ON vehicles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'operator')
    )
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

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view routes"
  ON routes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and admins can manage routes"
  ON routes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
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

ALTER TABLE gst_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view gst_rates"
  ON gst_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage gst_rates"
  ON gst_rates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- OPERATIONAL TABLES
-- ============================================================================

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

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view trips"
  ON trips FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operators and above can manage trips"
  ON trips FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'operator')
    )
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

ALTER TABLE trip_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view trip_expenses"
  ON trip_expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operators and above can manage trip_expenses"
  ON trip_expenses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'operator', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'operator', 'accountant')
    )
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

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants and above can manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'accountant')
    )
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

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoice_items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants and above can manage invoice_items"
  ON invoice_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'accountant')
    )
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

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view collections"
  ON collections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants and above can manage collections"
  ON collections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'accountant')
    )
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

ALTER TABLE driver_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view driver_settlements"
  ON driver_settlements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants and above can manage driver_settlements"
  ON driver_settlements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'accountant')
    )
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

ALTER TABLE owner_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view owner_settlements"
  ON owner_settlements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants and above can manage owner_settlements"
  ON owner_settlements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'accountant')
    )
  );

-- ============================================================================
-- AUDIT & CONFIGURATION
-- ============================================================================

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

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit_log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  description text,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view system_settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage system_settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trips_customer ON trips(customer_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_collections_invoice ON collections(invoice_id);
CREATE INDEX IF NOT EXISTS idx_driver_settlements_driver ON driver_settlements(driver_id);
CREATE INDEX IF NOT EXISTS idx_owner_settlements_owner ON owner_settlements(owner_id);

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Insert default GST rates
INSERT INTO gst_rates (hsn_code, description, cgst_rate, sgst_rate, igst_rate) VALUES
  ('9964', 'Passenger Transport Services', 2.5, 2.5, 5),
  ('9967', 'Renting of Transport Vehicles', 2.5, 2.5, 5)
ON CONFLICT (hsn_code) DO NOTHING;

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('company_name', 'Travel ERP', 'Company Name'),
  ('company_address', '', 'Company Address'),
  ('company_gstin', '', 'Company GSTIN'),
  ('company_pan', '', 'Company PAN'),
  ('invoice_prefix', 'INV', 'Invoice Number Prefix'),
  ('trip_prefix', 'TRP', 'Trip Number Prefix'),
  ('financial_year_start', '04', 'Financial Year Start Month')
ON CONFLICT (setting_key) DO NOTHING;