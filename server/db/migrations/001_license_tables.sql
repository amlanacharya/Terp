-- License System Tables for TravelERP Lite
-- Migration: 001_license_tables.sql
-- Date: 2026-03-25

-- Available key pool (imported but not yet activated)
CREATE TABLE IF NOT EXISTS license_pool (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_key text NOT NULL UNIQUE,
  subscription_type text NOT NULL CHECK (subscription_type IN ('monthly', 'quarterly', 'annual')),
  date_added timestamptz DEFAULT now(),
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activated licenses
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_key text NOT NULL UNIQUE,
  subscription_type text NOT NULL CHECK (subscription_type IN ('monthly', 'quarterly', 'annual')),
  activation_date timestamptz NOT NULL,
  expiry_date timestamptz NOT NULL,
  hardware_fingerprint text NOT NULL,
  last_verified timestamptz DEFAULT now(),
  grace_period_used boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Import logs (Intelligrip's audit trail)
CREATE TABLE IF NOT EXISTS license_import_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_date timestamptz DEFAULT now(),
  keys_imported integer NOT NULL,
  monthly_count integer DEFAULT 0,
  quarterly_count integer DEFAULT 0,
  annual_count integer DEFAULT 0,
  file_name text,
  notes jsonb,
  imported_by text,
  created_at timestamptz DEFAULT now()
);

-- Company settings (stored separately from licenses)
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name text NOT NULL,
  business_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  pin_code text NOT NULL,
  gst_number text,
  pan_number text,
  phone text NOT NULL,
  email text NOT NULL,
  sac_code text DEFAULT '998511',
  default_duty_start_time text DEFAULT '09:00',
  default_duty_hours integer DEFAULT 8,
  invoice_pdf_mode text DEFAULT 'invoice_only',
  tax_config jsonb DEFAULT '{
    "intra_state": {"cgst_rate": 2.5, "sgst_rate": 2.5},
    "inter_state": {"igst_rate": 5.0}
  }',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- License activation logs (audit trail)
CREATE TABLE IF NOT EXISTS license_activation_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id uuid REFERENCES licenses(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('activation', 'verification', 'expiry_warning', 'grace_period', 'readonly_mode', 'expired', 'reactivation')),
  hardware_fingerprint text,
  ip_address text,
  user_agent text,
  status_code text,
  message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_license_pool_product_key ON license_pool(product_key);
CREATE INDEX IF NOT EXISTS idx_license_pool_available ON license_pool(is_available) WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_licenses_product_key ON licenses(product_key);
CREATE INDEX IF NOT EXISTS idx_licenses_fingerprint ON licenses(hardware_fingerprint);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry ON licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_licenses_active ON licenses(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_license_activation_logs_license_id ON license_activation_logs(license_id);
CREATE INDEX IF NOT EXISTS idx_license_activation_logs_created_at ON license_activation_logs(created_at);

-- Comments for documentation
COMMENT ON TABLE license_pool IS 'Pool of available product keys imported but not yet activated';
COMMENT ON TABLE licenses IS 'Activated licenses with hardware binding and expiry tracking';
COMMENT ON TABLE license_import_logs IS 'Audit trail for license key imports by Intelligrip';
COMMENT ON TABLE company_settings IS 'Company information and configuration';
COMMENT ON TABLE license_activation_logs IS 'Audit trail for license lifecycle events';

COMMENT ON COLUMN licenses.hardware_fingerprint IS 'Hardware fingerprint to prevent key sharing';
COMMENT ON COLUMN licenses.grace_period_used IS 'Whether the 7-day grace period has been used';
COMMENT ON COLUMN licenses.is_active IS 'License is active (not revoked/expired)';
COMMENT ON COLUMN company_settings.tax_config IS 'Dynamic tax configuration for GST calculations';
