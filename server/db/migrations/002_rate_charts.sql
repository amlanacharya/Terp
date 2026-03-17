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

CREATE INDEX IF NOT EXISTS idx_rate_charts_customer ON rate_charts(customer_id);
CREATE INDEX IF NOT EXISTS idx_rate_charts_customer_active_dates ON rate_charts(customer_id, is_active, effective_from, effective_to);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_chart_items_unique_package ON rate_chart_items(rate_chart_id, vehicle_category_id, duty_type, package_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_chart_items_default_per_group ON rate_chart_items(rate_chart_id, vehicle_category_id, duty_type) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_rate_chart_items_chart ON rate_chart_items(rate_chart_id);
CREATE INDEX IF NOT EXISTS idx_rate_chart_items_category ON rate_chart_items(vehicle_category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_chart_fixed_routes_unique ON rate_chart_fixed_routes(rate_chart_id, vehicle_category_id, duty_type, from_location_key, to_location_key);
CREATE INDEX IF NOT EXISTS idx_rate_chart_fixed_routes_chart ON rate_chart_fixed_routes(rate_chart_id);
CREATE INDEX IF NOT EXISTS idx_rate_chart_fixed_routes_category ON rate_chart_fixed_routes(vehicle_category_id);
