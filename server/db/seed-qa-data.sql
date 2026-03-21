-- =============================================================================
-- Demo Seed Data for TravelERP (Gayatri Travels)
-- Purpose: Minimal, realistic data covering every feature for demos
-- Usage:  psql -U <user> -d <db> -f server/db/seed-qa-data.sql
-- Branch: GT-Dev
-- WARNING: Run ONLY on dev/test database. NOT for production.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. USER ACCOUNTS
-- ---------------------------------------------------------------------------
INSERT INTO profiles (email, full_name, role, password_hash, is_active) VALUES
  ('admin@intelligrip.com', 'Admin', 'admin',
   crypt('Admin@123456', gen_salt('bf')), true),
  ('fleet@intelligrip.com', 'Fleet Manager', 'manager',
   crypt('Fleet@123456', gen_salt('bf')), true)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. OWNERS (2)
-- ---------------------------------------------------------------------------
INSERT INTO owners_vendors (code, name, contact_person, phone, email, city, state, gstin, is_active) VALUES
  ('GT-OWN-0001', 'Gayatri Travels (Self)', 'Amlan Mohanty', '9876500001', 'info@gayatritravels.in', 'Bhubaneswar', 'Odisha', '21AABCG1234R1ZP', true),
  ('GT-OWN-0002', 'Raj Auto Rentals', 'Rajendra Pradhan', '9876500002', 'raj@autorentals.in', 'Cuttack', 'Odisha', '21AABCR5678S1ZQ', true)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. CUSTOMERS (3)
-- ---------------------------------------------------------------------------
INSERT INTO customers (customer_code, name, contact_person, phone, email, city, state, gstin, credit_limit, credit_days, is_active) VALUES
  ('GT-CUST-0001', 'Tata Steel Ltd', 'Vikram Sharma', '9876501001', 'vikram@tatasteel.com', 'Bhubaneswar', 'Odisha', '21AABCT1234Q1ZP', 500000, 30, true),
  ('GT-CUST-0002', 'JSPL Corporate', 'Anita Das', '9876501002', 'anita@jspl.com', 'Angul', 'Odisha', '21AABCJ5678R1ZQ', 300000, 15, true),
  ('GT-CUST-0003', 'Vedanta Mining', 'Sunil Patel', '9876501003', 'sunil@vedanta.com', 'Jharsuguda', 'Odisha', '21AABCV9012S1ZR', 200000, 15, true)
