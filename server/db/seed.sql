BEGIN;

-- ---------------------------------------------------------------------------
-- GT demo users
-- ---------------------------------------------------------------------------
INSERT INTO profiles (email, full_name, role, phone, password_hash, is_active)
VALUES
  ('admin@travelerp.com', 'GT Demo Admin', 'admin', '+91-9000000000', crypt('Admin@123456', gen_salt('bf', 10)), true),
  ('manager.gt@travelerp.com', 'GT Demo Manager', 'manager', '+91-9000000001', crypt('GTDemo@123', gen_salt('bf', 10)), true),
  ('accountant.gt@travelerp.com', 'GT Demo Accountant', 'accountant', '+91-9000000002', crypt('GTDemo@123', gen_salt('bf', 10)), true),
  ('operator.gt@travelerp.com', 'GT Demo Operator', 'operator', '+91-9000000003', crypt('GTDemo@123', gen_salt('bf', 10)), true),
  ('viewer.gt@travelerp.com', 'GT Demo Viewer', 'viewer', '+91-9000000004', crypt('GTDemo@123', gen_salt('bf', 10)), true)
ON CONFLICT (email) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- GT system settings for PDF and invoice behaviour
-- ---------------------------------------------------------------------------
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
  ('company_name', 'Gayatri Travels', 'Company Name'),
  ('company_address', 'Janpath, Bhubaneswar, Odisha - 751022', 'Company Address'),
  ('company_gstin', '21AABCT1332L1ZN', 'Company GSTIN'),
  ('company_pan', 'AABCT1332L', 'Company PAN'),
  ('bank_name', 'HDFC Bank', 'Company Bank Name'),
  ('bank_account', '50200012345678', 'Company Bank Account'),
  ('bank_ifsc', 'HDFC0001234', 'Company Bank IFSC'),
  ('lead_prefix', 'GT-LEAD', 'Lead Number Prefix'),
  ('booking_prefix', 'GT-BK', 'Booking Number Prefix'),
  ('invoice_prefix', 'GTINV', 'Invoice Number Prefix'),
  ('trip_prefix', 'GT-TRP', 'Trip Number Prefix'),
  ('financial_year_start', '04', 'Financial Year Start Month')
ON CONFLICT (setting_key) DO UPDATE
SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Dynamic tax configuration (Phase 5)
-- ---------------------------------------------------------------------------
INSERT INTO tax_components (
  component_code,
  name,
  rate,
  is_percentage,
  flat_amount,
  applies_to,
  hsn_code,
  is_active,
  sort_order
)
VALUES
  ('CGST', 'CGST', 2.5, true, NULL, 'intra_state', '9964', true, 10),
  ('SGST', 'SGST', 2.5, true, NULL, 'intra_state', '9964', true, 20),
  ('IGST', 'IGST', 5.0, true, NULL, 'inter_state', '9964', true, 10),
  ('GREENFEE', 'Green Fee', NULL, false, 150.00, 'all', NULL, false, 40)
ON CONFLICT (component_code) DO UPDATE
SET
  name = EXCLUDED.name,
  rate = EXCLUDED.rate,
  is_percentage = EXCLUDED.is_percentage,
  flat_amount = EXCLUDED.flat_amount,
  applies_to = EXCLUDED.applies_to,
  hsn_code = EXCLUDED.hsn_code,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- GT customers
-- ---------------------------------------------------------------------------
INSERT INTO customers (
  id,
  customer_code,
  name,
  contact_person,
  phone,
  email,
  address,
  city,
  state,
  pincode,
  gstin,
  credit_limit,
  credit_days,
  default_duty_start_time,
  default_duty_end_time,
  default_duty_hours,
  invoice_pdf_mode,
  is_active
)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'GT-CUST-RBI', 'RBI Bhubaneswar Office', 'Prakash Mishra', '+91-9123456780', 'accounts.rbi@gtdemo.local', 'RBI Campus, Sachivalaya Marg', 'Bhubaneswar', 'Odisha', '751001', '21AABCU9603R1ZP', 500000, 30, '08:00', '20:00', 12, 'invoice_with_annexures', true),
  ('20000000-0000-0000-0000-000000000002', 'GT-CUST-TSM', 'TSM Logistics Hub', 'Ritesh Parida', '+91-9234567801', 'billing.tsm@gtdemo.local', 'TSM Site Office', 'Talcher', 'Odisha', '759100', '21AACCT2104M1Z5', 350000, 21, '08:00', '18:00', 10, 'invoice_with_annexures', true),
  ('20000000-0000-0000-0000-000000000003', 'GT-CUST-UNIT4', 'UNIT-4 Secretariat', 'Ananya Das', '+91-9234567802', 'admin.unit4@gtdemo.local', 'Unit-4 Administrative Complex', 'Bhubaneswar', 'Odisha', '751001', '21AACCU3410D1Z2', 400000, 21, '09:00', '17:00', 8, 'invoice_with_annexures', true),
  ('20000000-0000-0000-0000-000000000004', 'GT-CUST-NTPC', 'NTPC Western Region', 'Kunal Deshmukh', '+91-9234567803', 'billing.ntpc@gtdemo.local', 'NTPC Office, Andheri East', 'Mumbai', 'Maharashtra', '400059', '27AADCS0472N1ZO', 800000, 45, '06:00', '18:00', 12, 'invoice_with_annexures', true),
  ('20000000-0000-0000-0000-000000000005', 'GT-CUST-IFFCO', 'IFFCO Paradeep Operations', 'Subhash Sahoo', '+91-9234567804', 'accounts.iffco@gtdemo.local', 'IFFCO Township', 'Paradeep', 'Odisha', '754142', '21AAACI1760F1ZO', 650000, 30, '07:00', '19:00', 12, 'invoice_with_annexures', true),
  ('20000000-0000-0000-0000-000000000006', 'GT-CUST-MCL', 'MCL Mining Division', 'Deepak Bhoi', '+91-9234567805', 'billing.mcl@gtdemo.local', 'MCL Area Office', 'Sambalpur', 'Odisha', '768001', '21AACCM4400K1Z7', 550000, 21, '06:00', '18:00', 12, 'invoice_with_annexures', true)
ON CONFLICT (customer_code) DO UPDATE
SET
  name = EXCLUDED.name,
  contact_person = EXCLUDED.contact_person,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  pincode = EXCLUDED.pincode,
  gstin = EXCLUDED.gstin,
  credit_limit = EXCLUDED.credit_limit,
  credit_days = EXCLUDED.credit_days,
  default_duty_start_time = EXCLUDED.default_duty_start_time,
  default_duty_end_time = EXCLUDED.default_duty_end_time,
  default_duty_hours = EXCLUDED.default_duty_hours,
  invoice_pdf_mode = EXCLUDED.invoice_pdf_mode,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Owners and fleet
