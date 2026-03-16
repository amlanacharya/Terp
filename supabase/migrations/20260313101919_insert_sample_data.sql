/*
  # Insert Sample Data for Travel ERP
  
  This migration inserts sample master data for testing and demonstration.
  
  Sample Data Includes:
  - 3 customers
  - 2 vehicle owners/vendors
  - 3 drivers
  - 3 vehicles
  - 5 routes
*/

-- Insert sample customers
INSERT INTO customers (customer_code, name, contact_person, phone, email, address, city, state, pincode, gstin, credit_limit, credit_days, is_active)
VALUES 
  ('CUST001', 'ABC Travel Company', 'Mr. Rajesh Kumar', '+91-8765432109', 'rajesh@abctravel.com', '123 Main Street', 'Mumbai', 'Maharashtra', '400001', '27AABCA1234D1Z0', 500000, 30, true),
  ('CUST002', 'XYZ Logistics Pvt Ltd', 'Ms. Priya Singh', '+91-8765432108', 'priya@xyzlog.com', '456 Business Park', 'Bangalore', 'Karnataka', '560001', '29AABCA5678D1Z0', 750000, 45, true),
  ('CUST003', 'Metro Tours & Travels', 'Mr. Amit Patel', '+91-8765432107', 'amit@metrotours.com', '789 Tourist Lane', 'Delhi', 'Delhi', '110001', '07AABCA9101D1Z0', 600000, 30, true)
ON CONFLICT (customer_code) DO NOTHING;

-- Insert sample vehicle owners
INSERT INTO owners_vendors (code, name, contact_person, phone, email, address, city, state, pincode, gstin, pan, bank_name, bank_account, ifsc_code, is_active)
VALUES 
  ('OWNER001', 'Prime Fleet Services', 'Mr. Harish Verma', '+91-9123456789', 'harish@primefleet.com', '321 Fleet Street', 'Pune', 'Maharashtra', '411001', '27AABCP1234D1Z0', 'AABCP1234D', 'ICICI Bank', '1234567890123456', 'ICIC0000001', true),
  ('OWNER002', 'Swift Transport Co.', 'Mr. Vikram Singh', '+91-9123456788', 'vikram@swifttrans.com', '654 Highway Road', 'Hyderabad', 'Telangana', '500001', '36AABCT5678D1Z0', 'AABCT5678D', 'HDFC Bank', '9876543210123456', 'HDFC0000001', true)
ON CONFLICT (code) DO NOTHING;

-- Insert sample drivers
INSERT INTO drivers (driver_code, name, phone, email, address, city, state, license_number, license_expiry, date_of_birth, blood_group, emergency_contact, emergency_phone, pan, bank_name, bank_account, ifsc_code, is_active)
VALUES 
  ('DRV001', 'Rohit Kumar', '+91-9876543210', 'rohit@driver.com', '111 Driver Street', 'Mumbai', 'Maharashtra', 'MH01AB1234', '2025-12-31', '1990-05-15', 'O+', 'Ramesh Kumar', '+91-9876543215', 'BCPPR5055K', 'SBI', '1234567890', 'SBIN0001234', true),
  ('DRV002', 'Sunil Sharma', '+91-9876543209', 'sunil@driver.com', '222 Driver Lane', 'Bangalore', 'Karnataka', 'KA01CD5678', '2026-06-30', '1992-03-20', 'AB+', 'Mohan Sharma', '+91-9876543216', 'BCPPS6078L', 'HDFC', '9876543210', 'HDFC0001234', true),
  ('DRV003', 'Amar Patel', '+91-9876543208', 'amar@driver.com', '333 Driver Road', 'Pune', 'Maharashtra', 'MH02EF9012', '2025-09-15', '1988-07-10', 'B+', 'Jayant Patel', '+91-9876543217', 'BCPPP7089M', 'Axis Bank', '5678901234', 'UTIB0001234', true)
ON CONFLICT (license_number) DO NOTHING;

-- Insert sample vehicles
INSERT INTO vehicles (vehicle_number, vehicle_type, make, model, year, seating_capacity, owner_id, registration_date, insurance_expiry, permit_expiry, fitness_expiry, pollution_expiry, is_owned, is_active)
VALUES 
  ('MH02AB1234', 'bus', 'Volvo', 'B11R', 2021, 50, (SELECT id FROM owners_vendors WHERE code = 'OWNER001' LIMIT 1), '2021-02-15', '2026-02-14', '2026-03-31', '2026-04-30', '2025-12-31', false, true),
  ('KA01CD5678', 'mini_bus', 'Force', 'Urbania', 2022, 28, (SELECT id FROM owners_vendors WHERE code = 'OWNER002' LIMIT 1), '2022-05-20', '2026-05-19', '2026-06-30', '2026-07-31', '2025-11-30', false, true),
  ('MH02EF9012', 'van', 'Mahindra', 'Bolero', 2020, 14, NULL, '2020-08-10', '2025-08-09', '2025-09-30', '2025-10-31', '2025-06-30', true, true)
ON CONFLICT (vehicle_number) DO NOTHING;

-- Insert sample routes
INSERT INTO routes (route_code, from_location, to_location, distance_km, estimated_hours, is_active)
VALUES 
  ('RT001', 'Mumbai', 'Pune', 150.0, 3.5, true),
  ('RT002', 'Bangalore', 'Hyderabad', 580.0, 9.0, true),
  ('RT003', 'Delhi', 'Agra', 240.0, 4.5, true),
  ('RT004', 'Mumbai', 'Goa', 590.0, 10.0, true),
  ('RT005', 'Pune', 'Aurangabad', 210.0, 4.0, true)
ON CONFLICT (route_code) DO NOTHING;