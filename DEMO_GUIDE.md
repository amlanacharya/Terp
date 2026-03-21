# TravelERP - Happy Path Demo Guide

> A step-by-step walkthrough for demo presenters and business users.
> Estimated time: 10-15 minutes.

---

## Setup

### Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@intelligrip.com | Admin@123456 |
| Fleet Manager | fleet@intelligrip.com | Fleet@123456 |

### Pre-loaded Seed Data

Run the seed script before the demo:

```bash
psql -U <user> -d <db> -f server/db/reset-qa-data.sql   # Clean slate
psql -U <user> -d <db> -f server/db/seed-qa-data.sql     # Load demo data
```

**What's loaded:**
- 3 Customers (Tata Steel, JSPL Corporate, Vedanta Mining)
- 4 Vehicles across 4 categories (CRYSTA, DZIRE, ERTIGA, TRAVELLER 17)
- 2 Owners (Gayatri Travels self-owned + Raj Auto Rentals vendor)
- 4 Drivers with default vehicle assignments
- 3 Rate Charts covering 8+ pricing patterns
- 8 Trips (completed, in-progress, scheduled)
- 3 Annexures for a multi-day outstation trip
- 6 Invoices (trip-linked, annexure-grouped, manual)
- 3 Collections (full payment, partial, UPI)
- 2 Driver Settlements + 1 Owner Settlement
- 3 Leads (converted, new, lost)

---

## Demo Flow

### 1. Dashboard

- Log in as **admin@intelligrip.com**
- Show the dashboard overview with key metrics
- Point out total trips, revenue, outstanding amounts

### 2. Customers

- Navigate to **Customers**
- Show 3 customers in the list
- Click into **Tata Steel Ltd** to show:
  - Contact details, GSTIN (21AABCT1234Q1ZP)
  - Credit limit (5,00,000) and credit days (30)
  - City: Bhubaneswar, State: Odisha

### 3. Vehicles & Categories

- Navigate to **Vehicles**
- Show 4 vehicles mapped to their categories
- Point out the ownership difference:
  - OD02AB1234 (CRYSTA) and OD02CD5678 (DZIRE) -- **Own fleet** (Gayatri Travels)
  - OD02EF9012 (ERTIGA) and OD02GH3456 (TRAVELLER 17) -- **Vendor** (Raj Auto Rentals)

### 4. Rate Charts

- Navigate to **Rate Charts** (under Settings or Customers)
- Open **"Tata Steel - Standard Rates"** -- show multiple package types:
  - CRYSTA 8HR/80KM (base package with extra KM/HR rates)
  - CRYSTA 4HR/40KM (multiple tiers for same vehicle)
  - CRYSTA Outstation Per KM (long trip pricing)
  - DZIRE 8HR/80KM with "whichever is higher" flag
  - DZIRE Fuel Formula (fuel divisor-based calculation)
  - CRYSTA Long Local (KM threshold trigger)
- Open **"Vedanta Mining - Fixed Routes"** -- show fixed route pricing:
  - Jharsuguda to Bhubaneswar: Rs.6,000
  - Jharsuguda to Raipur: Rs.5,000
  - Jharsuguda to Sambalpur: Rs.2,000 (DZIRE)

### 5. Create a New Trip

- Navigate to **Trips**
- Click **New Trip**
- Walk through the creation form:
  1. Select customer: **Tata Steel Ltd** -- rate chart auto-loads
  2. Select vehicle category: **CRYSTA** -- available packages appear
  3. Pick package: **8HR/80KM**
  4. Select vehicle: **OD02AB1234** -- driver auto-fills (Ramesh Sahoo)
  5. Enter date, from/to location
  6. Save -- trip created with status "Scheduled"

### 6. Complete a Trip

- Find **TRP-00008** (scheduled, DZIRE, Bhubaneswar to Cuttack)
- Mark as **In Progress** -- enter start KM and start time
- Then mark as **Completed**:
  - Enter actual KM (e.g., 95 km) and total hours (e.g., 9 hrs)
  - Show how charges are auto-calculated based on the rate chart
  - Base charge: Rs.2,200 + Extra KM + Extra HR

### 7. Generate an Invoice