-- ---------------------------------------------------------------------------
INSERT INTO owners_vendors (
  id,
  code,
  name,
  contact_person,
  phone,
  email,
  address,
  city,
  state,
  pincode,
  gstin,
  pan,
  bank_name,
  bank_account,
  ifsc_code,
  is_active
)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'GTOWN001', 'East Coast Fleet Partners', 'Harish Behera', '+91-9345678901', 'harish@eastcoastfleet.local', 'Plot 12, Fleet Nagar', 'Bhubaneswar', 'Odisha', '751010', '21AABPE1122C1Z9', 'AABPE1122C', 'ICICI Bank', '1234567890123456', 'ICIC0000123', true),
  ('30000000-0000-0000-0000-000000000002', 'GTOWN002', 'Odisha Premium Mobility', 'Nirmal Mohanty', '+91-9345678902', 'nirmal@odishamobility.local', 'Plot 48, Transport Colony', 'Cuttack', 'Odisha', '753001', '21AABPO7788P1ZT', 'AABPO7788P', 'Axis Bank', '9876543210987654', 'UTIB0000456', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  contact_person = EXCLUDED.contact_person,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  pincode = EXCLUDED.pincode,
  gstin = EXCLUDED.gstin,
  pan = EXCLUDED.pan,
  bank_name = EXCLUDED.bank_name,
  bank_account = EXCLUDED.bank_account,
  ifsc_code = EXCLUDED.ifsc_code,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO routes (id, route_code, from_location, to_location, distance_km, estimated_hours, is_active)
VALUES
  ('35000000-0000-0000-0000-000000000001', 'GT-RT-RBI-CITY', 'RBI Bhubaneswar', 'RBI Bhubaneswar', 110, 10, true),
  ('35000000-0000-0000-0000-000000000002', 'GT-RT-TSM-BBSR', 'TSM', 'BBSR', 330, 7, true),
  ('35000000-0000-0000-0000-000000000003', 'GT-RT-UNIT4-CITY', 'UNIT-4', 'UNIT-4', 120, 8, true),
  ('35000000-0000-0000-0000-000000000004', 'GT-RT-NTPC-LONG', 'Mumbai Plant', 'Pune Site', 300, 12, true),
  ('35000000-0000-0000-0000-000000000005', 'GT-RT-IFFCO-OUT', 'Paradeep Plant', 'Bhubaneswar Guest House', 400, 8, true),
  ('35000000-0000-0000-0000-000000000006', 'GT-RT-MCL-PARENT', 'MCL HQ', 'Talcher Mine', 370, 10, true),
  ('35000000-0000-0000-0000-000000000007', 'GT-RT-MCL-READY', 'MCL HQ', 'Ib Valley Site', 260, 7, true)
ON CONFLICT (route_code) DO UPDATE
SET
  from_location = EXCLUDED.from_location,
  to_location = EXCLUDED.to_location,
  distance_km = EXCLUDED.distance_km,
  estimated_hours = EXCLUDED.estimated_hours,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO vehicles (
  id,
  vehicle_number,
  vehicle_type,
  make,
  model,
  year,
  seating_capacity,
  owner_id,
  registration_date,
  insurance_expiry,
  permit_expiry,
  fitness_expiry,
  pollution_expiry,
  is_owned,
  is_active
)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'OD02AB1234', 'car', 'Toyota', 'Innova Crysta', 2023, 7, '30000000-0000-0000-0000-000000000001', '2023-04-01', '2027-03-31', '2027-04-30', '2027-05-31', '2026-12-31', false, true),
  ('40000000-0000-0000-0000-000000000002', 'OD02CD5678', 'car', 'Maruti', 'Dzire', 2022, 4, NULL, '2022-06-15', '2027-06-14', '2027-07-31', '2027-08-31', '2026-11-30', true, true),
  ('40000000-0000-0000-0000-000000000003', 'OD02EF2468', 'car', 'Maruti', 'Ertiga', 2024, 6, '30000000-0000-0000-0000-000000000002', '2024-01-10', '2028-01-09', '2028-02-28', '2028-03-31', '2027-09-30', false, true),
  ('40000000-0000-0000-0000-000000000004', 'OD02GH1357', 'car', 'Toyota', 'Rumion', 2024, 6, NULL, '2024-02-05', '2028-02-04', '2028-03-31', '2028-04-30', '2027-10-31', true, true)
ON CONFLICT (vehicle_number) DO UPDATE
SET
  vehicle_type = EXCLUDED.vehicle_type,
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  seating_capacity = EXCLUDED.seating_capacity,
  owner_id = EXCLUDED.owner_id,
  registration_date = EXCLUDED.registration_date,
  insurance_expiry = EXCLUDED.insurance_expiry,
  permit_expiry = EXCLUDED.permit_expiry,
  fitness_expiry = EXCLUDED.fitness_expiry,
  pollution_expiry = EXCLUDED.pollution_expiry,
  is_owned = EXCLUDED.is_owned,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO drivers (
  id,
  driver_code,
  name,
  phone,
  email,
  address,
  city,
  state,
  license_number,
  license_expiry,
  date_of_birth,
  blood_group,
  emergency_contact,
  emergency_phone,
  pan,
  bank_name,
  bank_account,
  ifsc_code,
  night_halt_rate,
  ot_per_hour,
  default_vehicle_id,
  is_active
)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'GTDRV001', 'Suresh Nayak', '+91-9876543210', 'suresh@gtdemo.local', 'Saheed Nagar', 'Bhubaneswar', 'Odisha', 'OD-DL-12345678901', '2028-12-31', '1989-05-15', 'O+', 'Ramesh Nayak', '+91-9876543211', 'BCPPN5055K', 'SBI', '123456789012', 'SBIN0000123', 500, 120, '40000000-0000-0000-0000-000000000001', true),
  ('50000000-0000-0000-0000-000000000002', 'GTDRV002', 'Amit Das', '+91-9876543212', 'amit@gtdemo.local', 'IRC Village', 'Bhubaneswar', 'Odisha', 'OD-DL-22345678901', '2029-06-30', '1991-08-09', 'A+', 'Madhab Das', '+91-9876543213', 'BCPPD6078L', 'HDFC Bank', '223344556677', 'HDFC0000456', 450, 100, '40000000-0000-0000-0000-000000000002', true),
  ('50000000-0000-0000-0000-000000000003', 'GTDRV003', 'Pradip Swain', '+91-9876543214', 'pradip@gtdemo.local', 'Link Road', 'Cuttack', 'Odisha', 'OD-DL-32345678901', '2028-09-30', '1988-11-22', 'B+', 'Sanjay Swain', '+91-9876543215', 'BCPPS7089M', 'Axis Bank', '998877665544', 'UTIB0000789', 400, 90, '40000000-0000-0000-0000-000000000003', true),
  ('50000000-0000-0000-0000-000000000004', 'GTDRV004', 'Manoj Behera', '+91-9876543216', 'manoj@gtdemo.local', 'Patia', 'Bhubaneswar', 'Odisha', 'OD-DL-42345678901', '2029-03-31', '1990-02-04', 'AB+', 'Sukanta Behera', '+91-9876543217', 'BCPPB9012N', 'Bank of Baroda', '556677889900', 'BARB0BHUBAN', 450, 110, '40000000-0000-0000-0000-000000000004', true)
ON CONFLICT (driver_code) DO UPDATE
SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  license_number = EXCLUDED.license_number,
  license_expiry = EXCLUDED.license_expiry,
  date_of_birth = EXCLUDED.date_of_birth,
  blood_group = EXCLUDED.blood_group,
  emergency_contact = EXCLUDED.emergency_contact,
  emergency_phone = EXCLUDED.emergency_phone,
  pan = EXCLUDED.pan,
  bank_name = EXCLUDED.bank_name,
  bank_account = EXCLUDED.bank_account,
  ifsc_code = EXCLUDED.ifsc_code,
  night_halt_rate = EXCLUDED.night_halt_rate,
  ot_per_hour = EXCLUDED.ot_per_hour,
  default_vehicle_id = EXCLUDED.default_vehicle_id,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Phase 1 vehicle categories and mappings