ON CONFLICT (customer_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. VEHICLE CATEGORIES (4)
-- ---------------------------------------------------------------------------
INSERT INTO vehicle_categories (name, description, is_active) VALUES
  ('CRYSTA', 'Toyota Innova Crysta - Premium SUV', true),
  ('DZIRE', 'Maruti Suzuki Dzire - Compact Sedan', true),
  ('ERTIGA', 'Maruti Suzuki Ertiga - MPV', true),
  ('TRAVELLER 17', 'Force Traveller 17-seater Mini Bus', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. VEHICLES (4) with owner FK lookups
-- ---------------------------------------------------------------------------
INSERT INTO vehicles (vehicle_number, vehicle_type, make, model, year, seating_capacity, owner_id, is_owned, is_active) VALUES
  ('OD02AB1234', 'car', 'Toyota', 'Innova Crysta', 2023, 7,
   (SELECT id FROM owners_vendors WHERE code = 'GT-OWN-0001'), true, true),
  ('OD02CD5678', 'car', 'Maruti Suzuki', 'Dzire', 2023, 5,
   (SELECT id FROM owners_vendors WHERE code = 'GT-OWN-0001'), true, true),
  ('OD02EF9012', 'car', 'Maruti Suzuki', 'Ertiga', 2022, 7,
   (SELECT id FROM owners_vendors WHERE code = 'GT-OWN-0002'), false, true),
  ('OD02GH3456', 'mini_bus', 'Force', 'Traveller 17', 2022, 17,
   (SELECT id FROM owners_vendors WHERE code = 'GT-OWN-0002'), false, true)
ON CONFLICT (vehicle_number) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. VEHICLE CATEGORY MAPPINGS (4)
-- ---------------------------------------------------------------------------
INSERT INTO vehicle_category_mappings (vehicle_id, vehicle_category_id)
SELECT v.id, vc.id FROM vehicles v, vehicle_categories vc
WHERE v.vehicle_number = 'OD02AB1234' AND vc.name = 'CRYSTA'
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO vehicle_category_mappings (vehicle_id, vehicle_category_id)
SELECT v.id, vc.id FROM vehicles v, vehicle_categories vc
WHERE v.vehicle_number = 'OD02CD5678' AND vc.name = 'DZIRE'
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO vehicle_category_mappings (vehicle_id, vehicle_category_id)
SELECT v.id, vc.id FROM vehicles v, vehicle_categories vc
WHERE v.vehicle_number = 'OD02EF9012' AND vc.name = 'ERTIGA'
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO vehicle_category_mappings (vehicle_id, vehicle_category_id)
SELECT v.id, vc.id FROM vehicles v, vehicle_categories vc
WHERE v.vehicle_number = 'OD02GH3456' AND vc.name = 'TRAVELLER 17'
ON CONFLICT (vehicle_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. DRIVERS (4) with default_vehicle FK lookups
-- ---------------------------------------------------------------------------
INSERT INTO drivers (driver_code, name, phone, license_number, license_expiry, city, state, is_active) VALUES
  ('GT-DRV-0001', 'Ramesh Sahoo', '9876502001', 'OD0120230001', '2028-12-31', 'Bhubaneswar', 'Odisha', true),
  ('GT-DRV-0002', 'Suresh Mohanty', '9876502002', 'OD0120230002', '2028-12-31', 'Bhubaneswar', 'Odisha', true),
  ('GT-DRV-0003', 'Bikash Jena', '9876502003', 'OD0120230003', '2028-12-31', 'Cuttack', 'Odisha', true),
  ('GT-DRV-0004', 'Prakash Nayak', '9876502004', 'OD0120230004', '2028-12-31', 'Cuttack', 'Odisha', true)
ON CONFLICT (driver_code) DO NOTHING;

-- Set default vehicles for drivers
UPDATE drivers SET default_vehicle_id = (SELECT id FROM vehicles WHERE vehicle_number = 'OD02AB1234')
WHERE driver_code = 'GT-DRV-0001' AND default_vehicle_id IS NULL;

UPDATE drivers SET default_vehicle_id = (SELECT id FROM vehicles WHERE vehicle_number = 'OD02CD5678')
WHERE driver_code = 'GT-DRV-0002' AND default_vehicle_id IS NULL;

UPDATE drivers SET default_vehicle_id = (SELECT id FROM vehicles WHERE vehicle_number = 'OD02EF9012')
WHERE driver_code = 'GT-DRV-0003' AND default_vehicle_id IS NULL;

UPDATE drivers SET default_vehicle_id = (SELECT id FROM vehicles WHERE vehicle_number = 'OD02GH3456')
WHERE driver_code = 'GT-DRV-0004' AND default_vehicle_id IS NULL;

-- ---------------------------------------------------------------------------
-- 7. RATE CHARTS
-- ---------------------------------------------------------------------------

-- Rate Chart 1: Tata Steel - Standard Rates
INSERT INTO rate_charts (customer_id, name, effective_from, is_active)
SELECT c.id, 'Tata Steel - Standard Rates', '2025-01-01', true
FROM customers c WHERE c.customer_code = 'GT-CUST-0001'
AND NOT EXISTS (SELECT 1 FROM rate_charts rc WHERE rc.name = 'Tata Steel - Standard Rates');

-- Rate Chart 1 Items
-- Item 1: CRYSTA / local / 8HR-80KM (Pattern 1,2,5: base package + extra KM/HR + night halt)
INSERT INTO rate_chart_items (rate_chart_id, vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
  base_hours, base_km, base_amount, extra_km_rate, extra_hr_rate, night_halt_rate, use_higher_of_km_hr)
SELECT rc.id, vc.id, 'local', '8HR-80KM', '8 Hours / 80 KM', 1, true,
  8, 80, 3000, 18, 180, 500, false
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'Tata Steel - Standard Rates' AND vc.name = 'CRYSTA'
AND NOT EXISTS (SELECT 1 FROM rate_chart_items ri WHERE ri.rate_chart_id = rc.id AND ri.package_code = '8HR-80KM' AND ri.vehicle_category_id = vc.id AND ri.duty_type = 'local');

-- Item 2: CRYSTA / local / 4HR-40KM (Pattern 8: multiple tiers)
INSERT INTO rate_chart_items (rate_chart_id, vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
  base_hours, base_km, base_amount, extra_km_rate, extra_hr_rate, night_halt_rate, use_higher_of_km_hr)
SELECT rc.id, vc.id, 'local', '4HR-40KM', '4 Hours / 40 KM', 2, false,
  4, 40, 1800, 18, 180, 500, false
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'Tata Steel - Standard Rates' AND vc.name = 'CRYSTA'
AND NOT EXISTS (SELECT 1 FROM rate_chart_items ri WHERE ri.rate_chart_id = rc.id AND ri.package_code = '4HR-40KM' AND ri.vehicle_category_id = vc.id);

-- Item 3: CRYSTA / outstation / OS-KM (Pattern 7: long trip per-KM + OT rate)
INSERT INTO rate_chart_items (rate_chart_id, vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
  per_km_rate, night_halt_rate, long_day_hours, ot_rate)
SELECT rc.id, vc.id, 'outstation', 'OS-KM', 'Outstation Per KM', 3, true,
  14, 500, 12, 150
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'Tata Steel - Standard Rates' AND vc.name = 'CRYSTA'
AND NOT EXISTS (SELECT 1 FROM rate_chart_items ri WHERE ri.rate_chart_id = rc.id AND ri.package_code = 'OS-KM' AND ri.vehicle_category_id = vc.id);

-- Item 4: DZIRE / local / 8HR-80KM (Pattern 6: whichever is higher)
INSERT INTO rate_chart_items (rate_chart_id, vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
  base_hours, base_km, base_amount, extra_km_rate, extra_hr_rate, night_halt_rate, use_higher_of_km_hr)
SELECT rc.id, vc.id, 'local', '8HR-80KM', '8 Hours / 80 KM', 4, true,
  8, 80, 2200, 14, 140, 400, true
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'Tata Steel - Standard Rates' AND vc.name = 'DZIRE'
AND NOT EXISTS (SELECT 1 FROM rate_chart_items ri WHERE ri.rate_chart_id = rc.id AND ri.package_code = '8HR-80KM' AND ri.vehicle_category_id = vc.id AND ri.duty_type = 'local');

-- Item 5: DZIRE / local / FUEL-KM (Pattern 3: fuel formula)
INSERT INTO rate_chart_items (rate_chart_id, vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
  base_amount, fuel_divisor, fuel_price_per_unit)
SELECT rc.id, vc.id, 'local', 'FUEL-KM', 'Fuel Formula', 5, false,
  1500, 6, 100
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'Tata Steel - Standard Rates' AND vc.name = 'DZIRE'
AND NOT EXISTS (SELECT 1 FROM rate_chart_items ri WHERE ri.rate_chart_id = rc.id AND ri.package_code = 'FUEL-KM' AND ri.vehicle_category_id = vc.id);

-- Item 6: CRYSTA / local / LONG-LOCAL (Pattern 9: KM threshold - local becomes long)
INSERT INTO rate_chart_items (rate_chart_id, vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
  per_km_rate, long_km_threshold, long_day_hours, ot_rate)
SELECT rc.id, vc.id, 'local', 'LONG-LOCAL', 'Long Local (200+ KM)', 6, false,
  16, 200, 10, 180
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'Tata Steel - Standard Rates' AND vc.name = 'CRYSTA'
AND NOT EXISTS (SELECT 1 FROM rate_chart_items ri WHERE ri.rate_chart_id = rc.id AND ri.package_code = 'LONG-LOCAL' AND ri.vehicle_category_id = vc.id);


-- Rate Chart 2: JSPL Corporate - Standard Rates
INSERT INTO rate_charts (customer_id, name, effective_from, is_active)
SELECT c.id, 'JSPL Corporate - Standard Rates', '2025-01-01', true
FROM customers c WHERE c.customer_code = 'GT-CUST-0002'
AND NOT EXISTS (SELECT 1 FROM rate_charts rc WHERE rc.name = 'JSPL Corporate - Standard Rates');

-- Item 1: ERTIGA / local / 8HR-80KM
INSERT INTO rate_chart_items (rate_chart_id, vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
  base_hours, base_km, base_amount, extra_km_rate, extra_hr_rate, night_halt_rate)
SELECT rc.id, vc.id, 'local', '8HR-80KM', '8 Hours / 80 KM', 1, true,
  8, 80, 2500, 16, 160, 400
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'JSPL Corporate - Standard Rates' AND vc.name = 'ERTIGA'
AND NOT EXISTS (SELECT 1 FROM rate_chart_items ri WHERE ri.rate_chart_id = rc.id AND ri.package_code = '8HR-80KM' AND ri.vehicle_category_id = vc.id);

-- Item 2: TRAVELLER 17 / outstation / OS-KM
INSERT INTO rate_chart_items (rate_chart_id, vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
  per_km_rate, night_halt_rate, long_day_hours, ot_rate)
SELECT rc.id, vc.id, 'outstation', 'OS-KM', 'Outstation Per KM', 2, true,
  22, 800, 12, 200
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'JSPL Corporate - Standard Rates' AND vc.name = 'TRAVELLER 17'
AND NOT EXISTS (SELECT 1 FROM rate_chart_items ri WHERE ri.rate_chart_id = rc.id AND ri.package_code = 'OS-KM' AND ri.vehicle_category_id = vc.id);

-- Item 3: ERTIGA / outstation / OS-KM
INSERT INTO rate_chart_items (rate_chart_id, vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
  per_km_rate, night_halt_rate, long_day_hours, ot_rate)
SELECT rc.id, vc.id, 'outstation', 'OS-KM', 'Outstation Per KM', 3, true,
  12, 400, 12, 120
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'JSPL Corporate - Standard Rates' AND vc.name = 'ERTIGA'
AND NOT EXISTS (SELECT 1 FROM rate_chart_items ri WHERE ri.rate_chart_id = rc.id AND ri.package_code = 'OS-KM' AND ri.vehicle_category_id = vc.id AND ri.duty_type = 'outstation');


-- Rate Chart 3: Vedanta Mining - Fixed Routes
INSERT INTO rate_charts (customer_id, name, effective_from, is_active)
SELECT c.id, 'Vedanta Mining - Fixed Routes', '2025-01-01', true
FROM customers c WHERE c.customer_code = 'GT-CUST-0003'
AND NOT EXISTS (SELECT 1 FROM rate_charts rc WHERE rc.name = 'Vedanta Mining - Fixed Routes');

-- Item 1: CRYSTA / drop_pickup / DROP-BASE (base for drop duty)
INSERT INTO rate_chart_items (rate_chart_id, vehicle_category_id, duty_type, package_code, package_label, sort_order, is_default,
  fixed_amount)
SELECT rc.id, vc.id, 'drop_pickup', 'DROP-BASE', 'Drop/Pickup Base', 1, true,
  1500
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'Vedanta Mining - Fixed Routes' AND vc.name = 'CRYSTA'
AND NOT EXISTS (SELECT 1 FROM rate_chart_items ri WHERE ri.rate_chart_id = rc.id AND ri.package_code = 'DROP-BASE' AND ri.vehicle_category_id = vc.id);

-- Fixed Routes (Pattern 4)
-- Route 1: CRYSTA / Jharsuguda to Bhubaneswar = Rs.6000
INSERT INTO rate_chart_fixed_routes (rate_chart_id, vehicle_category_id, duty_type, from_location, to_location, from_location_key, to_location_key, fixed_amount, description)
SELECT rc.id, vc.id, 'drop_pickup', 'Jharsuguda', 'Bhubaneswar', 'jharsuguda', 'bhubaneswar', 6000, 'Jharsuguda to Bhubaneswar drop'
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'Vedanta Mining - Fixed Routes' AND vc.name = 'CRYSTA'
AND NOT EXISTS (SELECT 1 FROM rate_chart_fixed_routes rf WHERE rf.rate_chart_id = rc.id AND rf.from_location_key = 'jharsuguda' AND rf.to_location_key = 'bhubaneswar' AND rf.vehicle_category_id = vc.id);

-- Route 2: CRYSTA / Jharsuguda to Raipur = Rs.5000
INSERT INTO rate_chart_fixed_routes (rate_chart_id, vehicle_category_id, duty_type, from_location, to_location, from_location_key, to_location_key, fixed_amount, description)
SELECT rc.id, vc.id, 'drop_pickup', 'Jharsuguda', 'Raipur', 'jharsuguda', 'raipur', 5000, 'Jharsuguda to Raipur drop'
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'Vedanta Mining - Fixed Routes' AND vc.name = 'CRYSTA'
AND NOT EXISTS (SELECT 1 FROM rate_chart_fixed_routes rf WHERE rf.rate_chart_id = rc.id AND rf.from_location_key = 'jharsuguda' AND rf.to_location_key = 'raipur' AND rf.vehicle_category_id = vc.id);

-- Route 3: DZIRE / Jharsuguda to Sambalpur = Rs.2000
INSERT INTO rate_chart_fixed_routes (rate_chart_id, vehicle_category_id, duty_type, from_location, to_location, from_location_key, to_location_key, fixed_amount, description)
SELECT rc.id, vc.id, 'drop_pickup', 'Jharsuguda', 'Sambalpur', 'jharsuguda', 'sambalpur', 2000, 'Jharsuguda to Sambalpur drop'
FROM rate_charts rc, vehicle_categories vc
WHERE rc.name = 'Vedanta Mining - Fixed Routes' AND vc.name = 'DZIRE'
AND NOT EXISTS (SELECT 1 FROM rate_chart_fixed_routes rf WHERE rf.rate_chart_id = rc.id AND rf.from_location_key = 'jharsuguda' AND rf.to_location_key = 'sambalpur' AND rf.vehicle_category_id = vc.id);


-- ---------------------------------------------------------------------------
-- 8. LEADS (3)
-- ---------------------------------------------------------------------------
INSERT INTO leads (lead_number, source, customer_id, prospect_name, prospect_phone, prospect_company, trip_type, from_location, to_location, travel_date, pax_count, estimated_amount, status, priority) VALUES
  ('LEAD0001', 'phone',
   (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0001'),
   'Vikram Sharma', '9876501001', 'Tata Steel Ltd',
   'local', 'Bhubaneswar', 'Bhubaneswar', '2026-03-01', 4, 3000, 'converted', 'high'),
  ('LEAD0002', 'email',
   NULL,
   'Priya Mishra', '9876509001', 'Nalco Industries',
   'outstation', 'Bhubaneswar', 'Puri', '2026-04-15', 6, 8000, 'new', 'medium'),
  ('LEAD0003', 'referral',
   NULL,
   'Alok Ranjan', '9876509002', 'Paradeep Port Trust',
   'local', 'Paradeep', 'Bhubaneswar', '2026-02-20', 3, 2500, 'lost', 'low')
ON CONFLICT (lead_number) DO NOTHING;

-- Update lost lead with reason
UPDATE leads SET lost_reason = 'Chose competitor with lower pricing'
WHERE lead_number = 'LEAD0003' AND lost_reason IS NULL;

-- ---------------------------------------------------------------------------
-- 9. TRIPS (8)
-- ---------------------------------------------------------------------------

-- TRP-00001: Tata Steel / CRYSTA / local / completed / within base limits
INSERT INTO trips (trip_number, customer_id, vehicle_id, driver_id, trip_date, duty_type,
  vehicle_category_id, rate_chart_id, rate_chart_item_id,
  start_time, end_time, start_km, end_km, actual_km, total_hours,
  from_location, to_location, passengers, status,
  base_charge, extra_km_charge, extra_hr_charge, night_halt_charge, fuel_charge, fixed_route_charge, ot_charge,
  trip_amount)
SELECT 'TRP-00001',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0001'),
  (SELECT id FROM vehicles WHERE vehicle_number = 'OD02AB1234'),
  (SELECT id FROM drivers WHERE driver_code = 'GT-DRV-0001'),
  '2026-03-01', 'local',
  (SELECT id FROM vehicle_categories WHERE name = 'CRYSTA'),
  rc.id, ri.id,
  '2026-03-01 08:00:00+05:30', '2026-03-01 15:00:00+05:30',
  10000, 10070, 70, 7,
  'Bhubaneswar', 'Bhubaneswar', 4, 'completed',
  3000, 0, 0, 0, 0, 0, 0,
  3000
FROM rate_charts rc
JOIN rate_chart_items ri ON ri.rate_chart_id = rc.id
  AND ri.package_code = '8HR-80KM'
  AND ri.duty_type = 'local'
  AND ri.vehicle_category_id = (SELECT id FROM vehicle_categories WHERE name = 'CRYSTA')
WHERE rc.name = 'Tata Steel - Standard Rates'
AND NOT EXISTS (SELECT 1 FROM trips WHERE trip_number = 'TRP-00001');

-- TRP-00002: Tata Steel / CRYSTA / local / completed / extra KM + HR exceeded
INSERT INTO trips (trip_number, customer_id, vehicle_id, driver_id, trip_date, duty_type,
  vehicle_category_id, rate_chart_id, rate_chart_item_id,
  start_time, end_time, start_km, end_km, actual_km, total_hours,
  from_location, to_location, passengers, status,
  base_charge, extra_km_charge, extra_hr_charge, night_halt_charge, fuel_charge, fixed_route_charge, ot_charge,
  trip_amount)
SELECT 'TRP-00002',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0001'),
  (SELECT id FROM vehicles WHERE vehicle_number = 'OD02AB1234'),
  (SELECT id FROM drivers WHERE driver_code = 'GT-DRV-0001'),
  '2026-03-03', 'local',
  (SELECT id FROM vehicle_categories WHERE name = 'CRYSTA'),
  rc.id, ri.id,
  '2026-03-03 07:00:00+05:30', '2026-03-03 17:00:00+05:30',
  10070, 10190, 120, 10,
  'Bhubaneswar', 'Khordha', 4, 'completed',
  3000, 720, 360, 0, 0, 0, 0,
  4080
FROM rate_charts rc
JOIN rate_chart_items ri ON ri.rate_chart_id = rc.id
  AND ri.package_code = '8HR-80KM'
  AND ri.duty_type = 'local'
  AND ri.vehicle_category_id = (SELECT id FROM vehicle_categories WHERE name = 'CRYSTA')
WHERE rc.name = 'Tata Steel - Standard Rates'
AND NOT EXISTS (SELECT 1 FROM trips WHERE trip_number = 'TRP-00002');

-- TRP-00003: Tata Steel / CRYSTA / outstation / completed / 3-day with annexures
INSERT INTO trips (trip_number, customer_id, vehicle_id, driver_id, trip_date, duty_type,
  vehicle_category_id, rate_chart_id, rate_chart_item_id,
  start_time, end_time, start_km, end_km, actual_km, total_hours, night_halts,
  from_location, to_location, passengers, status,
  base_charge, extra_km_charge, extra_hr_charge, night_halt_charge, fuel_charge, fixed_route_charge, ot_charge,
  trip_amount)
SELECT 'TRP-00003',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0001'),
  (SELECT id FROM vehicles WHERE vehicle_number = 'OD02AB1234'),
  (SELECT id FROM drivers WHERE driver_code = 'GT-DRV-0001'),
  '2026-03-10', 'outstation',
  (SELECT id FROM vehicle_categories WHERE name = 'CRYSTA'),
  rc.id, ri.id,
  '2026-03-10 06:00:00+05:30', '2026-03-12 18:00:00+05:30',
  10190, 10640, 450, 36, 2,
  'Bhubaneswar', 'Rourkela', 4, 'completed',
  6300, 0, 0, 1000, 0, 0, 0,
  7300
FROM rate_charts rc
JOIN rate_chart_items ri ON ri.rate_chart_id = rc.id
  AND ri.package_code = 'OS-KM'
  AND ri.duty_type = 'outstation'
  AND ri.vehicle_category_id = (SELECT id FROM vehicle_categories WHERE name = 'CRYSTA')
WHERE rc.name = 'Tata Steel - Standard Rates'
AND NOT EXISTS (SELECT 1 FROM trips WHERE trip_number = 'TRP-00003');

-- TRP-00004: JSPL / ERTIGA / local / completed
INSERT INTO trips (trip_number, customer_id, vehicle_id, driver_id, trip_date, duty_type,
  vehicle_category_id, rate_chart_id, rate_chart_item_id,
  start_time, end_time, start_km, end_km, actual_km, total_hours,
  from_location, to_location, passengers, status,
  base_charge, extra_km_charge, extra_hr_charge, night_halt_charge, fuel_charge, fixed_route_charge, ot_charge,
  trip_amount)
SELECT 'TRP-00004',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0002'),
  (SELECT id FROM vehicles WHERE vehicle_number = 'OD02EF9012'),
  (SELECT id FROM drivers WHERE driver_code = 'GT-DRV-0003'),
  '2026-03-05', 'local',
  (SELECT id FROM vehicle_categories WHERE name = 'ERTIGA'),
  rc.id, ri.id,
  '2026-03-05 09:00:00+05:30', '2026-03-05 18:00:00+05:30',
  20000, 20090, 90, 9,
  'Angul', 'Talcher', 3, 'completed',
  2500, 160, 160, 0, 0, 0, 0,
  2820
FROM rate_charts rc
JOIN rate_chart_items ri ON ri.rate_chart_id = rc.id
  AND ri.package_code = '8HR-80KM'
  AND ri.duty_type = 'local'
  AND ri.vehicle_category_id = (SELECT id FROM vehicle_categories WHERE name = 'ERTIGA')
WHERE rc.name = 'JSPL Corporate - Standard Rates'
AND NOT EXISTS (SELECT 1 FROM trips WHERE trip_number = 'TRP-00004');

-- TRP-00005: Vedanta / CRYSTA / drop_pickup / completed / fixed route
INSERT INTO trips (trip_number, customer_id, vehicle_id, driver_id, trip_date, duty_type,
  vehicle_category_id, rate_chart_id, rate_chart_item_id, rate_chart_fixed_route_id,
  start_time, end_time, start_km, end_km, actual_km, total_hours,
  from_location, to_location, passengers, status,
  base_charge, extra_km_charge, extra_hr_charge, night_halt_charge, fuel_charge, fixed_route_charge, ot_charge,
  trip_amount)
SELECT 'TRP-00005',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0003'),
  (SELECT id FROM vehicles WHERE vehicle_number = 'OD02AB1234'),
  (SELECT id FROM drivers WHERE driver_code = 'GT-DRV-0001'),
  '2026-03-07', 'drop_pickup',
  (SELECT id FROM vehicle_categories WHERE name = 'CRYSTA'),
  rc.id, ri.id, rf.id,
  '2026-03-07 05:00:00+05:30', '2026-03-07 12:00:00+05:30',
  10640, 10940, 300, 7,
  'Jharsuguda', 'Bhubaneswar', 2, 'completed',
  0, 0, 0, 0, 0, 6000, 0,
  6000
FROM rate_charts rc
JOIN rate_chart_items ri ON ri.rate_chart_id = rc.id
  AND ri.package_code = 'DROP-BASE'
  AND ri.vehicle_category_id = (SELECT id FROM vehicle_categories WHERE name = 'CRYSTA')
JOIN rate_chart_fixed_routes rf ON rf.rate_chart_id = rc.id
  AND rf.from_location_key = 'jharsuguda' AND rf.to_location_key = 'bhubaneswar'
  AND rf.vehicle_category_id = (SELECT id FROM vehicle_categories WHERE name = 'CRYSTA')
WHERE rc.name = 'Vedanta Mining - Fixed Routes'
AND NOT EXISTS (SELECT 1 FROM trips WHERE trip_number = 'TRP-00005');

-- TRP-00006: Tata Steel / DZIRE / local / completed / fuel formula
INSERT INTO trips (trip_number, customer_id, vehicle_id, driver_id, trip_date, duty_type,
  vehicle_category_id, rate_chart_id, rate_chart_item_id,
  start_time, end_time, start_km, end_km, actual_km, total_hours,
  from_location, to_location, passengers, status,
  base_charge, extra_km_charge, extra_hr_charge, night_halt_charge, fuel_charge, fixed_route_charge, ot_charge,
  trip_amount)
SELECT 'TRP-00006',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0001'),
  (SELECT id FROM vehicles WHERE vehicle_number = 'OD02CD5678'),
  (SELECT id FROM drivers WHERE driver_code = 'GT-DRV-0002'),
  '2026-03-08', 'local',
  (SELECT id FROM vehicle_categories WHERE name = 'DZIRE'),
  rc.id, ri.id,
  '2026-03-08 08:00:00+05:30', '2026-03-08 16:00:00+05:30',
  30000, 30100, 100, 8,
  'Bhubaneswar', 'Puri', 3, 'completed',
  1500, 0, 0, 0, 1667, 0, 0,
  3167
FROM rate_charts rc
JOIN rate_chart_items ri ON ri.rate_chart_id = rc.id
  AND ri.package_code = 'FUEL-KM'
  AND ri.vehicle_category_id = (SELECT id FROM vehicle_categories WHERE name = 'DZIRE')
WHERE rc.name = 'Tata Steel - Standard Rates'
AND NOT EXISTS (SELECT 1 FROM trips WHERE trip_number = 'TRP-00006');

-- TRP-00007: JSPL / TRAVELLER 17 / outstation / in_progress
INSERT INTO trips (trip_number, customer_id, vehicle_id, driver_id, trip_date, duty_type,
  vehicle_category_id, rate_chart_id, rate_chart_item_id,
  start_time, start_km,
  from_location, to_location, passengers, status,
  base_charge, extra_km_charge, extra_hr_charge, night_halt_charge, fuel_charge, fixed_route_charge, ot_charge,
  trip_amount)
SELECT 'TRP-00007',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0002'),
  (SELECT id FROM vehicles WHERE vehicle_number = 'OD02GH3456'),
  (SELECT id FROM drivers WHERE driver_code = 'GT-DRV-0004'),
  '2026-03-18', 'outstation',
  (SELECT id FROM vehicle_categories WHERE name = 'TRAVELLER 17'),
  rc.id, ri.id,
  '2026-03-18 06:00:00+05:30', 40000,
  'Angul', 'Kolkata', 12, 'in_progress',
  0, 0, 0, 0, 0, 0, 0,
  0
FROM rate_charts rc
JOIN rate_chart_items ri ON ri.rate_chart_id = rc.id
  AND ri.package_code = 'OS-KM'
  AND ri.duty_type = 'outstation'
  AND ri.vehicle_category_id = (SELECT id FROM vehicle_categories WHERE name = 'TRAVELLER 17')
WHERE rc.name = 'JSPL Corporate - Standard Rates'
AND NOT EXISTS (SELECT 1 FROM trips WHERE trip_number = 'TRP-00007');

-- TRP-00008: Tata Steel / DZIRE / local / scheduled / future trip
INSERT INTO trips (trip_number, customer_id, vehicle_id, driver_id, trip_date, duty_type,
  vehicle_category_id, rate_chart_id, rate_chart_item_id,
  from_location, to_location, passengers, status,
  base_charge, extra_km_charge, extra_hr_charge, night_halt_charge, fuel_charge, fixed_route_charge, ot_charge,
  trip_amount)
SELECT 'TRP-00008',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0001'),
  (SELECT id FROM vehicles WHERE vehicle_number = 'OD02CD5678'),
  (SELECT id FROM drivers WHERE driver_code = 'GT-DRV-0002'),
  '2026-03-25', 'local',
  (SELECT id FROM vehicle_categories WHERE name = 'DZIRE'),
  rc.id, ri.id,
  'Bhubaneswar', 'Cuttack', 2, 'scheduled',
  0, 0, 0, 0, 0, 0, 0,
  0
FROM rate_charts rc
JOIN rate_chart_items ri ON ri.rate_chart_id = rc.id
  AND ri.package_code = '8HR-80KM'
  AND ri.duty_type = 'local'
  AND ri.vehicle_category_id = (SELECT id FROM vehicle_categories WHERE name = 'DZIRE')
WHERE rc.name = 'Tata Steel - Standard Rates'
AND NOT EXISTS (SELECT 1 FROM trips WHERE trip_number = 'TRP-00008');


-- ---------------------------------------------------------------------------
-- 10. TRIP TRAVEL METRICS (for outstation TRP-00003)
-- ---------------------------------------------------------------------------

-- Day 1 metric
INSERT INTO trip_travel_metrics (trip_id, seq, start_date, start_time, start_km, end_date, end_time, end_km)
SELECT t.id, 1, '2026-03-10', '06:00', 10190, '2026-03-10', '18:00', 10340
FROM trips t WHERE t.trip_number = 'TRP-00003'
AND NOT EXISTS (SELECT 1 FROM trip_travel_metrics ttm WHERE ttm.trip_id = t.id AND ttm.seq = 1);

-- Day 2 metric
INSERT INTO trip_travel_metrics (trip_id, seq, start_date, start_time, start_km, end_date, end_time, end_km)
SELECT t.id, 2, '2026-03-11', '07:00', 10340, '2026-03-11', '19:00', 10520
FROM trips t WHERE t.trip_number = 'TRP-00003'
AND NOT EXISTS (SELECT 1 FROM trip_travel_metrics ttm WHERE ttm.trip_id = t.id AND ttm.seq = 2);

-- Day 3 metric
INSERT INTO trip_travel_metrics (trip_id, seq, start_date, start_time, start_km, end_date, end_time, end_km)
SELECT t.id, 3, '2026-03-12', '06:00', 10520, '2026-03-12', '18:00', 10640
FROM trips t WHERE t.trip_number = 'TRP-00003'
AND NOT EXISTS (SELECT 1 FROM trip_travel_metrics ttm WHERE ttm.trip_id = t.id AND ttm.seq = 3);


-- ---------------------------------------------------------------------------
-- 11. ANNEXURES (3 for TRP-00003)
-- ---------------------------------------------------------------------------

-- Annexure AX-001: Day 1, 150 km, 12 hr, Rs.2100 (billed)
INSERT INTO annexures (annexure_number, trip_id, start_date, end_date, start_km, end_km, total_km, total_hours, night_halts, calculated_amount, is_billed)
SELECT 'AX-001', t.id, '2026-03-10', '2026-03-10', 10190, 10340, 150, 12, 0, 2100, false
FROM trips t WHERE t.trip_number = 'TRP-00003'
AND NOT EXISTS (SELECT 1 FROM annexures a WHERE a.trip_id = t.id AND a.annexure_number = 'AX-001');

-- Annexure AX-002: Day 2, 180 km, 12 hr, Rs.2520 (billed)
INSERT INTO annexures (annexure_number, trip_id, start_date, end_date, start_km, end_km, total_km, total_hours, night_halts, calculated_amount, is_billed)
SELECT 'AX-002', t.id, '2026-03-11', '2026-03-11', 10340, 10520, 180, 12, 0, 2520, false
FROM trips t WHERE t.trip_number = 'TRP-00003'
AND NOT EXISTS (SELECT 1 FROM annexures a WHERE a.trip_id = t.id AND a.annexure_number = 'AX-002');

-- Annexure AX-003: Day 3, 120 km, 12 hr, Rs.2680 (unbilled, includes 2 night halts)
INSERT INTO annexures (annexure_number, trip_id, start_date, end_date, start_km, end_km, total_km, total_hours, night_halts, calculated_amount, is_billed)
SELECT 'AX-003', t.id, '2026-03-12', '2026-03-12', 10520, 10640, 120, 12, 2, 2680, false
FROM trips t WHERE t.trip_number = 'TRP-00003'
AND NOT EXISTS (SELECT 1 FROM annexures a WHERE a.trip_id = t.id AND a.annexure_number = 'AX-003');

-- Annexure metrics (link annexures to trip_travel_metrics)
INSERT INTO annexure_metrics (annexure_id, metric_id, seq)
SELECT a.id, ttm.id, 1
FROM annexures a
JOIN trips t ON a.trip_id = t.id
JOIN trip_travel_metrics ttm ON ttm.trip_id = t.id AND ttm.seq = 1
WHERE t.trip_number = 'TRP-00003' AND a.annexure_number = 'AX-001'
AND NOT EXISTS (SELECT 1 FROM annexure_metrics am WHERE am.annexure_id = a.id AND am.seq = 1);

INSERT INTO annexure_metrics (annexure_id, metric_id, seq)
SELECT a.id, ttm.id, 1
FROM annexures a
JOIN trips t ON a.trip_id = t.id
JOIN trip_travel_metrics ttm ON ttm.trip_id = t.id AND ttm.seq = 2
WHERE t.trip_number = 'TRP-00003' AND a.annexure_number = 'AX-002'
AND NOT EXISTS (SELECT 1 FROM annexure_metrics am WHERE am.annexure_id = a.id AND am.seq = 1);

INSERT INTO annexure_metrics (annexure_id, metric_id, seq)
SELECT a.id, ttm.id, 1
FROM annexures a
JOIN trips t ON a.trip_id = t.id
JOIN trip_travel_metrics ttm ON ttm.trip_id = t.id AND ttm.seq = 3
WHERE t.trip_number = 'TRP-00003' AND a.annexure_number = 'AX-003'
AND NOT EXISTS (SELECT 1 FROM annexure_metrics am WHERE am.annexure_id = a.id AND am.seq = 1);


-- ---------------------------------------------------------------------------
-- 12. INVOICES (6)
-- ---------------------------------------------------------------------------

-- INV-00001: Tata Steel / TRP-00001 / fully paid
INSERT INTO invoices (invoice_number, invoice_date, customer_id, customer_gstin, duty_type_label,
  vehicle_number, vehicle_type_label, duty_slip_number,
  total_km, total_hours, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
  payment_status, payment_terms_days, due_date)
SELECT 'INV-00001', '2026-03-02',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0001'),
  '21AABCT1234Q1ZP', 'Local', 'OD02AB1234', 'CRYSTA', 'TRP-00001',
  70, 7, 3000, 75, 75, 0, 3150,
  'completed', 30, '2026-04-01'
WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE invoice_number = 'INV-00001');

-- INV-00002: Tata Steel / TRP-00002 / partially paid
INSERT INTO invoices (invoice_number, invoice_date, customer_id, customer_gstin, duty_type_label,
  vehicle_number, vehicle_type_label, duty_slip_number,
  total_km, total_hours, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
  payment_status, payment_terms_days, due_date)
SELECT 'INV-00002', '2026-03-04',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0001'),
  '21AABCT1234Q1ZP', 'Local', 'OD02AB1234', 'CRYSTA', 'TRP-00002',
  120, 10, 4080, 102, 102, 0, 4284,
  'partial', 30, '2026-04-03'
WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE invoice_number = 'INV-00002');

-- INV-00003: Tata Steel / Annexures AX-001+AX-002 / pending
INSERT INTO invoices (invoice_number, invoice_date, customer_id, customer_gstin, duty_type_label,
  vehicle_number, vehicle_type_label, duty_slip_number,
  total_km, total_hours, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
  payment_status, payment_terms_days, due_date)
SELECT 'INV-00003', '2026-03-13',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0001'),
  '21AABCT1234Q1ZP', 'Outstation', 'OD02AB1234', 'CRYSTA', 'TRP-00003',
  330, 24, 4620, 115.50, 115.50, 0, 4851,
  'pending', 30, '2026-04-12'
WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE invoice_number = 'INV-00003');

-- INV-00004: JSPL / TRP-00004 / fully paid
INSERT INTO invoices (invoice_number, invoice_date, customer_id, customer_gstin, duty_type_label,
  vehicle_number, vehicle_type_label, duty_slip_number,
  total_km, total_hours, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
  payment_status, payment_terms_days, due_date)
SELECT 'INV-00004', '2026-03-06',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0002'),
  '21AABCJ5678R1ZQ', 'Local', 'OD02EF9012', 'ERTIGA', 'TRP-00004',
  90, 9, 2820, 70.50, 70.50, 0, 2961,
  'completed', 15, '2026-03-21'
WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE invoice_number = 'INV-00004');

