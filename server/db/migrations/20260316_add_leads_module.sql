DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
    CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'quoted', 'negotiating', 'converted', 'lost', 'on_hold');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_source') THEN
    CREATE TYPE lead_source AS ENUM ('walk_in', 'phone', 'email', 'whatsapp', 'website', 'referral', 'repeat_customer', 'agent', 'other');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_priority') THEN
    CREATE TYPE lead_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_leads_customer ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_date ON leads(lead_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON lead_follow_ups(lead_id);

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('lead_prefix', 'LEAD', 'Lead Number Prefix'),
  ('booking_prefix', 'BK', 'Booking Number Prefix')
ON CONFLICT (setting_key) DO NOTHING;