- From the completed trip, click **Generate Invoice**
- Show the invoice creation:
  - Subtotal auto-calculated from trip charges
  - Tax: CGST 2.5% + SGST 2.5% (intra-state, Odisha to Odisha)
  - Total with tax
- Invoice created with payment status "Pending"

### 8. View Invoices

- Navigate to **Invoices**
- Show the list with different scenarios:
  - **INV-00001**: Trip-linked, fully paid (green status)
  - **INV-00002**: Trip-linked, partially paid (yellow status)
  - **INV-00003**: Annexure-grouped invoice (2 annexures billed together)
  - **INV-00006**: Manual invoice (no trip linked)
- Click the **DS (Duty Slip)** link on any trip-linked invoice -- navigates to the Trips page

### 9. Record a Payment

- Navigate to **Collections**
- Click **New Collection**
- Select invoice: **INV-00002** (partially paid, Rs.4,284 total, Rs.2,000 already paid)
- Enter remaining amount: Rs.2,284
- Select payment mode: **Bank Transfer**
- Enter reference number
- Save -- invoice status updates to "Completed"

### 10. Outstation Trip with Annexures

- Navigate to **Trips**
- Open **TRP-00003** (CRYSTA, Outstation, Bhubaneswar to Rourkela, 3 days)
- Show the **Annexures** section:
  - **AX-001**: Day 1, 150 km, Rs.2,100 -- Billed (linked to INV-00003)
  - **AX-002**: Day 2, 180 km, Rs.2,520 -- Billed (linked to INV-00003)
  - **AX-003**: Day 3, 120 km, Rs.2,680 -- **Unbilled** (available for next invoice)
- Point out: annexures can be billed individually or grouped into a single invoice

### 11. Settlements

- Navigate to **Driver Settlements**
  - **SAL-0001**: Ramesh Sahoo, Mar 1-15, 3 trips, Rs.8,500 -- **Paid**
  - **SAL-0002**: Suresh Mohanty, Mar 1-15, 1 trip, Rs.3,500 -- **Pending**
- Navigate to **Owner Settlements**
  - **VEN-0001**: Raj Auto Rentals, ERTIGA, Mar 1-15, Rs.12,000 -- **Pending**
  - Show deductions: TDS Rs.800, Other Rs.200

### 12. Leads Pipeline

- Navigate to **Leads**
- Show the lead lifecycle:
  - **LEAD0001**: Phone inquiry from Tata Steel -- **Converted** to booking
  - **LEAD0002**: Email inquiry from Nalco Industries -- **New** (follow up needed)
  - **LEAD0003**: Referral from Paradeep Port Trust -- **Lost** (competitor pricing)

---

## Key Talking Points

1. **Smart Rate Engine** -- Handles 8+ pricing patterns automatically:
   - Base package (8HR/80KM), extra KM/HR charges
   - Fuel formula (KM / divisor x fuel price)
   - Fixed route drops (city-to-city flat rates)
   - "Whichever is higher" (KM vs HR comparison)
   - Multiple tiers per vehicle category
   - KM threshold (local becomes long trip)
   - Outstation per-KM with night halts and OT

2. **Multi-day Outstation with Annexures** -- Each day of an outstation trip gets its own annexure with independent KM/hours tracking. Annexures can be billed individually, grouped, or as a whole invoice.

3. **Fixed Route Pricing** -- Regular drops between cities have pre-negotiated flat rates per customer and vehicle category.

4. **Dynamic GST** -- CGST + SGST for intra-state (same state), IGST for inter-state. Tax rates are configurable, not hardcoded.

5. **Full AR Lifecycle** -- Invoice issuance, partial/full collections, payment tracking, and financial ledger entries for complete audit trail.

6. **Driver & Owner Settlements** -- Track driver salaries with allowances, advances, and deductions. Vendor (owner) settlements include TDS calculations.

7. **Lead Management** -- Track inquiries from multiple sources (phone, email, referral, WhatsApp) through the pipeline: new, contacted, quoted, converted, or lost.

8. **Own Fleet vs Vendor Vehicles** -- Distinguish between company-owned vehicles and vendor-supplied vehicles, with separate settlement workflows for each.