-- INV-00005: Vedanta / TRP-00005 / pending
INSERT INTO invoices (invoice_number, invoice_date, customer_id, customer_gstin, duty_type_label,
  vehicle_number, vehicle_type_label, duty_slip_number,
  total_km, total_hours, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
  payment_status, payment_terms_days, due_date)
SELECT 'INV-00005', '2026-03-08',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0003'),
  '21AABCV9012S1ZR', 'Drop/Pickup', 'OD02AB1234', 'CRYSTA', 'TRP-00005',
  300, 7, 6000, 150, 150, 0, 6300,
  'pending', 15, '2026-03-23'
WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE invoice_number = 'INV-00005');

-- INV-00006: Tata Steel / Manual / pending
INSERT INTO invoices (invoice_number, invoice_date, customer_id, customer_gstin, duty_type_label,
  subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
  payment_status, payment_terms_days, due_date, remarks)
SELECT 'INV-00006', '2026-03-15',
  (SELECT id FROM customers WHERE customer_code = 'GT-CUST-0001'),
  '21AABCT1234Q1ZP', 'Multiple',
  15000, 375, 375, 0, 15750,
  'pending', 30, '2026-04-14', 'Manual invoice for consolidated monthly billing'
WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE invoice_number = 'INV-00006');


-- ---------------------------------------------------------------------------
-- 13. INVOICE ITEMS
-- ---------------------------------------------------------------------------