-- ---------------------------------------------------------------------------
INSERT INTO vehicle_categories (id, name, description, is_active)
VALUES
  ('60000000-0000-0000-0000-000000000001', 'CRYSTA', 'Toyota Innova Crysta billing category', true),
  ('60000000-0000-0000-0000-000000000002', 'DEZIRE', 'Maruti Dzire billing category', true),
  ('60000000-0000-0000-0000-000000000003', '4AIR BAG', 'Fuel-based 4-airbag sedan category', true),
  ('60000000-0000-0000-0000-000000000004', '6AIR BAG', 'Fuel-based 6-airbag MPV category', true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO vehicle_category_mappings (id, vehicle_id, vehicle_category_id)
VALUES
  ('61000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001'),
  ('61000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002'),
  ('61000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003'),
  ('61000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000004')
ON CONFLICT (vehicle_id) DO UPDATE
SET
  vehicle_category_id = EXCLUDED.vehicle_category_id,
  updated_at = now();
-- ---------------------------------------------------------------------------
-- Phase 1 leads and follow ups
-- ---------------------------------------------------------------------------
INSERT INTO leads (
  id,
  lead_number,
  lead_date,
  source,
  customer_id,
  prospect_name,
  prospect_phone,
  prospect_email,
  prospect_company,
  trip_type,
  from_location,
  to_location,
  travel_date,
  return_date,
  pax_count,
  vehicle_preference,
  num_vehicles,
  special_requirements,
  estimated_amount,
  status,
  assigned_to,
  priority,
  lost_reason,
  converted_booking_id,
  remarks,
  created_by
)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'GT-LEAD-0001', '2026-03-01T10:00:00+05:30', 'repeat_customer', '20000000-0000-0000-0000-000000000001', 'RBI Shuttle Renewal', '+91-9123456780', 'accounts.rbi@gtdemo.local', 'RBI Bhubaneswar Office', 'Local shuttle renewal', 'RBI Bhubaneswar', 'RBI Bhubaneswar', '2026-03-05', NULL, 4, 'car', 1, 'Requires CRYSTA package options for office movement.', 3540, 'converted', (SELECT id FROM profiles WHERE email = 'manager.gt@travelerp.com'), 'high', NULL, NULL, 'Converted into RBI demo trip and invoice scenario.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('80000000-0000-0000-0000-000000000002', 'GT-LEAD-0002', '2026-03-02T11:00:00+05:30', 'phone', NULL, 'Project Mobility Desk', '+91-9345600002', 'projects@mcldemo.local', 'MCL Mining Division', 'Multi-day outstation movement', 'MCL HQ', 'Talcher Mine', '2026-03-18', '2026-03-20', 6, 'car', 1, 'Needs annexure-ready day-wise capture and child billing.', 8880, 'negotiating', (SELECT id FROM profiles WHERE email = 'operator.gt@travelerp.com'), 'urgent', NULL, NULL, 'Use this lead to explain parent trip plus annexure billing.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('80000000-0000-0000-0000-000000000003', 'GT-LEAD-0003', '2026-03-03T14:30:00+05:30', 'email', NULL, 'NTPC Mobility Desk', '+91-9345600003', 'mobility@ntpcdemo.local', 'NTPC Western Region', 'Local to long threshold case', 'Mumbai Plant', 'Pune Site', '2026-03-09', NULL, 3, 'car', 1, 'Customer requested local package but distance may cross long threshold.', 6600, 'quoted', (SELECT id FROM profiles WHERE email = 'manager.gt@travelerp.com'), 'high', NULL, NULL, 'Use for threshold upgrade demo.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com'))
ON CONFLICT (lead_number) DO UPDATE
SET
  lead_date = EXCLUDED.lead_date,
  source = EXCLUDED.source,
  customer_id = EXCLUDED.customer_id,
  prospect_name = EXCLUDED.prospect_name,
  prospect_phone = EXCLUDED.prospect_phone,
  prospect_email = EXCLUDED.prospect_email,
  prospect_company = EXCLUDED.prospect_company,
  trip_type = EXCLUDED.trip_type,
  from_location = EXCLUDED.from_location,
  to_location = EXCLUDED.to_location,
  travel_date = EXCLUDED.travel_date,
  return_date = EXCLUDED.return_date,
  pax_count = EXCLUDED.pax_count,
  vehicle_preference = EXCLUDED.vehicle_preference,
  num_vehicles = EXCLUDED.num_vehicles,
  special_requirements = EXCLUDED.special_requirements,
  estimated_amount = EXCLUDED.estimated_amount,
  status = EXCLUDED.status,
  assigned_to = EXCLUDED.assigned_to,
  priority = EXCLUDED.priority,
  lost_reason = EXCLUDED.lost_reason,
  converted_booking_id = EXCLUDED.converted_booking_id,
  remarks = EXCLUDED.remarks,
  created_by = EXCLUDED.created_by,
  updated_at = now();

INSERT INTO lead_follow_ups (
  id,
  lead_id,
  follow_up_date,
  next_follow_up,
  contact_mode,
  summary,
  quoted_amount,
  created_by
)
VALUES
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '2026-03-01T16:00:00+05:30', '2026-03-02T11:00:00+05:30', 'phone', 'Confirmed package options 8HR80KM and 4HR40KM.', 3540, (SELECT id FROM profiles WHERE email = 'manager.gt@travelerp.com')),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', '2026-03-02T18:00:00+05:30', '2026-03-05T10:00:00+05:30', 'meeting', 'Explained annexure-based billing for multi-day duty slip.', 8880, (SELECT id FROM profiles WHERE email = 'operator.gt@travelerp.com')),
  ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003', '2026-03-03T17:30:00+05:30', '2026-03-06T12:00:00+05:30', 'email', 'Sent threshold pricing note and expected long trip fallback amount.', 6600, (SELECT id FROM profiles WHERE email = 'manager.gt@travelerp.com'))
ON CONFLICT (id) DO UPDATE
SET
  lead_id = EXCLUDED.lead_id,
  follow_up_date = EXCLUDED.follow_up_date,
  next_follow_up = EXCLUDED.next_follow_up,
  contact_mode = EXCLUDED.contact_mode,
  summary = EXCLUDED.summary,
  quoted_amount = EXCLUDED.quoted_amount,
  created_by = EXCLUDED.created_by;

