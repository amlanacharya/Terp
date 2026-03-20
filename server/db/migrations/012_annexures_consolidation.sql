-- Migration 012: Annexures data-model consolidation for reseeded environments.
-- This migration assumes no legacy child-trip annexure data needs to be preserved.

ALTER TABLE annexures
  DROP CONSTRAINT IF EXISTS annexures_trip_id_key,
  DROP CONSTRAINT IF EXISTS annexures_parent_trip_id_fkey;

DROP INDEX IF EXISTS idx_annexures_parent_number_unique;
DROP INDEX IF EXISTS idx_annexures_parent_trip;
DROP INDEX IF EXISTS idx_annexures_trip_number_unique;
DROP INDEX IF EXISTS idx_annexures_trip;

ALTER TABLE annexures
  DROP COLUMN IF EXISTS parent_trip_id,
  ALTER COLUMN trip_id SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE TABLE IF NOT EXISTS annexure_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  annexure_id uuid NOT NULL REFERENCES annexures(id) ON DELETE CASCADE,
  metric_id uuid NOT NULL REFERENCES trip_travel_metrics(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_id),
  UNIQUE (annexure_id, seq),
  CHECK (seq > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_annexures_trip_number_unique ON annexures(trip_id, annexure_number);
CREATE INDEX IF NOT EXISTS idx_annexures_trip ON annexures(trip_id);
CREATE INDEX IF NOT EXISTS idx_annexure_metrics_annexure ON annexure_metrics(annexure_id);