-- INV-00001 item (trip-linked)
INSERT INTO invoice_items (invoice_id, trip_id, description, hsn_code, quantity, rate, amount,
  cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount)
SELECT inv.id, t.id, 'CRYSTA - Local 8HR/80KM - Bhubaneswar (TRP-00001)', '996601', 1, 3000, 3000,
  2.50, 2.50, 0, 75, 75, 0, 3150
FROM invoices inv, trips t
WHERE inv.invoice_number = 'INV-00001' AND t.trip_number = 'TRP-00001'
AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = inv.id AND ii.trip_id = t.id);

-- INV-00002 item (trip-linked)
INSERT INTO invoice_items (invoice_id, trip_id, description, hsn_code, quantity, rate, amount,
  cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount)
SELECT inv.id, t.id, 'CRYSTA - Local 8HR/80KM - Bhubaneswar to Khordha (TRP-00002)', '996601', 1, 4080, 4080,
  2.50, 2.50, 0, 102, 102, 0, 4284
FROM invoices inv, trips t
WHERE inv.invoice_number = 'INV-00002' AND t.trip_number = 'TRP-00002'
AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = inv.id AND ii.trip_id = t.id);

-- INV-00003 items (annexure-linked, 2 items for AX-001 and AX-002)
-- Update annexures to mark as billed first (will set invoice_id after invoice exists)
UPDATE annexures SET is_billed = true, invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00003')
WHERE trip_id = (SELECT id FROM trips WHERE trip_number = 'TRP-00003')
  AND annexure_number IN ('AX-001', 'AX-002')
  AND is_billed = false
  AND EXISTS (SELECT 1 FROM invoices WHERE invoice_number = 'INV-00003');

