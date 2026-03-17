DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duty_type') THEN
    CREATE TYPE duty_type AS ENUM ('local', 'outstation', 'drop_pickup', 'station_drop', 'long');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS vehicle_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_categories_name_unique ON vehicle_categories (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_vehicle_categories_active ON vehicle_categories(is_active);

CREATE TABLE IF NOT EXISTS vehicle_category_mappings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_category_id uuid NOT NULL REFERENCES vehicle_categories(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_category_mappings_category ON vehicle_category_mappings(vehicle_category_id);

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS default_vehicle_id uuid REFERENCES vehicles(id);

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS night_halt_rate numeric(12,2) DEFAULT 0;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS ot_per_hour numeric(12,2) DEFAULT 0;

ALTER TABLE drivers
  ALTER COLUMN night_halt_rate SET DEFAULT 0;

ALTER TABLE drivers
  ALTER COLUMN ot_per_hour SET DEFAULT 0;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS default_duty_start_time time;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS default_duty_end_time time;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS default_duty_hours numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_gt_rates_nonnegative') THEN
    ALTER TABLE drivers
      ADD CONSTRAINT drivers_gt_rates_nonnegative
      CHECK (
        (night_halt_rate IS NULL OR night_halt_rate >= 0)
        AND (ot_per_hour IS NULL OR ot_per_hour >= 0)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_default_duty_hours_nonnegative') THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_default_duty_hours_nonnegative
      CHECK (default_duty_hours IS NULL OR default_duty_hours >= 0);
  END IF;
END $$;
