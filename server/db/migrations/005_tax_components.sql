DO $$
BEGIN
  CREATE TYPE tax_application_scope AS ENUM ('intra_state', 'inter_state', 'all');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tax_components (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  component_code text UNIQUE NOT NULL,
  name text NOT NULL,
  rate numeric(8,4),
  is_percentage boolean NOT NULL DEFAULT true,
  flat_amount numeric(15,2),
  applies_to tax_application_scope NOT NULL DEFAULT 'all',
  hsn_code text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(component_code)) > 0),
  CHECK (length(btrim(name)) > 0),
  CHECK (rate IS NULL OR rate >= 0),
  CHECK (flat_amount IS NULL OR flat_amount >= 0),
  CHECK (
    (is_percentage = true AND rate IS NOT NULL AND flat_amount IS NULL)
    OR (is_percentage = false AND rate IS NULL AND flat_amount IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS invoice_tax_components (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tax_component_id uuid REFERENCES tax_components(id),
  component_code text NOT NULL,
  component_name text NOT NULL,
  applies_to tax_application_scope NOT NULL,
  hsn_code text,
  taxable_base numeric(15,2) NOT NULL DEFAULT 0,
  rate numeric(8,4),
  is_percentage boolean NOT NULL,
  flat_amount numeric(15,2),
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (taxable_base >= 0),
  CHECK (tax_amount >= 0),
  CHECK (rate IS NULL OR rate >= 0),
  CHECK (flat_amount IS NULL OR flat_amount >= 0)
);

CREATE TABLE IF NOT EXISTS invoice_item_tax_components (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_item_id uuid NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tax_component_id uuid REFERENCES tax_components(id),
  component_code text NOT NULL,
  component_name text NOT NULL,
  applies_to tax_application_scope NOT NULL,
  hsn_code text,
  taxable_base numeric(15,2) NOT NULL DEFAULT 0,
  rate numeric(8,4),
  is_percentage boolean NOT NULL,
  flat_amount numeric(15,2),
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (taxable_base >= 0),
  CHECK (tax_amount >= 0),
  CHECK (rate IS NULL OR rate >= 0),
  CHECK (flat_amount IS NULL OR flat_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tax_components_active_scope_sort ON tax_components(is_active, applies_to, sort_order);
CREATE INDEX IF NOT EXISTS idx_tax_components_active_hsn ON tax_components(is_active, hsn_code);
CREATE INDEX IF NOT EXISTS idx_invoice_tax_components_invoice ON invoice_tax_components(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_tax_components_component ON invoice_tax_components(component_code);
CREATE INDEX IF NOT EXISTS idx_invoice_item_tax_components_item ON invoice_item_tax_components(invoice_item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_item_tax_components_invoice ON invoice_item_tax_components(invoice_id);

INSERT INTO tax_components (component_code, name, rate, is_percentage, flat_amount, applies_to, hsn_code, is_active, sort_order) VALUES
  ('CGST', 'CGST', 2.5, true, NULL, 'intra_state', '9964', true, 10),
  ('SGST', 'SGST', 2.5, true, NULL, 'intra_state', '9964', true, 20),
  ('IGST', 'IGST', 5, true, NULL, 'inter_state', '9964', true, 10)
ON CONFLICT (component_code) DO NOTHING;