INSERT INTO invoice_items (invoice_id, trip_id, annexure_id, description, hsn_code, quantity, rate, amount,
  cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount)
SELECT inv.id, t.id, a.id, 'CRYSTA - Outstation Day 1 (AX-001) - Bhubaneswar to Rourkela', '996601', 1, 2100, 2100,
  2.50, 2.50, 0, 52.50, 52.50, 0, 2205
FROM invoices inv, trips t, annexures a
WHERE inv.invoice_number = 'INV-00003' AND t.trip_number = 'TRP-00003' AND a.trip_id = t.id AND a.annexure_number = 'AX-001'
AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = inv.id AND ii.annexure_id = a.id);

INSERT INTO invoice_items (invoice_id, trip_id, annexure_id, description, hsn_code, quantity, rate, amount,
  cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount)
SELECT inv.id, t.id, a.id, 'CRYSTA - Outstation Day 2 (AX-002) - Bhubaneswar to Rourkela', '996601', 1, 2520, 2520,
  2.50, 2.50, 0, 63, 63, 0, 2646
FROM invoices inv, trips t, annexures a
WHERE inv.invoice_number = 'INV-00003' AND t.trip_number = 'TRP-00003' AND a.trip_id = t.id AND a.annexure_number = 'AX-002'
AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = inv.id AND ii.annexure_id = a.id);

