INSERT INTO profiles (email, full_name, role, phone, password_hash, is_active)
VALUES (
  'admin@travelerp.com',
  'System Administrator',
  'admin',
  '+91-9000000000',
  crypt('Admin@123456', gen_salt('bf', 10)),
  true
)
ON CONFLICT (email) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO customers (customer_code, name, contact_person, phone, email, address, city, state, pincode, gstin, credit_limit, credit_days, is_active)
VALUES
  ('CUST001', 'ABC Travel Company', 'Rajesh Kumar', '+91-8765432109', 'rajesh@abctravel.com', '123 Main Street', 'Mumbai', 'Maharashtra', '400001', '27AABCA1234D1Z0', 500000, 30, true),
  ('CUST002', 'XYZ Logistics Pvt Ltd', 'Priya Singh', '+91-8765432108', 'priya@xyzlog.com', '456 Business Park', 'Bengaluru', 'Karnataka', '560001', '29AABCA5678D1Z0', 750000, 45, true),
  ('CUST003', 'Metro Tours and Travels', 'Amit Patel', '+91-8765432107', 'amit@metrotours.com', '789 Tourist Lane', 'Delhi', 'Delhi', '110001', '07AABCA9101D1Z0', 600000, 30, true)
ON CONFLICT (customer_code) DO NOTHING;

