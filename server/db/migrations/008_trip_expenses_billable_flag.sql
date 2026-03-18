ALTER TABLE trip_expenses
  ADD COLUMN IF NOT EXISTS is_billable_to_hirer boolean NOT NULL DEFAULT false;