-- INV-00004 item (trip-linked)
INSERT INTO invoice_items (invoice_id, trip_id, description, hsn_code, quantity, rate, amount,
  cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount)
SELECT inv.id, t.id, 'ERTIGA - Local 8HR/80KM - Angul to Talcher (TRP-00004)', '996601', 1, 2820, 2820,
  2.50, 2.50, 0, 70.50, 70.50, 0, 2961
FROM invoices inv, trips t
WHERE inv.invoice_number = 'INV-00004' AND t.trip_number = 'TRP-00004'
AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = inv.id AND ii.trip_id = t.id);

-- INV-00005 item (trip-linked, fixed route)
INSERT INTO invoice_items (invoice_id, trip_id, description, hsn_code, quantity, rate, amount,
  cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount)
SELECT inv.id, t.id, 'CRYSTA - Fixed Route Jharsuguda to Bhubaneswar (TRP-00005)', '996601', 1, 6000, 6000,
  2.50, 2.50, 0, 150, 150, 0, 6300
FROM invoices inv, trips t
WHERE inv.invoice_number = 'INV-00005' AND t.trip_number = 'TRP-00005'
AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = inv.id AND ii.trip_id = t.id);

-- INV-00006 item (manual, no trip)
INSERT INTO invoice_items (invoice_id, description, hsn_code, quantity, rate, amount,
  cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount)
SELECT inv.id, 'Consolidated monthly transport services - March 2026', '996601', 1, 15000, 15000,
  2.50, 2.50, 0, 375, 375, 0, 15750
FROM invoices inv
WHERE inv.invoice_number = 'INV-00006'
AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = inv.id);


-- ---------------------------------------------------------------------------
-- 14. INVOICE TAX COMPONENTS
-- ---------------------------------------------------------------------------

-- Helper: insert tax components for each invoice (CGST + SGST, all intra-state)
-- INV-00001
INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'CGST', 'CGST', 'intra_state', '996601', 3000, 2.5000, true, 75, 1
FROM invoices WHERE invoice_number = 'INV-00001'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00001') AND itc.component_code = 'CGST');

INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'SGST', 'SGST', 'intra_state', '996601', 3000, 2.5000, true, 75, 2
FROM invoices WHERE invoice_number = 'INV-00001'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00001') AND itc.component_code = 'SGST');

-- INV-00002
INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'CGST', 'CGST', 'intra_state', '996601', 4080, 2.5000, true, 102, 1
FROM invoices WHERE invoice_number = 'INV-00002'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00002') AND itc.component_code = 'CGST');

INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'SGST', 'SGST', 'intra_state', '996601', 4080, 2.5000, true, 102, 2
FROM invoices WHERE invoice_number = 'INV-00002'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00002') AND itc.component_code = 'SGST');