INSERT INTO owners_vendors (code, name, contact_person, phone, email, address, city, state, pincode, gstin, pan, bank_name, bank_account, ifsc_code, is_active)
VALUES
  ('OWNER001', 'Prime Fleet Services', 'Harish Verma', '+91-9123456789', 'harish@primefleet.com', '321 Fleet Street', 'Pune', 'Maharashtra', '411001', '27AABCP1234D1Z0', 'AABCP1234D', 'ICICI Bank', '1234567890123456', 'ICIC0000001', true),
  ('OWNER002', 'Swift Transport Co.', 'Vikram Singh', '+91-9123456788', 'vikram@swifttrans.com', '654 Highway Road', 'Hyderabad', 'Telangana', '500001', '36AABCT5678D1Z0', 'AABCT5678D', 'HDFC Bank', '9876543210123456', 'HDFC0000001', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO drivers (driver_code, name, phone, email, address, city, state, license_number, license_expiry, date_of_birth, blood_group, emergency_contact, emergency_phone, pan, bank_name, bank_account, ifsc_code, is_active)
VALUES
  ('DRV001', 'Rohit Kumar', '+91-9876543210', 'rohit@driver.com', '111 Driver Street', 'Mumbai', 'Maharashtra', 'MH01AB1234', '2027-12-31', '1990-05-15', 'O+', 'Ramesh Kumar', '+91-9876543215', 'BCPPR5055K', 'SBI', '1234567890', 'SBIN0001234', true),
  ('DRV002', 'Sunil Sharma', '+91-9876543209', 'sunil@driver.com', '222 Driver Lane', 'Bengaluru', 'Karnataka', 'KA01CD5678', '2028-06-30', '1992-03-20', 'AB+', 'Mohan Sharma', '+91-9876543216', 'BCPPS6078L', 'HDFC', '9876543210', 'HDFC0001234', true),
  ('DRV003', 'Amar Patel', '+91-9876543208', 'amar@driver.com', '333 Driver Road', 'Pune', 'Maharashtra', 'MH02EF9012', '2027-09-15', '1988-07-10', 'B+', 'Jayant Patel', '+91-9876543217', 'BCPPP7089M', 'Axis Bank', '5678901234', 'UTIB0001234', true)
ON CONFLICT (license_number) DO NOTHING;

INSERT INTO routes (route_code, from_location, to_location, distance_km, estimated_hours, is_active)
VALUES
  ('RT001', 'Mumbai', 'Pune', 150.0, 3.5, true),
  ('RT002', 'Bengaluru', 'Hyderabad', 580.0, 9.0, true),
  ('RT003', 'Delhi', 'Agra', 240.0, 4.5, true),
  ('RT004', 'Mumbai', 'Goa', 590.0, 10.0, true),
  ('RT005', 'Pune', 'Aurangabad', 210.0, 4.0, true)
ON CONFLICT (route_code) DO NOTHING;

INSERT INTO vehicles (vehicle_number, vehicle_type, make, model, year, seating_capacity, owner_id, registration_date, insurance_expiry, permit_expiry, fitness_expiry, pollution_expiry, is_owned, is_active)
VALUES
  ('MH02AB1234', 'bus', 'Volvo', 'B11R', 2021, 50, (SELECT id FROM owners_vendors WHERE code = 'OWNER001'), '2021-02-15', '2027-02-14', '2027-03-31', '2027-04-30', '2026-12-31', false, true),
  ('KA01CD5678', 'mini_bus', 'Force', 'Urbania', 2022, 28, (SELECT id FROM owners_vendors WHERE code = 'OWNER002'), '2022-05-20', '2027-05-19', '2027-06-30', '2027-07-31', '2026-11-30', false, true),
  ('MH02EF9012', 'van', 'Mahindra', 'Bolero', 2020, 14, NULL, '2020-08-10', '2026-08-09', '2026-09-30', '2026-10-31', '2026-06-30', true, true)
ON CONFLICT (vehicle_number) DO NOTHING;

INSERT INTO trips (
  trip_number,
  customer_id,
  route_id,
  vehicle_id,
  driver_id,
  trip_date,
  from_location,
  to_location,
  purpose,
  passengers,
  status,
  trip_amount,
  driver_allowance,
  toll_charges,
  parking_charges,
  remarks,
  created_by
)
VALUES
  (
    'TRP0001',
    (SELECT id FROM customers WHERE customer_code = 'CUST001'),
    (SELECT id FROM routes WHERE route_code = 'RT001'),
    (SELECT id FROM vehicles WHERE vehicle_number = 'MH02AB1234'),
    (SELECT id FROM drivers WHERE driver_code = 'DRV001'),
    CURRENT_DATE - INTERVAL '2 day',
    'Mumbai',
    'Pune',
    'Corporate transfer',
    32,
    'completed',
    25000,
    1800,
    900,
    250,
    'Completed on schedule',
    (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')
  ),
  (
    'TRP0002',
    (SELECT id FROM customers WHERE customer_code = 'CUST002'),
    (SELECT id FROM routes WHERE route_code = 'RT002'),
    (SELECT id FROM vehicles WHERE vehicle_number = 'KA01CD5678'),
    (SELECT id FROM drivers WHERE driver_code = 'DRV002'),
    CURRENT_DATE + INTERVAL '1 day',
    'Bengaluru',
    'Hyderabad',
    'Logistics shuttle',
    18,
    'scheduled',
    42000,
    2500,
    0,
    0,
    'Awaiting dispatch',
    (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')
  ),
  (
    'TRP0003',
    (SELECT id FROM customers WHERE customer_code = 'CUST003'),
    (SELECT id FROM routes WHERE route_code = 'RT003'),
    (SELECT id FROM vehicles WHERE vehicle_number = 'MH02EF9012'),
    (SELECT id FROM drivers WHERE driver_code = 'DRV003'),
    CURRENT_DATE - INTERVAL '5 day',
    'Delhi',
    'Agra',
    'Tour package',
    12,
    'completed',
    18000,
    1200,
    350,
    100,
    'Tour concluded successfully',
    (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')
  )
ON CONFLICT (trip_number) DO NOTHING;

INSERT INTO invoices (
  invoice_number,
  invoice_date,
  customer_id,
  billing_address,
  customer_gstin,
  subtotal,
  cgst_amount,
  sgst_amount,
  total_amount,
  payment_status,
  due_date,
  remarks,
  created_by
)
VALUES
  (
    'INV0001',
    CURRENT_DATE - INTERVAL '1 day',
    (SELECT id FROM customers WHERE customer_code = 'CUST001'),
    '123 Main Street, Mumbai',
    '27AABCA1234D1Z0',
    25000,
    625,
    625,
    26250,
    'partial',
    CURRENT_DATE + INTERVAL '14 day',
    'Partial payment received',
    (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')
  ),
  (
    'INV0002',
    CURRENT_DATE - INTERVAL '3 day',
    (SELECT id FROM customers WHERE customer_code = 'CUST003'),
    '789 Tourist Lane, Delhi',
    '07AABCA9101D1Z0',
    18000,
    450,
    450,
    18900,
    'completed',
    CURRENT_DATE + INTERVAL '10 day',
    'Paid in full',
    (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')
  )
ON CONFLICT (invoice_number) DO NOTHING;

INSERT INTO invoice_items (
  invoice_id,
  trip_id,
  description,
  hsn_code,
  quantity,
  rate,
  amount,
  cgst_rate,
  sgst_rate,
  cgst_amount,
  sgst_amount,
  total_amount
)
VALUES
  (
    (SELECT id FROM invoices WHERE invoice_number = 'INV0001'),
    (SELECT id FROM trips WHERE trip_number = 'TRP0001'),
    'Corporate transfer duty',
    '9964',
    1,
    25000,
    25000,
    2.5,
    2.5,
    625,
    625,
    26250
  ),
  (
    (SELECT id FROM invoices WHERE invoice_number = 'INV0002'),
    (SELECT id FROM trips WHERE trip_number = 'TRP0003'),
    'Tour package duty',
    '9964',
    1,
    18000,
    18000,
    2.5,
    2.5,
    450,
    450,
    18900
  )
ON CONFLICT DO NOTHING;

INSERT INTO collections (
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
  (
    'COL0001',
    CURRENT_DATE,
    (SELECT id FROM invoices WHERE invoice_number = 'INV0001'),
    10000,
    'bank_transfer',
    'UTR123456789',
    'ICICI Bank',
    'Advance settlement',
    (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')
  )
ON CONFLICT (collection_number) DO NOTHING;

INSERT INTO driver_settlements (
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
  status,
  remarks,
  created_by
)
VALUES
  (
    'DST0001',
    (SELECT id FROM drivers WHERE driver_code = 'DRV001'),
    CURRENT_DATE - INTERVAL '30 day',
    CURRENT_DATE - INTERVAL '1 day',
    4,
    1260,
    7200,
    1000,
    200,
    6000,
    'upi',
    CURRENT_DATE,
    'paid',
    'Monthly driver settlement',
    (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')
  )
ON CONFLICT (settlement_number) DO NOTHING;

INSERT INTO owner_settlements (
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
  status,
  remarks,
  created_by
)
VALUES
  (
    'OST0001',
    (SELECT id FROM owners_vendors WHERE code = 'OWNER001'),
    (SELECT id FROM vehicles WHERE vehicle_number = 'MH02AB1234'),
    CURRENT_DATE - INTERVAL '30 day',
    CURRENT_DATE - INTERVAL '1 day',
    3,
    900,
    54000,
    5400,
    600,
    48000,
    'bank_transfer',
    CURRENT_DATE,
    'approved',
    'Monthly owner payout',
    (SELECT id FROM profiles WHERE email = 'admin@travelerp.com')
  )
ON CONFLICT (settlement_number) DO NOTHING;
