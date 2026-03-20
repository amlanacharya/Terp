ALTER TABLE trip_travel_metrics
  ADD COLUMN IF NOT EXISTS source_metric_id uuid REFERENCES trip_travel_metrics(id);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS booking_date date,
  ADD COLUMN IF NOT EXISTS duty_type_label text,
  ADD COLUMN IF NOT EXISTS nature_of_journey text,
  ADD COLUMN IF NOT EXISTS vehicle_number text,
  ADD COLUMN IF NOT EXISTS vehicle_type_label text,
  ADD COLUMN IF NOT EXISTS duty_slip_number text,
  ADD COLUMN IF NOT EXISTS total_km numeric(10,2),
  ADD COLUMN IF NOT EXISTS total_hours numeric(8,2),
  ADD COLUMN IF NOT EXISTS payment_terms_days integer,
  ADD COLUMN IF NOT EXISTS interest_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_total_km_non_negative'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_total_km_non_negative CHECK (total_km IS NULL OR total_km >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_total_hours_non_negative'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_total_hours_non_negative CHECK (total_hours IS NULL OR total_hours >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_payment_terms_days_non_negative'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_payment_terms_days_non_negative CHECK (payment_terms_days IS NULL OR payment_terms_days >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS annexures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  annexure_number text NOT NULL,
  parent_trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_km numeric(10,2) NOT NULL,
  end_km numeric(10,2) NOT NULL,
  total_km numeric(10,2) NOT NULL DEFAULT 0,
  total_hours numeric(8,2) NOT NULL DEFAULT 0,
  night_halts integer NOT NULL DEFAULT 0,
  calculated_amount numeric(15,2) NOT NULL DEFAULT 0,
  is_billed boolean NOT NULL DEFAULT false,
  invoice_id uuid REFERENCES invoices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(annexure_number)) > 0),
  CHECK (end_date >= start_date),
  CHECK (start_km >= 0),
  CHECK (end_km >= start_km),
  CHECK (total_km >= 0),
  CHECK (total_hours >= 0),
  CHECK (night_halts >= 0),
  CHECK (calculated_amount >= 0),
  CHECK (
    (is_billed = false AND invoice_id IS NULL)
    OR (is_billed = true AND invoice_id IS NOT NULL)
  )
);

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS annexure_id uuid REFERENCES annexures(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_travel_metrics_source_metric_unique ON trip_travel_metrics(source_metric_id) WHERE source_metric_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_annexures_parent_number_unique ON annexures(parent_trip_id, annexure_number);
CREATE INDEX IF NOT EXISTS idx_annexures_parent_trip ON annexures(parent_trip_id);
CREATE INDEX IF NOT EXISTS idx_annexures_invoice ON annexures(invoice_id);
CREATE INDEX IF NOT EXISTS idx_annexures_billed ON annexures(is_billed);
CREATE INDEX IF NOT EXISTS idx_invoice_items_annexure ON invoice_items(annexure_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_annexure_unique ON invoice_items(annexure_id) WHERE annexure_id IS NOT NULL;