-- INV-00003
INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'CGST', 'CGST', 'intra_state', '996601', 4620, 2.5000, true, 115.50, 1
FROM invoices WHERE invoice_number = 'INV-00003'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00003') AND itc.component_code = 'CGST');

INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'SGST', 'SGST', 'intra_state', '996601', 4620, 2.5000, true, 115.50, 2
FROM invoices WHERE invoice_number = 'INV-00003'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00003') AND itc.component_code = 'SGST');

-- INV-00004
INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'CGST', 'CGST', 'intra_state', '996601', 2820, 2.5000, true, 70.50, 1
FROM invoices WHERE invoice_number = 'INV-00004'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00004') AND itc.component_code = 'CGST');

INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'SGST', 'SGST', 'intra_state', '996601', 2820, 2.5000, true, 70.50, 2
FROM invoices WHERE invoice_number = 'INV-00004'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00004') AND itc.component_code = 'SGST');

-- INV-00005
INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'CGST', 'CGST', 'intra_state', '996601', 6000, 2.5000, true, 150, 1
FROM invoices WHERE invoice_number = 'INV-00005'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00005') AND itc.component_code = 'CGST');

INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'SGST', 'SGST', 'intra_state', '996601', 6000, 2.5000, true, 150, 2
FROM invoices WHERE invoice_number = 'INV-00005'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00005') AND itc.component_code = 'SGST');

-- INV-00006
INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'CGST', 'CGST', 'intra_state', '996601', 15000, 2.5000, true, 375, 1
FROM invoices WHERE invoice_number = 'INV-00006'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00006') AND itc.component_code = 'CGST');

