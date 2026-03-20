ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS duty_type duty_type,
  ADD COLUMN IF NOT EXISTS booked_by text,
  ADD COLUMN IF NOT EXISTS report_to text,
  ADD COLUMN IF NOT EXISTS vehicle_category_id uuid REFERENCES vehicle_categories(id),
  ADD COLUMN IF NOT EXISTS rate_chart_id uuid REFERENCES rate_charts(id),
  ADD COLUMN IF NOT EXISTS rate_chart_item_id uuid REFERENCES rate_chart_items(id),
  ADD COLUMN IF NOT EXISTS rate_chart_fixed_route_id uuid REFERENCES rate_chart_fixed_routes(id),
  ADD COLUMN IF NOT EXISTS total_hours numeric(8,2),
  ADD COLUMN IF NOT EXISTS night_halts integer,
  ADD COLUMN IF NOT EXISTS advance_hirer numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_travels numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_advance numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_advance numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_charge numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_km_charge numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_hr_charge numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS night_halt_charge numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_charge numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fixed_route_charge numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_charge numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculated_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS is_long_trip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_trip_id uuid REFERENCES trips(id),
  ADD COLUMN IF NOT EXISTS annexure_number text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_total_hours_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_total_hours_non_negative CHECK (total_hours IS NULL OR total_hours >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_night_halts_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_night_halts_non_negative CHECK (night_halts IS NULL OR night_halts >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_advance_hirer_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_advance_hirer_non_negative CHECK (advance_hirer >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_advance_travels_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_advance_travels_non_negative CHECK (advance_travels >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_fuel_advance_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_fuel_advance_non_negative CHECK (fuel_advance >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_cash_advance_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_cash_advance_non_negative CHECK (cash_advance >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_base_charge_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_base_charge_non_negative CHECK (base_charge >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_extra_km_charge_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_extra_km_charge_non_negative CHECK (extra_km_charge >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_extra_hr_charge_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_extra_hr_charge_non_negative CHECK (extra_hr_charge >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_night_halt_charge_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_night_halt_charge_non_negative CHECK (night_halt_charge >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_fuel_charge_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_fuel_charge_non_negative CHECK (fuel_charge >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_fixed_route_charge_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_fixed_route_charge_non_negative CHECK (fixed_route_charge >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_ot_charge_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_ot_charge_non_negative CHECK (ot_charge >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_calculated_amount_non_negative'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_calculated_amount_non_negative CHECK (calculated_amount IS NULL OR calculated_amount >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS trip_travel_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  start_date date NOT NULL,
  start_time time NOT NULL,
  start_km numeric(10,2) NOT NULL,
  end_date date,
  end_time time,
  end_km numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (seq > 0),
  CHECK (start_km >= 0),
  CHECK (end_km IS NULL OR end_km >= start_km),
  CHECK (
    (end_date IS NULL AND end_time IS NULL AND end_km IS NULL)
    OR (end_date IS NOT NULL AND end_time IS NOT NULL AND end_km IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_trips_vehicle_category ON trips(vehicle_category_id);
CREATE INDEX IF NOT EXISTS idx_trips_rate_chart ON trips(rate_chart_id);
CREATE INDEX IF NOT EXISTS idx_trips_rate_chart_item ON trips(rate_chart_item_id);
CREATE INDEX IF NOT EXISTS idx_trips_rate_chart_fixed_route ON trips(rate_chart_fixed_route_id);
CREATE INDEX IF NOT EXISTS idx_trips_parent_trip ON trips(parent_trip_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_travel_metrics_trip_seq ON trip_travel_metrics(trip_id, seq);
CREATE INDEX IF NOT EXISTS idx_trip_travel_metrics_trip ON trip_travel_metrics(trip_id);
