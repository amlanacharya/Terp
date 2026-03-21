-- =============================================================================
-- Reset Demo Seed Data - Removes ONLY demo-prefixed records
-- Usage:  psql -U <user> -d <db> -f server/db/reset-qa-data.sql
-- Safe:   Only deletes records with demo codes/numbers. Won't touch real data.
-- =============================================================================

BEGIN;

-- Order matters: delete children before parents (FK constraints)

-- Invoice-related (deepest children first)
DELETE FROM invoice_item_tax_components WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE 'INV-%');
DELETE FROM invoice_tax_components WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE 'INV-%');
DELETE FROM financial_ledger WHERE invoice_number LIKE 'INV-%';
DELETE FROM collections WHERE collection_number LIKE 'GT-RCPT-%';
DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE 'INV-%');
DELETE FROM invoices WHERE invoice_number LIKE 'INV-%';

-- Trip-related
DELETE FROM annexure_metrics WHERE annexure_id IN (SELECT a.id FROM annexures a JOIN trips t ON a.trip_id = t.id WHERE t.trip_number LIKE 'TRP-%');
DELETE FROM annexures WHERE trip_id IN (SELECT id FROM trips WHERE trip_number LIKE 'TRP-%');
DELETE FROM trip_travel_metrics WHERE trip_id IN (SELECT id FROM trips WHERE trip_number LIKE 'TRP-%');
DELETE FROM trip_expenses WHERE trip_id IN (SELECT id FROM trips WHERE trip_number LIKE 'TRP-%');
DELETE FROM trips WHERE trip_number LIKE 'TRP-%';

-- Rate charts
DELETE FROM rate_chart_fixed_routes WHERE rate_chart_id IN (SELECT rc.id FROM rate_charts rc JOIN customers c ON rc.customer_id = c.id WHERE c.customer_code LIKE 'GT-CUST-%');
DELETE FROM rate_chart_items WHERE rate_chart_id IN (SELECT rc.id FROM rate_charts rc JOIN customers c ON rc.customer_id = c.id WHERE c.customer_code LIKE 'GT-CUST-%');
DELETE FROM rate_charts WHERE customer_id IN (SELECT id FROM customers WHERE customer_code LIKE 'GT-CUST-%');

-- Settlements
DELETE FROM driver_settlements WHERE settlement_number LIKE 'SAL-%';
DELETE FROM owner_settlements WHERE settlement_number LIKE 'VEN-%';

-- Leads
DELETE FROM lead_follow_ups WHERE lead_id IN (SELECT id FROM leads WHERE lead_number LIKE 'LEAD%');
DELETE FROM leads WHERE lead_number LIKE 'LEAD%';

-- Vehicle categories (clear ALL FK references before deleting categories)
DELETE FROM rate_chart_fixed_routes WHERE vehicle_category_id IN (SELECT id FROM vehicle_categories WHERE name IN ('CRYSTA','DZIRE','ERTIGA','TRAVELLER 17'));
DELETE FROM rate_chart_items WHERE vehicle_category_id IN (SELECT id FROM vehicle_categories WHERE name IN ('CRYSTA','DZIRE','ERTIGA','TRAVELLER 17'));
UPDATE trips SET vehicle_category_id = NULL WHERE vehicle_category_id IN (SELECT id FROM vehicle_categories WHERE name IN ('CRYSTA','DZIRE','ERTIGA','TRAVELLER 17'));
DELETE FROM vehicle_category_mappings WHERE vehicle_category_id IN (SELECT id FROM vehicle_categories WHERE name IN ('CRYSTA','DZIRE','ERTIGA','TRAVELLER 17'));
DELETE FROM vehicle_category_mappings WHERE vehicle_id IN (SELECT id FROM vehicles WHERE vehicle_number LIKE 'OD02AB%' OR vehicle_number LIKE 'OD02CD%' OR vehicle_number LIKE 'OD02EF%' OR vehicle_number LIKE 'OD02GH%');
DELETE FROM vehicle_categories WHERE name IN ('CRYSTA','DZIRE','ERTIGA','TRAVELLER 17');

-- Vehicles (clear driver default_vehicle_id first)
UPDATE drivers SET default_vehicle_id = NULL WHERE default_vehicle_id IN (SELECT id FROM vehicles WHERE vehicle_number LIKE 'OD02AB%' OR vehicle_number LIKE 'OD02CD%' OR vehicle_number LIKE 'OD02EF%' OR vehicle_number LIKE 'OD02GH%');
DELETE FROM vehicles WHERE vehicle_number LIKE 'OD02AB%' OR vehicle_number LIKE 'OD02CD%' OR vehicle_number LIKE 'OD02EF%' OR vehicle_number LIKE 'OD02GH%';

-- Drivers
DELETE FROM drivers WHERE driver_code LIKE 'GT-DRV-%';

-- Owners
DELETE FROM owners_vendors WHERE code LIKE 'GT-OWN-%';

-- Customers
DELETE FROM customers WHERE customer_code LIKE 'GT-CUST-%';

COMMIT;

-- Verify cleanup
SELECT 'customers' AS tbl, COUNT(*) FROM customers WHERE customer_code LIKE 'GT-CUST-%'
UNION ALL SELECT 'owners', COUNT(*) FROM owners_vendors WHERE code LIKE 'GT-OWN-%'
UNION ALL SELECT 'drivers', COUNT(*) FROM drivers WHERE driver_code LIKE 'GT-DRV-%'
UNION ALL SELECT 'vehicles', COUNT(*) FROM vehicles WHERE vehicle_number LIKE 'OD02AB%' OR vehicle_number LIKE 'OD02CD%' OR vehicle_number LIKE 'OD02EF%' OR vehicle_number LIKE 'OD02GH%'
UNION ALL SELECT 'leads', COUNT(*) FROM leads WHERE lead_number LIKE 'LEAD%'
UNION ALL SELECT 'trips', COUNT(*) FROM trips WHERE trip_number LIKE 'TRP-%'
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices WHERE invoice_number LIKE 'INV-%'
UNION ALL SELECT 'collections', COUNT(*) FROM collections WHERE collection_number LIKE 'GT-RCPT-%'
UNION ALL SELECT 'driver_settlements', COUNT(*) FROM driver_settlements WHERE settlement_number LIKE 'SAL-%'
UNION ALL SELECT 'owner_settlements', COUNT(*) FROM owner_settlements WHERE settlement_number LIKE 'VEN-%'
ORDER BY tbl;
-- All counts should be 0