INSERT INTO invoice_tax_components (invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT id, 'SGST', 'SGST', 'intra_state', '996601', 15000, 2.5000, true, 375, 2
FROM invoices WHERE invoice_number = 'INV-00006'
AND NOT EXISTS (SELECT 1 FROM invoice_tax_components itc WHERE itc.invoice_id = (SELECT id FROM invoices WHERE invoice_number = 'INV-00006') AND itc.component_code = 'SGST');


-- ---------------------------------------------------------------------------
-- 15. INVOICE ITEM TAX COMPONENTS
-- ---------------------------------------------------------------------------

-- For each invoice item, insert CGST + SGST item-level tax components
-- INV-00001 item
INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'CGST', 'CGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.cgst_amount, 1
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00001'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'CGST');

INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'SGST', 'SGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.sgst_amount, 2
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00001'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'SGST');

-- INV-00002 item
INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'CGST', 'CGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.cgst_amount, 1
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00002'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'CGST');

INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'SGST', 'SGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.sgst_amount, 2
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00002'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'SGST');

-- INV-00003 items (2 annexure items)
INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'CGST', 'CGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.cgst_amount, 1
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00003'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'CGST');

INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'SGST', 'SGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.sgst_amount, 2
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00003'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'SGST');

-- INV-00004 item
INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'CGST', 'CGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.cgst_amount, 1
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00004'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'CGST');

INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'SGST', 'SGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.sgst_amount, 2
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00004'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'SGST');

-- INV-00005 item
INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'CGST', 'CGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.cgst_amount, 1
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00005'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'CGST');

INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'SGST', 'SGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.sgst_amount, 2
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00005'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'SGST');

-- INV-00006 item
INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'CGST', 'CGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.cgst_amount, 1
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00006'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'CGST');

INSERT INTO invoice_item_tax_components (invoice_item_id, invoice_id, component_code, component_name, applies_to, hsn_code, taxable_base, rate, is_percentage, tax_amount, sort_order)
SELECT ii.id, ii.invoice_id, 'SGST', 'SGST', 'intra_state', '996601', ii.amount, 2.5000, true, ii.sgst_amount, 2
FROM invoice_items ii JOIN invoices inv ON ii.invoice_id = inv.id
WHERE inv.invoice_number = 'INV-00006'
AND NOT EXISTS (SELECT 1 FROM invoice_item_tax_components iitc WHERE iitc.invoice_item_id = ii.id AND iitc.component_code = 'SGST');


-- ---------------------------------------------------------------------------
-- 16. FINANCIAL LEDGER entries for each invoice
-- ---------------------------------------------------------------------------

INSERT INTO financial_ledger (event_type, customer_id, invoice_id, invoice_number, amount, direction, description)
SELECT 'invoice_issued', c.id, inv.id, inv.invoice_number, inv.total_amount, 'AR_INCREASE',
  'Invoice ' || inv.invoice_number || ' issued to ' || c.name
FROM invoices inv JOIN customers c ON inv.customer_id = c.id
WHERE inv.invoice_number = 'INV-00001'
AND NOT EXISTS (SELECT 1 FROM financial_ledger fl WHERE fl.invoice_number = 'INV-00001' AND fl.event_type = 'invoice_issued');

INSERT INTO financial_ledger (event_type, customer_id, invoice_id, invoice_number, amount, direction, description)
SELECT 'invoice_issued', c.id, inv.id, inv.invoice_number, inv.total_amount, 'AR_INCREASE',
  'Invoice ' || inv.invoice_number || ' issued to ' || c.name
FROM invoices inv JOIN customers c ON inv.customer_id = c.id
WHERE inv.invoice_number = 'INV-00002'
AND NOT EXISTS (SELECT 1 FROM financial_ledger fl WHERE fl.invoice_number = 'INV-00002' AND fl.event_type = 'invoice_issued');

INSERT INTO financial_ledger (event_type, customer_id, invoice_id, invoice_number, amount, direction, description)
SELECT 'invoice_issued', c.id, inv.id, inv.invoice_number, inv.total_amount, 'AR_INCREASE',
  'Invoice ' || inv.invoice_number || ' issued to ' || c.name
FROM invoices inv JOIN customers c ON inv.customer_id = c.id
WHERE inv.invoice_number = 'INV-00003'
AND NOT EXISTS (SELECT 1 FROM financial_ledger fl WHERE fl.invoice_number = 'INV-00003' AND fl.event_type = 'invoice_issued');

INSERT INTO financial_ledger (event_type, customer_id, invoice_id, invoice_number, amount, direction, description)
SELECT 'invoice_issued', c.id, inv.id, inv.invoice_number, inv.total_amount, 'AR_INCREASE',
  'Invoice ' || inv.invoice_number || ' issued to ' || c.name
FROM invoices inv JOIN customers c ON inv.customer_id = c.id
WHERE inv.invoice_number = 'INV-00004'
AND NOT EXISTS (SELECT 1 FROM financial_ledger fl WHERE fl.invoice_number = 'INV-00004' AND fl.event_type = 'invoice_issued');

INSERT INTO financial_ledger (event_type, customer_id, invoice_id, invoice_number, amount, direction, description)
SELECT 'invoice_issued', c.id, inv.id, inv.invoice_number, inv.total_amount, 'AR_INCREASE',
  'Invoice ' || inv.invoice_number || ' issued to ' || c.name
FROM invoices inv JOIN customers c ON inv.customer_id = c.id
WHERE inv.invoice_number = 'INV-00005'
AND NOT EXISTS (SELECT 1 FROM financial_ledger fl WHERE fl.invoice_number = 'INV-00005' AND fl.event_type = 'invoice_issued');

INSERT INTO financial_ledger (event_type, customer_id, invoice_id, invoice_number, amount, direction, description)
SELECT 'invoice_issued', c.id, inv.id, inv.invoice_number, inv.total_amount, 'AR_INCREASE',
  'Invoice ' || inv.invoice_number || ' issued to ' || c.name
FROM invoices inv JOIN customers c ON inv.customer_id = c.id
WHERE inv.invoice_number = 'INV-00006'
AND NOT EXISTS (SELECT 1 FROM financial_ledger fl WHERE fl.invoice_number = 'INV-00006' AND fl.event_type = 'invoice_issued');


-- ---------------------------------------------------------------------------
-- 17. COLLECTIONS (3)
-- ---------------------------------------------------------------------------

-- GT-RCPT-0001: Full payment for INV-00001
INSERT INTO collections (collection_number, collection_date, invoice_id, amount, payment_mode, reference_number, bank_name)
SELECT 'GT-RCPT-0001', '2026-03-05',
  (SELECT id FROM invoices WHERE invoice_number = 'INV-00001'),
  3150, 'bank_transfer', 'NEFT-20260305-001', 'HDFC Bank'
WHERE NOT EXISTS (SELECT 1 FROM collections WHERE collection_number = 'GT-RCPT-0001');

-- Ledger entry for collection
INSERT INTO financial_ledger (event_type, customer_id, invoice_id, invoice_number, collection_id, amount, direction, description)
SELECT 'payment_received',
  (SELECT customer_id FROM invoices WHERE invoice_number = 'INV-00001'),
  (SELECT id FROM invoices WHERE invoice_number = 'INV-00001'),
  'INV-00001',
  (SELECT id FROM collections WHERE collection_number = 'GT-RCPT-0001'),
  3150, 'AR_DECREASE',
  'Payment received: GT-RCPT-0001 against INV-00001'
WHERE NOT EXISTS (SELECT 1 FROM financial_ledger fl WHERE fl.invoice_number = 'INV-00001' AND fl.event_type = 'payment_received' AND fl.amount = 3150);

-- GT-RCPT-0002: Partial payment for INV-00002
INSERT INTO collections (collection_number, collection_date, invoice_id, amount, payment_mode, reference_number, bank_name)
SELECT 'GT-RCPT-0002', '2026-03-10',
  (SELECT id FROM invoices WHERE invoice_number = 'INV-00002'),
  2000, 'cheque', 'CHQ-456789', 'SBI'
WHERE NOT EXISTS (SELECT 1 FROM collections WHERE collection_number = 'GT-RCPT-0002');

INSERT INTO financial_ledger (event_type, customer_id, invoice_id, invoice_number, collection_id, amount, direction, description)
SELECT 'payment_received',
  (SELECT customer_id FROM invoices WHERE invoice_number = 'INV-00002'),
  (SELECT id FROM invoices WHERE invoice_number = 'INV-00002'),
  'INV-00002',
  (SELECT id FROM collections WHERE collection_number = 'GT-RCPT-0002'),
  2000, 'AR_DECREASE',
  'Partial payment received: GT-RCPT-0002 against INV-00002'
WHERE NOT EXISTS (SELECT 1 FROM financial_ledger fl WHERE fl.invoice_number = 'INV-00002' AND fl.event_type = 'payment_received' AND fl.amount = 2000);

-- GT-RCPT-0003: Full payment for INV-00004
INSERT INTO collections (collection_number, collection_date, invoice_id, amount, payment_mode, reference_number)
SELECT 'GT-RCPT-0003', '2026-03-08',
  (SELECT id FROM invoices WHERE invoice_number = 'INV-00004'),
  2961, 'upi', 'UPI-JSPL-20260308'
WHERE NOT EXISTS (SELECT 1 FROM collections WHERE collection_number = 'GT-RCPT-0003');

INSERT INTO financial_ledger (event_type, customer_id, invoice_id, invoice_number, collection_id, amount, direction, description)
SELECT 'payment_received',
  (SELECT customer_id FROM invoices WHERE invoice_number = 'INV-00004'),
  (SELECT id FROM invoices WHERE invoice_number = 'INV-00004'),
  'INV-00004',
  (SELECT id FROM collections WHERE collection_number = 'GT-RCPT-0003'),
  2961, 'AR_DECREASE',
  'Payment received: GT-RCPT-0003 against INV-00004'
WHERE NOT EXISTS (SELECT 1 FROM financial_ledger fl WHERE fl.invoice_number = 'INV-00004' AND fl.event_type = 'payment_received' AND fl.amount = 2961);


-- ---------------------------------------------------------------------------
-- 18. DRIVER SETTLEMENTS (2)
-- ---------------------------------------------------------------------------

-- SAL-0001: Ramesh Sahoo, Mar 1-15, 3 trips, paid
INSERT INTO driver_settlements (settlement_number, driver_id, period_from, period_to, total_trips, total_km, total_allowance, advances, deductions, net_amount, payment_mode, payment_date, reference_number, status)
SELECT 'SAL-0001',
  (SELECT id FROM drivers WHERE driver_code = 'GT-DRV-0001'),
  '2026-03-01', '2026-03-15', 3, 640, 9600, 500, 600, 8500, 'bank_transfer', '2026-03-16', 'NEFT-SAL-0001', 'paid'
WHERE NOT EXISTS (SELECT 1 FROM driver_settlements WHERE settlement_number = 'SAL-0001');

-- SAL-0002: Suresh Mohanty, Mar 1-15, 1 trip, pending
INSERT INTO driver_settlements (settlement_number, driver_id, period_from, period_to, total_trips, total_km, total_allowance, advances, deductions, net_amount, status)
SELECT 'SAL-0002',
  (SELECT id FROM drivers WHERE driver_code = 'GT-DRV-0002'),
  '2026-03-01', '2026-03-15', 1, 100, 4000, 500, 0, 3500, 'pending'
WHERE NOT EXISTS (SELECT 1 FROM driver_settlements WHERE settlement_number = 'SAL-0002');


-- ---------------------------------------------------------------------------
-- 19. OWNER SETTLEMENT (1)
-- ---------------------------------------------------------------------------

-- VEN-0001: Raj Auto Rentals, ERTIGA, Mar 1-15, pending
INSERT INTO owner_settlements (settlement_number, owner_id, vehicle_id, period_from, period_to, total_trips, total_km, total_amount, tds_amount, other_deductions, net_amount, status)
SELECT 'VEN-0001',
  (SELECT id FROM owners_vendors WHERE code = 'GT-OWN-0002'),
  (SELECT id FROM vehicles WHERE vehicle_number = 'OD02EF9012'),
  '2026-03-01', '2026-03-15', 2, 390, 13000, 800, 200, 12000, 'pending'
WHERE NOT EXISTS (SELECT 1 FROM owner_settlements WHERE settlement_number = 'VEN-0001');


COMMIT;

-- =============================================================================
-- Verification queries
-- =============================================================================
SELECT 'owners' AS entity, COUNT(*) AS cnt FROM owners_vendors WHERE code LIKE 'GT-OWN-%'
UNION ALL SELECT 'customers', COUNT(*) FROM customers WHERE customer_code LIKE 'GT-CUST-%'
UNION ALL SELECT 'vehicle_categories', COUNT(*) FROM vehicle_categories WHERE name IN ('CRYSTA','DZIRE','ERTIGA','TRAVELLER 17')
UNION ALL SELECT 'vehicles', COUNT(*) FROM vehicles WHERE vehicle_number LIKE 'OD02%'
UNION ALL SELECT 'drivers', COUNT(*) FROM drivers WHERE driver_code LIKE 'GT-DRV-%'
UNION ALL SELECT 'rate_charts', COUNT(*) FROM rate_charts WHERE name LIKE '%Standard Rates' OR name LIKE '%Fixed Routes'
UNION ALL SELECT 'leads', COUNT(*) FROM leads WHERE lead_number LIKE 'LEAD%'
UNION ALL SELECT 'trips', COUNT(*) FROM trips WHERE trip_number LIKE 'TRP-%'
UNION ALL SELECT 'annexures', COUNT(*) FROM annexures WHERE annexure_number LIKE 'AX-%'
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices WHERE invoice_number LIKE 'INV-%'
UNION ALL SELECT 'collections', COUNT(*) FROM collections WHERE collection_number LIKE 'GT-RCPT-%'
UNION ALL SELECT 'driver_settlements', COUNT(*) FROM driver_settlements WHERE settlement_number LIKE 'SAL-%'
UNION ALL SELECT 'owner_settlements', COUNT(*) FROM owner_settlements WHERE settlement_number LIKE 'VEN-%'
ORDER BY entity;