-- ---------------------------------------------------------------------------
-- Phase 2 rate charts
-- ---------------------------------------------------------------------------
INSERT INTO rate_charts (id, customer_id, name, effective_from, effective_to, is_active, notes, created_by)
VALUES
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'RBI FY26 Active Chart', '2026-01-01', NULL, true, 'Multiple package selection plus higher-of KM/HR.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'TSM FY26 Active Chart', '2026-01-01', NULL, true, 'Fuel formula and fixed drop route demo chart.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'UNIT-4 FY26 Active Chart', '2026-01-01', NULL, true, 'Fuel-only chart with category-specific divisors.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'NTPC FY26 Active Chart', '2026-01-01', NULL, true, 'Local package with long fallback threshold.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('70000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'IFFCO FY26 Active Chart', '2026-01-01', NULL, true, 'Local and outstation with no-km-cap warning fields.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('70000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'MCL Annexure Demo Chart', '2026-01-01', NULL, true, 'Clean per-km outstation chart for annexure billing demo.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com'))
ON CONFLICT (id) DO UPDATE
SET
  customer_id = EXCLUDED.customer_id,
  name = EXCLUDED.name,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes,
  created_by = EXCLUDED.created_by,
  updated_at = now();

INSERT INTO rate_chart_items (
  id,
  rate_chart_id,
  vehicle_category_id,
  duty_type,
  package_code,
  package_label,
  sort_order,
  is_default,
  base_hours,
  base_km,
  base_amount,
  extra_km_rate,
  extra_hr_rate,
  fuel_divisor,
  fuel_price_per_unit,
  night_halt_rate,
  fixed_amount,
  use_higher_of_km_hr,
  per_km_rate,
  ot_rate,
  long_km_threshold,
  no_km_limit_cap_km,
  long_day_hours,
  long_night_halt_hours,
  notes
)
VALUES
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'local', '8HR80KM', '8 HR / 80 KM', 10, true, 8, 80, 3000, 18, 180, NULL, NULL, NULL, NULL, true, NULL, NULL, NULL, NULL, NULL, NULL, 'RBI base local package'),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'local', '4HR40KM', '4 HR / 40 KM', 20, false, 4, 40, 2000, 18, 180, NULL, NULL, NULL, NULL, true, NULL, NULL, NULL, NULL, NULL, NULL, 'RBI short local package'),
  ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'local', '8HR80KM', '8 HR / 80 KM', 30, true, 8, 80, 2500, 15, 150, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, 'RBI DEZIRE backup package'),
  ('71000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'local', 'LOCAL', 'Fuel Formula Local', 10, true, NULL, NULL, 0, NULL, NULL, 10, 102.15, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, 'TSM local fuel formula'),
  ('71000000-0000-0000-0000-000000000020', '70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', 'local', 'LOCAL4', 'Local 4AIR BAG', 10, true, NULL, NULL, 0, NULL, NULL, 12, 102.15, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, 'UNIT-4 4AIR fuel formula'),
  ('71000000-0000-0000-0000-000000000021', '70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000004', 'local', 'LOCAL6', 'Local 6AIR BAG', 20, true, NULL, NULL, 0, NULL, NULL, 10, 102.15, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, 'UNIT-4 6AIR fuel formula'),
  ('71000000-0000-0000-0000-000000000030', '70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000001', 'local', '8HR80KM', '8 HR / 80 KM', 10, true, 8, 80, 2800, 16, 160, NULL, NULL, NULL, NULL, false, NULL, NULL, 250, NULL, NULL, NULL, 'NTPC threshold local package'),
  ('71000000-0000-0000-0000-000000000031', '70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000001', 'long', 'LONG', 'Long Distance', 20, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 22, NULL, NULL, NULL, NULL, NULL, 'NTPC long fallback package'),
  ('71000000-0000-0000-0000-000000000040', '70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000001', 'local', '10HR80KM', '10 HR / 80 KM', 10, true, 10, 80, 3200, 20, 200, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, 450, NULL, NULL, 'IFFCO local package with no-km-cap field'),
  ('71000000-0000-0000-0000-000000000041', '70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000001', 'outstation', 'OUTSTATION', 'Outstation', 20, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 500, NULL, false, 25, 200, NULL, 450, 10, NULL, 'IFFCO outstation per-km with night halt and OT'),
  ('71000000-0000-0000-0000-000000000050', '70000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000001', 'outstation', 'ANNEXURE24', 'Annexure Outstation 24/KM', 10, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, 24, NULL, NULL, NULL, NULL, NULL, 'MCL annexure billing chart')
ON CONFLICT (id) DO UPDATE
SET
  rate_chart_id = EXCLUDED.rate_chart_id,
  vehicle_category_id = EXCLUDED.vehicle_category_id,
  duty_type = EXCLUDED.duty_type,
  package_code = EXCLUDED.package_code,
  package_label = EXCLUDED.package_label,
  sort_order = EXCLUDED.sort_order,
  is_default = EXCLUDED.is_default,
  base_hours = EXCLUDED.base_hours,
  base_km = EXCLUDED.base_km,
  base_amount = EXCLUDED.base_amount,
  extra_km_rate = EXCLUDED.extra_km_rate,
  extra_hr_rate = EXCLUDED.extra_hr_rate,
  fuel_divisor = EXCLUDED.fuel_divisor,
  fuel_price_per_unit = EXCLUDED.fuel_price_per_unit,
  night_halt_rate = EXCLUDED.night_halt_rate,
  fixed_amount = EXCLUDED.fixed_amount,
  use_higher_of_km_hr = EXCLUDED.use_higher_of_km_hr,
  per_km_rate = EXCLUDED.per_km_rate,
  ot_rate = EXCLUDED.ot_rate,
  long_km_threshold = EXCLUDED.long_km_threshold,
  no_km_limit_cap_km = EXCLUDED.no_km_limit_cap_km,
  long_day_hours = EXCLUDED.long_day_hours,
  long_night_halt_hours = EXCLUDED.long_night_halt_hours,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO rate_chart_fixed_routes (
  id,
  rate_chart_id,
  vehicle_category_id,
  duty_type,
  from_location,
  to_location,
  from_location_key,
  to_location_key,
  fixed_amount,
  description
)
VALUES
  ('72000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'drop_pickup', 'TSM', 'BBSR', 'TSM', 'BBSR', 4000, 'TSM to BBSR fixed route charge')
ON CONFLICT (id) DO UPDATE
SET
  rate_chart_id = EXCLUDED.rate_chart_id,
  vehicle_category_id = EXCLUDED.vehicle_category_id,
  duty_type = EXCLUDED.duty_type,
  from_location = EXCLUDED.from_location,
  to_location = EXCLUDED.to_location,
  from_location_key = EXCLUDED.from_location_key,
  to_location_key = EXCLUDED.to_location_key,
  fixed_amount = EXCLUDED.fixed_amount,
  description = EXCLUDED.description,
  updated_at = now();
-- ---------------------------------------------------------------------------
-- Phase 3 and 4 trips, metrics, expenses, annexure scenarios
-- ---------------------------------------------------------------------------
INSERT INTO trips (
  id,
  trip_number,
  customer_id,
  route_id,
  vehicle_id,
  driver_id,
  trip_date,
  duty_type,
  booked_by,
  report_to,
  vehicle_category_id,
  rate_chart_id,
  rate_chart_item_id,
  rate_chart_fixed_route_id,
  start_time,
  end_time,
  start_km,
  end_km,
  actual_km,
  total_hours,
  night_halts,
  from_location,
  to_location,
  purpose,
  passengers,
  status,
  trip_amount,
  advance_hirer,
  advance_travels,
  fuel_advance,
  cash_advance,
  base_charge,
  extra_km_charge,
  extra_hr_charge,
  night_halt_charge,
  fuel_charge,
  fixed_route_charge,
  ot_charge,
  calculated_amount,
  is_long_trip,
  parent_trip_id,
  annexure_number,
  driver_allowance,
  toll_charges,
  parking_charges,
  other_charges,
  remarks,
  created_by
)
VALUES
  ('90000000-0000-0000-0000-000000000001', 'GT-TRP-1001', '20000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-03-05', 'local', 'Prakash Mishra', 'RBI Admin Desk', '60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', NULL, '2026-03-05T08:00:00+05:30', '2026-03-05T18:30:00+05:30', 10000, 10110, 110, 10, 0, 'RBI Bhubaneswar', 'RBI Bhubaneswar', 'Office movement', 4, 'completed', 3540, 1000, 500, 0, 0, 3000, 540, 0, 0, 0, 0, 0, 3540, false, NULL, NULL, 0, 120, 0, 0, 'Base higher-of package demo with direct billing.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('90000000-0000-0000-0000-000000000002', 'GT-TRP-1002', '20000000-0000-0000-0000-000000000002', '35000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-03-06', 'drop_pickup', 'Ritesh Parida', 'TSM Gate Office', '60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', NULL, '72000000-0000-0000-0000-000000000001', '2026-03-06T07:00:00+05:30', '2026-03-06T14:00:00+05:30', 20000, 20330, 330, 7, 0, 'TSM', 'BBSR', 'Fixed route drop', 3, 'completed', 4000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4000, 0, 4000, false, NULL, NULL, 0, 0, 0, 0, 'Fixed route match demo.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('90000000-0000-0000-0000-000000000003', 'GT-TRP-1003', '20000000-0000-0000-0000-000000000003', '35000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', '2026-03-07', 'local', 'Ananya Das', 'Unit-4 Control Room', '60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000020', NULL, '2026-03-07T09:00:00+05:30', '2026-03-07T17:00:00+05:30', 30000, 30120, 120, 8, 0, 'UNIT-4', 'UNIT-4', 'Fuel formula local run', 2, 'completed', 1021.50, 0, 0, 0, 0, 0, 0, 0, 0, 1021.50, 0, 0, 1021.50, false, NULL, NULL, 0, 0, 0, 0, 'Fuel divisor 12 demo for 4AIR BAG.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('90000000-0000-0000-0000-000000000004', 'GT-TRP-1004', '20000000-0000-0000-0000-000000000003', '35000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000004', '2026-03-16', 'local', 'Ananya Das', 'Unit-4 Control Room', '60000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000021', NULL, '2026-03-16T10:00:00+05:30', '2026-03-16T13:00:00+05:30', 41000, 41060, 60, 3, 0, 'UNIT-4', 'UNIT-4', 'In-progress duty slip', 2, 'in_progress', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NULL, false, NULL, NULL, 0, 0, 0, 0, 'Open metric row demo for Phase 3.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('90000000-0000-0000-0000-000000000005', 'GT-TRP-1005', '20000000-0000-0000-0000-000000000004', '35000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-03-09', 'local', 'Kunal Deshmukh', 'NTPC Dispatch Desk', '60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000031', NULL, '2026-03-09T06:00:00+05:30', '2026-03-09T18:00:00+05:30', 50000, 50300, 300, 12, 0, 'Mumbai Plant', 'Pune Site', 'Threshold upgrade trip', 3, 'completed', 6600, 0, 0, 0, 0, 6600, 0, 0, 0, 0, 0, 0, 6600, true, NULL, NULL, 0, 350, 150, 0, 'Local package crossed threshold and billed on long per-km basis.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('90000000-0000-0000-0000-000000000006', 'GT-TRP-1006', '20000000-0000-0000-0000-000000000005', '35000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-03-10', 'outstation', 'Subhash Sahoo', 'IFFCO Gate 2', '60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000041', NULL, '2026-03-10T07:00:00+05:30', '2026-03-12T10:30:00+05:30', 60000, 60400, 400, 8, 2, 'Paradeep Plant', 'Bhubaneswar Guest House', 'Outstation duty slip', 4, 'completed', 11000, 2000, 1000, 500, 0, 10000, 0, 0, 1000, 0, 0, 0, 11000, false, NULL, NULL, 500, 450, 250, 0, 'Night halt and outstation per-km demo with no-km-cap field present on chart.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('90000000-0000-0000-0000-000000000007', 'GT-TRP-2001', '20000000-0000-0000-0000-000000000006', '35000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-03-08', 'outstation', 'Deepak Bhoi', 'MCL Mobility Desk', '60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000050', NULL, '2026-03-08T06:00:00+05:30', '2026-03-10T11:00:00+05:30', 70000, 70370, 370, 10, 0, 'MCL HQ', 'Talcher Mine', 'Parent annexure trip already billed via child annexures', 5, 'completed', 8880, 0, 0, 0, 0, 8880, 0, 0, 0, 0, 0, 0, 8880, false, NULL, NULL, 0, 0, 0, 0, 'Parent trip for single and grouped annexure invoice demo.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('90000000-0000-0000-0000-000000000008', 'GT-TRP-2001-A01', '20000000-0000-0000-0000-000000000006', '35000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-03-08', 'outstation', 'Deepak Bhoi', 'MCL Mobility Desk', '60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000050', NULL, '2026-03-08T06:00:00+05:30', '2026-03-08T09:00:00+05:30', 70000, 70120, 120, 3, 0, 'MCL HQ', 'Talcher Mine - Day 1', 'Annexure child trip 1', 5, 'completed', 2880, 0, 0, 0, 0, 2880, 0, 0, 0, 0, 0, 0, 2880, false, '90000000-0000-0000-0000-000000000007', 'ANN-01', 0, 0, 0, 0, 'Single annexure invoice demo child trip.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('90000000-0000-0000-0000-000000000009', 'GT-TRP-2001-A02', '20000000-0000-0000-0000-000000000006', '35000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-03-09', 'outstation', 'Deepak Bhoi', 'MCL Mobility Desk', '60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000050', NULL, '2026-03-09T07:00:00+05:30', '2026-03-09T11:00:00+05:30', 70120, 70260, 140, 4, 0, 'Talcher Mine - Day 2', 'Talcher Mine - Day 2', 'Annexure child trip 2', 5, 'completed', 3360, 0, 0, 0, 0, 3360, 0, 0, 0, 0, 0, 0, 3360, false, '90000000-0000-0000-0000-000000000007', 'ANN-02', 0, 0, 0, 0, 'Grouped annexure invoice child trip 2.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('90000000-0000-0000-0000-000000000010', 'GT-TRP-2001-A03', '20000000-0000-0000-0000-000000000006', '35000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-03-10', 'outstation', 'Deepak Bhoi', 'MCL Mobility Desk', '60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000050', NULL, '2026-03-10T08:00:00+05:30', '2026-03-10T11:00:00+05:30', 70260, 70370, 110, 3, 0, 'Talcher Mine - Day 3', 'MCL HQ', 'Annexure child trip 3', 5, 'completed', 2640, 0, 0, 0, 0, 2640, 0, 0, 0, 0, 0, 0, 2640, false, '90000000-0000-0000-0000-000000000007', 'ANN-03', 0, 0, 0, 0, 'Grouped annexure invoice child trip 3.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('90000000-0000-0000-0000-000000000011', 'GT-TRP-2002', '20000000-0000-0000-0000-000000000006', '35000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-03-15', 'outstation', 'Deepak Bhoi', 'MCL Mobility Desk', '60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000050', NULL, '2026-03-15T06:30:00+05:30', '2026-03-16T10:30:00+05:30', 80000, 80260, 260, 7, 0, 'MCL HQ', 'Ib Valley Site', 'Ready-to-bill annexure creation demo', 4, 'completed', 6240, 0, 0, 0, 0, 6240, 0, 0, 0, 0, 0, 0, 6240, false, NULL, NULL, 0, 0, 0, 0, 'Use this parent trip live to create new annexures during the demo.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com'))
ON CONFLICT (trip_number) DO UPDATE
SET
  customer_id = EXCLUDED.customer_id,
  route_id = EXCLUDED.route_id,
  vehicle_id = EXCLUDED.vehicle_id,
  driver_id = EXCLUDED.driver_id,
  trip_date = EXCLUDED.trip_date,
  duty_type = EXCLUDED.duty_type,
  booked_by = EXCLUDED.booked_by,
  report_to = EXCLUDED.report_to,
  vehicle_category_id = EXCLUDED.vehicle_category_id,
  rate_chart_id = EXCLUDED.rate_chart_id,
  rate_chart_item_id = EXCLUDED.rate_chart_item_id,
  rate_chart_fixed_route_id = EXCLUDED.rate_chart_fixed_route_id,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  start_km = EXCLUDED.start_km,
  end_km = EXCLUDED.end_km,
  actual_km = EXCLUDED.actual_km,
  total_hours = EXCLUDED.total_hours,
  night_halts = EXCLUDED.night_halts,
  from_location = EXCLUDED.from_location,
  to_location = EXCLUDED.to_location,
  purpose = EXCLUDED.purpose,
  passengers = EXCLUDED.passengers,
  status = EXCLUDED.status,
  trip_amount = EXCLUDED.trip_amount,
  advance_hirer = EXCLUDED.advance_hirer,
  advance_travels = EXCLUDED.advance_travels,
  fuel_advance = EXCLUDED.fuel_advance,
  cash_advance = EXCLUDED.cash_advance,
  base_charge = EXCLUDED.base_charge,
  extra_km_charge = EXCLUDED.extra_km_charge,
  extra_hr_charge = EXCLUDED.extra_hr_charge,
  night_halt_charge = EXCLUDED.night_halt_charge,
  fuel_charge = EXCLUDED.fuel_charge,
  fixed_route_charge = EXCLUDED.fixed_route_charge,
  ot_charge = EXCLUDED.ot_charge,
  calculated_amount = EXCLUDED.calculated_amount,
  is_long_trip = EXCLUDED.is_long_trip,
  parent_trip_id = EXCLUDED.parent_trip_id,
  annexure_number = EXCLUDED.annexure_number,
  driver_allowance = EXCLUDED.driver_allowance,
  toll_charges = EXCLUDED.toll_charges,
  parking_charges = EXCLUDED.parking_charges,
  other_charges = EXCLUDED.other_charges,
  remarks = EXCLUDED.remarks,
  created_by = EXCLUDED.created_by,
  updated_at = now();
INSERT INTO trip_travel_metrics (
  id,
  trip_id,
  seq,
  start_date,
  start_time,
  start_km,
  end_date,
  end_time,
  end_km,
  source_metric_id
)
VALUES
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 1, '2026-03-05', '08:00', 10000, '2026-03-05', '13:00', 10050, NULL),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 2, '2026-03-05', '13:30', 10050, '2026-03-05', '18:30', 10110, NULL),
  ('91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 1, '2026-03-06', '07:00', 20000, '2026-03-06', '14:00', 20330, NULL),
  ('91000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', 1, '2026-03-07', '09:00', 30000, '2026-03-07', '17:00', 30120, NULL),
  ('91000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000004', 1, '2026-03-16', '10:00', 41000, '2026-03-16', '13:00', 41060, NULL),
  ('91000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000004', 2, '2026-03-16', '13:30', 41060, NULL, NULL, NULL, NULL),
  ('91000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000005', 1, '2026-03-09', '06:00', 50000, '2026-03-09', '18:00', 50300, NULL),
  ('91000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000006', 1, '2026-03-10', '07:00', 60000, '2026-03-10', '11:00', 60120, NULL),
  ('91000000-0000-0000-0000-000000000009', '90000000-0000-0000-0000-000000000006', 2, '2026-03-11', '08:00', 60120, '2026-03-11', '10:30', 60240, NULL),
  ('91000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000006', 3, '2026-03-12', '09:00', 60240, '2026-03-12', '10:30', 60400, NULL),
  ('91000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000007', 1, '2026-03-08', '06:00', 70000, '2026-03-08', '09:00', 70120, NULL),
  ('91000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000007', 2, '2026-03-09', '07:00', 70120, '2026-03-09', '11:00', 70260, NULL),
  ('91000000-0000-0000-0000-000000000013', '90000000-0000-0000-0000-000000000007', 3, '2026-03-10', '08:00', 70260, '2026-03-10', '11:00', 70370, NULL),
  ('91000000-0000-0000-0000-000000000014', '90000000-0000-0000-0000-000000000008', 1, '2026-03-08', '06:00', 70000, '2026-03-08', '09:00', 70120, '91000000-0000-0000-0000-000000000011'),
  ('91000000-0000-0000-0000-000000000015', '90000000-0000-0000-0000-000000000009', 1, '2026-03-09', '07:00', 70120, '2026-03-09', '11:00', 70260, '91000000-0000-0000-0000-000000000012'),
  ('91000000-0000-0000-0000-000000000016', '90000000-0000-0000-0000-000000000010', 1, '2026-03-10', '08:00', 70260, '2026-03-10', '11:00', 70370, '91000000-0000-0000-0000-000000000013'),
  ('91000000-0000-0000-0000-000000000017', '90000000-0000-0000-0000-000000000011', 1, '2026-03-15', '06:30', 80000, '2026-03-15', '09:30', 80100, NULL),
  ('91000000-0000-0000-0000-000000000018', '90000000-0000-0000-0000-000000000011', 2, '2026-03-16', '07:30', 80100, '2026-03-16', '10:30', 80260, NULL)
ON CONFLICT (id) DO UPDATE
SET
  trip_id = EXCLUDED.trip_id,
  seq = EXCLUDED.seq,
  start_date = EXCLUDED.start_date,
  start_time = EXCLUDED.start_time,
  start_km = EXCLUDED.start_km,
  end_date = EXCLUDED.end_date,
  end_time = EXCLUDED.end_time,
  end_km = EXCLUDED.end_km,
  source_metric_id = EXCLUDED.source_metric_id,
  updated_at = now();

INSERT INTO trip_expenses (id, trip_id, expense_type, amount, description, receipt_number, is_billable_to_hirer)
VALUES
  ('91500000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'fuel', 900, 'Local fuel reimbursement', 'FUEL-RBI-1001', false),
  ('91500000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'toll', 120, 'City toll and parking bundle', 'TOLL-RBI-1001', false),
  ('91500000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000006', 'parking', 250, 'Plant parking and entry fees', 'PARK-IFF-1006', false),
  ('91500000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000006', 'food', 300, 'Driver meal allowance during outstation duty', 'FOOD-IFF-1006', false)
ON CONFLICT (id) DO UPDATE
SET
  trip_id = EXCLUDED.trip_id,
  expense_type = EXCLUDED.expense_type,
  amount = EXCLUDED.amount,
  description = EXCLUDED.description,
  receipt_number = EXCLUDED.receipt_number,
  is_billable_to_hirer = EXCLUDED.is_billable_to_hirer;

-- ---------------------------------------------------------------------------
-- Phase 4 invoices and annexures
-- ---------------------------------------------------------------------------
INSERT INTO invoices (
  id,
  invoice_number,
  invoice_date,
  customer_id,
  billing_address,
  customer_gstin,
  booking_date,
  duty_type_label,
  nature_of_journey,
  vehicle_number,
  vehicle_type_label,
  duty_slip_number,
  total_km,
  total_hours,
  payment_terms_days,
  interest_note,
  subtotal,
  cgst_amount,
  sgst_amount,
  igst_amount,
  total_amount,
  payment_status,
  due_date,
  remarks,
  created_by
)
VALUES
  ('93000000-0000-0000-0000-000000000001', 'GTINV-00001', '2026-03-06', '20000000-0000-0000-0000-000000000001', 'RBI Campus, Sachivalaya Marg, Bhubaneswar, Odisha - 751001', '21AABCU9603R1ZP', '2026-03-05', 'Local', 'RBI office shuttle', 'OD02AB1234', 'CRYSTA', 'GT-TRP-1001', 110, 10, 30, 'Interest @ 18% p.a. applies after 30 day(s) from invoice date.', 3540, 88.50, 88.50, 0, 3717, 'partial', '2026-04-05', 'Direct trip invoice for RBI package scenario.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('93000000-0000-0000-0000-000000000002', 'GTINV-00002', '2026-03-10', '20000000-0000-0000-0000-000000000004', 'NTPC Office, Andheri East, Mumbai, Maharashtra - 400059', '27AADCS0472N1ZO', '2026-03-09', 'Long', 'Threshold-based long trip', 'OD02AB1234', 'CRYSTA', 'GT-TRP-1005', 300, 12, 45, 'Interest @ 18% p.a. applies after 45 day(s) from invoice date.', 6600, 0, 0, 330, 6930, 'completed', '2026-04-24', 'Direct trip invoice for long threshold scenario.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('93000000-0000-0000-0000-000000000003', 'GTINV-00003', '2026-03-11', '20000000-0000-0000-0000-000000000006', 'MCL Area Office, Sambalpur, Odisha - 768001', '21AACCM4400K1Z7', '2026-03-08', 'Outstation', 'Single annexure billing', 'OD02AB1234', 'CRYSTA', 'GT-TRP-2001', 120, 3, 21, 'Interest @ 18% p.a. applies after 21 day(s) from invoice date.', 2880, 72, 72, 0, 3024, 'completed', '2026-04-01', 'Single annexure invoice for ANN-01.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('93000000-0000-0000-0000-000000000004', 'GTINV-00004', '2026-03-12', '20000000-0000-0000-0000-000000000006', 'MCL Area Office, Sambalpur, Odisha - 768001', '21AACCM4400K1Z7', '2026-03-08', 'Outstation', 'Grouped annexure billing', 'OD02AB1234', 'CRYSTA', 'GT-TRP-2001', 250, 7, 21, 'Interest @ 18% p.a. applies after 21 day(s) from invoice date.', 6000, 150, 150, 0, 6300, 'pending', '2026-04-02', 'Grouped annexure invoice for ANN-02 and ANN-03.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')),
  ('93000000-0000-0000-0000-000000000005', 'GTINV-00005', '2026-03-05', '20000000-0000-0000-0000-000000000004', 'NTPC Office, Andheri East, Mumbai, Maharashtra - 400059', '27AADCS0472N1ZO', NULL, NULL, 'Manual Billing', NULL, NULL, NULL, NULL, NULL, 7, 'Interest @ 18% p.a. applies after 7 day(s) from invoice date.', 12500, 0, 0, 625, 13125, 'overdue', '2026-03-12', 'Legacy manual invoice kept for Phase 5 tax preview and manual billing demo.', (SELECT id FROM profiles WHERE email = 'admin@travelerp.com'))
ON CONFLICT (invoice_number) DO UPDATE
SET
  invoice_date = EXCLUDED.invoice_date,
  customer_id = EXCLUDED.customer_id,
  billing_address = EXCLUDED.billing_address,
  customer_gstin = EXCLUDED.customer_gstin,
  booking_date = EXCLUDED.booking_date,
  duty_type_label = EXCLUDED.duty_type_label,
  nature_of_journey = EXCLUDED.nature_of_journey,
  vehicle_number = EXCLUDED.vehicle_number,
  vehicle_type_label = EXCLUDED.vehicle_type_label,
  duty_slip_number = EXCLUDED.duty_slip_number,
  total_km = EXCLUDED.total_km,
  total_hours = EXCLUDED.total_hours,
  payment_terms_days = EXCLUDED.payment_terms_days,
  interest_note = EXCLUDED.interest_note,
  subtotal = EXCLUDED.subtotal,
  cgst_amount = EXCLUDED.cgst_amount,
  sgst_amount = EXCLUDED.sgst_amount,
  igst_amount = EXCLUDED.igst_amount,
  total_amount = EXCLUDED.total_amount,
  payment_status = EXCLUDED.payment_status,
  due_date = EXCLUDED.due_date,
  remarks = EXCLUDED.remarks,
  created_by = EXCLUDED.created_by,
  updated_at = now();

INSERT INTO annexures (
  id,
  annexure_number,
  parent_trip_id,
  trip_id,
  start_date,
  end_date,
  start_km,
  end_km,
  total_km,
  total_hours,
  night_halts,
  calculated_amount,
  is_billed,
  invoice_id
)
VALUES
  ('92000000-0000-0000-0000-000000000001', 'ANN-01', '90000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000008', '2026-03-08', '2026-03-08', 70000, 70120, 120, 3, 0, 2880, true, '93000000-0000-0000-0000-000000000003'),
  ('92000000-0000-0000-0000-000000000002', 'ANN-02', '90000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000009', '2026-03-09', '2026-03-09', 70120, 70260, 140, 4, 0, 3360, true, '93000000-0000-0000-0000-000000000004'),
  ('92000000-0000-0000-0000-000000000003', 'ANN-03', '90000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000010', '2026-03-10', '2026-03-10', 70260, 70370, 110, 3, 0, 2640, true, '93000000-0000-0000-0000-000000000004')
ON CONFLICT (id) DO UPDATE
SET
  annexure_number = EXCLUDED.annexure_number,
  parent_trip_id = EXCLUDED.parent_trip_id,
  trip_id = EXCLUDED.trip_id,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  start_km = EXCLUDED.start_km,
  end_km = EXCLUDED.end_km,
  total_km = EXCLUDED.total_km,
  total_hours = EXCLUDED.total_hours,
  night_halts = EXCLUDED.night_halts,
  calculated_amount = EXCLUDED.calculated_amount,
  is_billed = EXCLUDED.is_billed,
  invoice_id = EXCLUDED.invoice_id,
  updated_at = now();

INSERT INTO invoice_items (
  id,
  invoice_id,
  trip_id,
  annexure_id,
  description,
  hsn_code,
  quantity,
  rate,
  amount,
  cgst_rate,
  sgst_rate,
  igst_rate,
  cgst_amount,
  sgst_amount,
  igst_amount,
  total_amount
)
VALUES
  ('94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', NULL, 'RBI Local Duty - 8 HR / 80 KM', '9964', 1, 3540, 3540, 2.5, 2.5, 0, 88.50, 88.50, 0, 3717),
  ('94000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000005', NULL, 'NTPC Local To Long Threshold Billing', '9964', 1, 6600, 6600, 0, 0, 5, 0, 0, 330, 6930),
  ('94000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000008', '92000000-0000-0000-0000-000000000001', 'Annexure ANN-01 - 08 Mar 2026', '9964', 1, 2880, 2880, 2.5, 2.5, 0, 72, 72, 0, 3024),
  ('94000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000009', '92000000-0000-0000-0000-000000000002', 'Annexure ANN-02 - 09 Mar 2026', '9964', 1, 3360, 3360, 2.5, 2.5, 0, 84, 84, 0, 3528),
  ('94000000-0000-0000-0000-000000000005', '93000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000010', '92000000-0000-0000-0000-000000000003', 'Annexure ANN-03 - 10 Mar 2026', '9964', 1, 2640, 2640, 2.5, 2.5, 0, 66, 66, 0, 2772),
  ('94000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000005', NULL, NULL, 'Quarterly transport retainership', '9964', 1, 12500, 12500, 0, 0, 5, 0, 0, 625, 13125)
ON CONFLICT (id) DO UPDATE
SET
  invoice_id = EXCLUDED.invoice_id,
  trip_id = EXCLUDED.trip_id,
  annexure_id = EXCLUDED.annexure_id,
  description = EXCLUDED.description,
  hsn_code = EXCLUDED.hsn_code,
  quantity = EXCLUDED.quantity,
  rate = EXCLUDED.rate,
  amount = EXCLUDED.amount,
  cgst_rate = EXCLUDED.cgst_rate,
  sgst_rate = EXCLUDED.sgst_rate,
  igst_rate = EXCLUDED.igst_rate,
  cgst_amount = EXCLUDED.cgst_amount,
  sgst_amount = EXCLUDED.sgst_amount,
  igst_amount = EXCLUDED.igst_amount,
  total_amount = EXCLUDED.total_amount;
INSERT INTO invoice_tax_components (
  id,
  invoice_id,
  tax_component_id,
  component_code,
  component_name,
  applies_to,
  hsn_code,
  taxable_base,
  rate,
  is_percentage,
  flat_amount,
  tax_amount,
  sort_order
)
VALUES
  ('95000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', (SELECT id FROM tax_components WHERE component_code = 'CGST'), 'CGST', 'CGST', 'intra_state', '9964', 3540, 2.5, true, NULL, 88.50, 10),
  ('95000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000001', (SELECT id FROM tax_components WHERE component_code = 'SGST'), 'SGST', 'SGST', 'intra_state', '9964', 3540, 2.5, true, NULL, 88.50, 20),
  ('95000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000002', (SELECT id FROM tax_components WHERE component_code = 'IGST'), 'IGST', 'IGST', 'inter_state', '9964', 6600, 5.0, true, NULL, 330, 10),
  ('95000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000003', (SELECT id FROM tax_components WHERE component_code = 'CGST'), 'CGST', 'CGST', 'intra_state', '9964', 2880, 2.5, true, NULL, 72, 10),
  ('95000000-0000-0000-0000-000000000005', '93000000-0000-0000-0000-000000000003', (SELECT id FROM tax_components WHERE component_code = 'SGST'), 'SGST', 'SGST', 'intra_state', '9964', 2880, 2.5, true, NULL, 72, 20),
  ('95000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000004', (SELECT id FROM tax_components WHERE component_code = 'CGST'), 'CGST', 'CGST', 'intra_state', '9964', 6000, 2.5, true, NULL, 150, 10),
  ('95000000-0000-0000-0000-000000000007', '93000000-0000-0000-0000-000000000004', (SELECT id FROM tax_components WHERE component_code = 'SGST'), 'SGST', 'SGST', 'intra_state', '9964', 6000, 2.5, true, NULL, 150, 20),
  ('95000000-0000-0000-0000-000000000008', '93000000-0000-0000-0000-000000000005', (SELECT id FROM tax_components WHERE component_code = 'IGST'), 'IGST', 'IGST', 'inter_state', '9964', 12500, 5.0, true, NULL, 625, 10)
ON CONFLICT (id) DO UPDATE
SET
  invoice_id = EXCLUDED.invoice_id,
  tax_component_id = EXCLUDED.tax_component_id,
  component_code = EXCLUDED.component_code,
  component_name = EXCLUDED.component_name,
  applies_to = EXCLUDED.applies_to,
  hsn_code = EXCLUDED.hsn_code,
  taxable_base = EXCLUDED.taxable_base,
  rate = EXCLUDED.rate,
  is_percentage = EXCLUDED.is_percentage,
  flat_amount = EXCLUDED.flat_amount,
  tax_amount = EXCLUDED.tax_amount,
  sort_order = EXCLUDED.sort_order;

INSERT INTO invoice_item_tax_components (
  id,
  invoice_item_id,
  invoice_id,
  tax_component_id,
  component_code,
  component_name,
  applies_to,
  hsn_code,
  taxable_base,
  rate,
  is_percentage,
  flat_amount,
  tax_amount,
  sort_order
)
VALUES
  ('96000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', (SELECT id FROM tax_components WHERE component_code = 'CGST'), 'CGST', 'CGST', 'intra_state', '9964', 3540, 2.5, true, NULL, 88.50, 10),
  ('96000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', (SELECT id FROM tax_components WHERE component_code = 'SGST'), 'SGST', 'SGST', 'intra_state', '9964', 3540, 2.5, true, NULL, 88.50, 20),
  ('96000000-0000-0000-0000-000000000003', '94000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', (SELECT id FROM tax_components WHERE component_code = 'IGST'), 'IGST', 'IGST', 'inter_state', '9964', 6600, 5.0, true, NULL, 330, 10),
  ('96000000-0000-0000-0000-000000000004', '94000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000003', (SELECT id FROM tax_components WHERE component_code = 'CGST'), 'CGST', 'CGST', 'intra_state', '9964', 2880, 2.5, true, NULL, 72, 10),
  ('96000000-0000-0000-0000-000000000005', '94000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000003', (SELECT id FROM tax_components WHERE component_code = 'SGST'), 'SGST', 'SGST', 'intra_state', '9964', 2880, 2.5, true, NULL, 72, 20),
  ('96000000-0000-0000-0000-000000000006', '94000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000004', (SELECT id FROM tax_components WHERE component_code = 'CGST'), 'CGST', 'CGST', 'intra_state', '9964', 3360, 2.5, true, NULL, 84, 10),
  ('96000000-0000-0000-0000-000000000007', '94000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000004', (SELECT id FROM tax_components WHERE component_code = 'SGST'), 'SGST', 'SGST', 'intra_state', '9964', 3360, 2.5, true, NULL, 84, 20),
  ('96000000-0000-0000-0000-000000000008', '94000000-0000-0000-0000-000000000005', '93000000-0000-0000-0000-000000000004', (SELECT id FROM tax_components WHERE component_code = 'CGST'), 'CGST', 'CGST', 'intra_state', '9964', 2640, 2.5, true, NULL, 66, 10),
  ('96000000-0000-0000-0000-000000000009', '94000000-0000-0000-0000-000000000005', '93000000-0000-0000-0000-000000000004', (SELECT id FROM tax_components WHERE component_code = 'SGST'), 'SGST', 'SGST', 'intra_state', '9964', 2640, 2.5, true, NULL, 66, 20),
  ('96000000-0000-0000-0000-000000000010', '94000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000005', (SELECT id FROM tax_components WHERE component_code = 'IGST'), 'IGST', 'IGST', 'inter_state', '9964', 12500, 5.0, true, NULL, 625, 10)
ON CONFLICT (id) DO UPDATE
SET
  invoice_item_id = EXCLUDED.invoice_item_id,
  invoice_id = EXCLUDED.invoice_id,
  tax_component_id = EXCLUDED.tax_component_id,
  component_code = EXCLUDED.component_code,
  component_name = EXCLUDED.component_name,
  applies_to = EXCLUDED.applies_to,
  hsn_code = EXCLUDED.hsn_code,
  taxable_base = EXCLUDED.taxable_base,
  rate = EXCLUDED.rate,
  is_percentage = EXCLUDED.is_percentage,
  flat_amount = EXCLUDED.flat_amount,
  tax_amount = EXCLUDED.tax_amount,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Collections and settlements
-- ---------------------------------------------------------------------------
INSERT INTO collections (
  id,
  collection_number,
  collection_date,
  invoice_id,
  amount,
  payment_mode,
  reference_number,
  bank_name,
  remarks,
  created_by
)
VALUES
  ('97000000-0000-0000-0000-000000000001', 'GTCOL-0001', '2026-03-12', '93000000-0000-0000-0000-000000000001', 2000, 'bank_transfer', 'UTR-RBI-2000', 'HDFC Bank', 'Part payment against RBI direct trip invoice.', (SELECT id FROM profiles WHERE email = 'accountant.gt@travelerp.com')),
  ('97000000-0000-0000-0000-000000000002', 'GTCOL-0002', '2026-03-13', '93000000-0000-0000-0000-000000000002', 6930, 'upi', 'UPI-NTPC-6930', 'PhonePe', 'Full receipt against NTPC direct trip invoice.', (SELECT id FROM profiles WHERE email = 'accountant.gt@travelerp.com')),
  ('97000000-0000-0000-0000-000000000003', 'GTCOL-0003', '2026-03-14', '93000000-0000-0000-0000-000000000003', 3024, 'bank_transfer', 'UTR-MCL-3024', 'ICICI Bank', 'Single annexure invoice settled in full.', (SELECT id FROM profiles WHERE email = 'accountant.gt@travelerp.com'))
ON CONFLICT (collection_number) DO UPDATE
SET
  collection_date = EXCLUDED.collection_date,
  invoice_id = EXCLUDED.invoice_id,
  amount = EXCLUDED.amount,
  payment_mode = EXCLUDED.payment_mode,
  reference_number = EXCLUDED.reference_number,
  bank_name = EXCLUDED.bank_name,
  remarks = EXCLUDED.remarks,
  created_by = EXCLUDED.created_by;

INSERT INTO driver_settlements (
  id,
  settlement_number,
  driver_id,
  period_from,
  period_to,
  total_trips,
  total_km,
  total_allowance,
  advances,
  deductions,
  net_amount,
  payment_mode,
  payment_date,
  reference_number,
  status,
  remarks,
  created_by
)
VALUES
  ('98000000-0000-0000-0000-000000000001', 'GTDST-0001', '50000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-15', 5, 1510, 7200, 1000, 450, 5750, 'upi', '2026-03-16', 'UPI-DRV-5750', 'paid', 'Driver settlement covering RBI, TSM, NTPC, IFFCO and MCL demo trips.', (SELECT id FROM profiles WHERE email = 'accountant.gt@travelerp.com'))
ON CONFLICT (settlement_number) DO UPDATE
SET
  driver_id = EXCLUDED.driver_id,
  period_from = EXCLUDED.period_from,
  period_to = EXCLUDED.period_to,
  total_trips = EXCLUDED.total_trips,
  total_km = EXCLUDED.total_km,
  total_allowance = EXCLUDED.total_allowance,
  advances = EXCLUDED.advances,
  deductions = EXCLUDED.deductions,
  net_amount = EXCLUDED.net_amount,
  payment_mode = EXCLUDED.payment_mode,
  payment_date = EXCLUDED.payment_date,
  reference_number = EXCLUDED.reference_number,
  status = EXCLUDED.status,
  remarks = EXCLUDED.remarks,
  created_by = EXCLUDED.created_by,
  updated_at = now();

INSERT INTO owner_settlements (
  id,
  settlement_number,
  owner_id,
  vehicle_id,
  period_from,
  period_to,
  total_trips,
  total_km,
  total_amount,
  tds_amount,
  other_deductions,
  net_amount,
  payment_mode,
  payment_date,
  reference_number,
  status,
  remarks,
  created_by
)
VALUES
  ('98100000-0000-0000-0000-000000000001', 'GTOST-0001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '2026-03-01', '2026-03-15', 6, 1920, 42000, 4200, 800, 37000, 'bank_transfer', '2026-03-17', 'UTR-OWN-37000', 'approved', 'Owner settlement against billed and unbilled GT demo trips.', (SELECT id FROM profiles WHERE email = 'accountant.gt@travelerp.com'))
ON CONFLICT (settlement_number) DO UPDATE
SET
  owner_id = EXCLUDED.owner_id,
  vehicle_id = EXCLUDED.vehicle_id,
  period_from = EXCLUDED.period_from,
  period_to = EXCLUDED.period_to,
  total_trips = EXCLUDED.total_trips,
  total_km = EXCLUDED.total_km,
  total_amount = EXCLUDED.total_amount,
  tds_amount = EXCLUDED.tds_amount,
  other_deductions = EXCLUDED.other_deductions,
  net_amount = EXCLUDED.net_amount,
  payment_mode = EXCLUDED.payment_mode,
  payment_date = EXCLUDED.payment_date,
  reference_number = EXCLUDED.reference_number,
  status = EXCLUDED.status,
  remarks = EXCLUDED.remarks,
  created_by = EXCLUDED.created_by,
  updated_at = now();

COMMIT;
