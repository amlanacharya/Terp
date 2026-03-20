# TravelERP — Business Requirements Document (BRD)

  

> **Purpose:** This document captures functional requirements for new modules and cross-module

> workflows that TravelERP needs before it can handle real-world travel business scenarios.

> Items marked `[ ] TODO` require BA confirmation with stakeholders before development begins.

>

> **Current state:** 13 working modules (Auth, Dashboard, Trips, Drivers, Vehicles, Customers,

> Owners, Invoices, Collections, Settlements, Reports, Settings, GST) operating largely in silos.

> The system uses PostgreSQL (raw SQL via `pg` driver), Express/Node backend, React frontend.

  

---

  

## Table of Contents

  

1. [Existing System Summary](#1-existing-system-summary)

2. [Lead Capture & CRM](#2-lead-capture--crm)

3. [Bookings (Single & Group)](#3-bookings-single--group)

4. [Multi-Driver Trips](#4-multi-driver-trips)

5. [Driver Document Management](#5-driver-document-management)

6. [Customer Payment Tranches](#6-customer-payment-tranches)

7. [Vendor/Owner Payment Tranches](#7-vendorowner-payment-tranches)

8. [Connected End-to-End Workflows](#8-connected-end-to-end-workflows)

9. [Scenario Walkthroughs](#9-scenario-walkthroughs)

10. [Data Model Changes](#10-data-model-changes)

11. [Open Questions for Stakeholders](#11-open-questions-for-stakeholders)

  

---

  

## 1. Existing System Summary

  

### What's Already Built

  
# Module Status Overview

| Module             | Status | Key Entities / Notes                                                                          |
| ------------------ | ------ | --------------------------------------------------------------------------------------------- |
| Auth & Roles       | Done   | 5 roles: admin, manager, accountant, operator, viewer. JWT auth.                              |
| Dashboard          | Done   | KPI cards, outstanding invoices                                                               |
| Customers          | Done   | customer_code, name, contact, GSTIN, credit_limit, credit_days                                |
| Drivers            | Done   | driver_code, name, phone, license_number, license_expiry, banking                             |
| Vehicles           | Done   | vehicle_number, type (bus/mini_bus/van/car/truck), owner linkage, expiry dates                |
| Owners/Vendors     | Done   | code, name, contact, GSTIN, PAN, banking details                                              |
| Routes             | Done   | route_code, from/to, distance_km, estimated_hours                                             |
| Trips              | Done   | Single customer, single driver, single vehicle per trip. Auto-generates invoice on completion |
| Trip Expenses      | Done   | Per-trip expenses (fuel, toll, parking, etc.)                                                 |
| Invoices           | Done   | Auto-generated on trip completion with GST (intra/inter-state). HSN codes.                    |
| Collections        | Done   | Payment receipts against invoices. Auto-syncs invoice payment_status                          |
| Driver Settlements | Done   | Period-based: total_trips, total_km, allowance, advances, deductions → net_amount             |
| Owner Settlements  | Done   | Period-based: total_trips, total_km, total_amount, TDS, deductions → net_amount               |
| Reports            | Done   | Multiple report types with date range filters                                                 |
| Settings           | Done   | Company info, GSTIN, invoice/trip prefix, financial year, banking                             |
| GST Rates          | Done   | HSN-based rate lookup (CGST/SGST/IGST)                                                        |


  

### Existing Enums

  

# Enum Definitions

| Enum                | Values                                       |
| ------------------- | -------------------------------------------- |
| `user_role`         | admin, manager, accountant, operator, viewer |
| `trip_status`       | scheduled, in_progress, completed, cancelled |
| `payment_status`    | pending, partial, completed, overdue         |
| `payment_mode`      | cash, cheque, bank_transfer, upi, card       |
| `vehicle_type`      | bus, mini_bus, van, car, truck               |
| `settlement_status` | pending, approved, paid                      |

  

### What's Missing (This Document Covers)

  

- No lead/inquiry tracking before trips are created

- No concept of "bookings" — no way to group related trips

- Only 1 driver per trip (no shift/relay/standby support)

- No driver document management beyond license_number/license_expiry

- No payment schedule / tranche support (customer or vendor side)

- Modules are disconnected (no flow from lead → booking → trips → invoice → settlement)

  

---

  

## 2. Lead Capture & CRM

  

### 2.1 Business Context

  

> The company receives inquiries via phone, WhatsApp, email, walk-ins, and referrals.

> These leads must be tracked, followed up on, quoted, and converted into bookings.

> Currently there is no visibility into pre-booking activity.

  

### 2.2 Lead Lifecycle

  

```

New → Contacted → Quoted → Negotiating → Converted (→ Booking) / Lost

                                        ↕

                                      On Hold

```

  

### 2.3 Lead Entity — `leads`

  

# Lead Table Schema

| Field                | Type                | Required    | Description                                            |
| -------------------- | ------------------- | ----------- | ------------------------------------------------------ |
| id                   | uuid PK             | Auto        | `gen_random_uuid()`                                    |
| lead_number          | text UNIQUE         | Auto        | e.g., `LEAD0001` (uses setting `lead_prefix`)          |
| lead_date            | timestamptz         | Yes         | When the inquiry came in                               |
| source               | lead_source enum    | Yes         | See §2.5                                               |
| customer_id          | uuid FK → customers | No          | NULL if new prospect                                   |
| prospect_name        | text                | Conditional | Required when customer_id is NULL                      |
| prospect_phone       | text                | Yes         | Phone number                                           |
| prospect_email       | text                | No          | Email address                                          |
| prospect_company     | text                | No          | Organization name (if corporate)                       |
| trip_type            | text                | Yes         | E.g., "outstation", "local", "airport", "package_tour" |
| from_location        | text                | Yes         | Pickup location                                        |
| to_location          | text                | No          | Drop location (may be multiple stops)                  |
| travel_date          | date                | Yes         | Requested travel date                                  |
| return_date          | date                | No          | For round trips / multi-day                            |
| pax_count            | integer             | Yes         | Number of passengers                                   |
| vehicle_preference   | vehicle_type enum   | No          | Existing enum: bus, mini_bus, van, car, truck          |
| num_vehicles         | integer             | No          | Default 1; > 1 for group requests                      |
| special_requirements | text                | No          | AC, sleeper, luggage space, etc.                       |
| estimated_amount     | numeric(12,2)       | No          | Rough quote given to prospect                          |
| status               | lead_status enum    | Yes         | See §2.5. Default: `new`                               |
| assigned_to          | uuid FK → profiles  | No          | Sales person responsible                               |
| priority             | lead_priority enum  | No          | See §2.5. Default: `medium`                            |
| lost_reason          | text                | No          | Filled when status = `lost`                            |
| converted_booking_id | uuid FK → bookings  | No          | Set when lead converts to a booking                    |
| remarks              | text                | No          | Internal notes                                         |
| created_by           | uuid FK → profiles  | Yes         |                                                        |
| created_at           | timestamptz         | Auto        | `now()`                                                |
| updated_at           | timestamptz         | Auto        | `now()`                                                |

  

### 2.4 Lead Follow-up Log — `lead_follow_ups`

  

# Follow-up Table Schema

| Field          | Type                      | Required | Description                       |
| -------------- | ------------------------- | -------- | --------------------------------- |
| id             | uuid PK                   | Auto     |                                   |
| lead_id        | uuid FK → leads (CASCADE) | Yes      | Parent lead                       |
| follow_up_date | timestamptz               | Yes      | When this follow-up happened      |
| next_follow_up | timestamptz               | No       | Scheduled next contact            |
| contact_mode   | text                      | Yes      | phone, email, whatsapp, in_person |
| summary        | text                      | Yes      | What was discussed                |
| quoted_amount  | numeric(12,2)             | No       | Amount quoted in this interaction |
| created_by     | uuid FK → profiles        | Yes      | Staff who made the contact        |
| created_at     | timestamptz               | Auto     |                                   |

  

### 2.5 New Enums for Leads

  

```

lead_status:    new, contacted, quoted, negotiating, converted, lost, on_hold

lead_source:    walk_in, phone, email, whatsapp, website, referral, repeat_customer, agent, other

lead_priority:  low, medium, high, urgent

```

  

### 2.6 Business Rules — Confirm with Stakeholders

  

- [ ] TODO: Should leads auto-create a customer record on conversion, or must the customer exist first?**AutoCreate if not existing.Phone number primary dedupee..name secondary**

- [ ] TODO: Can a single lead generate multiple bookings (e.g., prospect asks for 3 separate trips)?**Yes**

- [ ] TODO: Is there a maximum number of days a lead can stay in `new` status before auto-escalation? **Prospective Trip time or 1 month as per data entry**

- [ ] TODO: Who can reassign leads? Only admin/manager, or any operator?**All**

- [ ] TODO: Should quotation PDFs be generated from leads, or only after booking creation?**yes from lead stage**

- [ ] TODO: Do agents/referrers get a commission? If yes, what's the structure?**Ad-hoc as per operator entry** **Agent Master needed for bigger fish to make a stipulated %age as per agreement**

- [ ] TODO: Should each follow-up be tracked as a separate log entry, or is a single notes field sufficient?**followup status and datae needed so either append in existing entry or separate log. shoudl be separable each followup niotes**

- [ ] TODO: Do leads come from a website form? If so, should there be an API endpoint for external lead submission?**Not yet..Will keep manual** **scope for bulk upload **

- [ ] TODO: Should the dashboard show a lead funnel (new → contacted → quoted → converted/lost)?**sepaarte leads dashboard in leads page**

- [ ] TODO: Is there a target SLA for follow-ups (e.g., call within 2 hours of new lead)?**customisable needed.**

- [ ] TODO: Do you need WhatsApp integration or is manual entry sufficient for now?"Mnaual for now

  

### 2.7 Key Behaviors

  

1. **Lead → Booking conversion:** When status changes to `converted`, the system creates a

   Booking (§3) and links it via `converted_booking_id`. Customer record is created if needed.

2. **Follow-up reminders:** Dashboard shows overdue follow-ups (where `next_follow_up < now()`).

3. **Duplicate detection:** Warn if a lead is created with the same phone/email as an existing

   open lead within the last 30 days.

4. **Reporting:** Conversion rate = leads converted / total leads (excluding on_hold).

   Also: leads by source, staff-wise performance, lost-lead analysis.

  

### 2.8 Reports Needed

  

- [ ] TODO: Confirm which reports are needed: yes all

  - Lead conversion rate (converted/total by period)

  - Leads by source (which channel brings most business)

  - Follow-up pending list (leads with overdue follow-up dates)

  - Staff-wise lead performance

  - Lost lead analysis (reasons breakdown)

  

---

  

## 3. Bookings (Single & Group)

  

### 3.1 Business Context

  

> A customer may book a single trip (one vehicle, one route). But often, a corporate customer

> books an event like a **company picnic, wedding, or outing** that requires **multiple vehicles

> and multiple trips**. Currently, each trip is independent — there's no way to group them

> under one booking, negotiate a group rate, or track the overall status.

  

### 3.2 Booking vs Trip Relationship

  

```

Booking (1) ──→ (many) Trips

  

   ├── Booking BK0042: "ABC Corp Annual Picnic"

   │     ├── Trip TRP0101: Bus #1, Mumbai → Lonavala, 40 pax

   │     ├── Trip TRP0102: Bus #2, Mumbai → Lonavala, 40 pax

   │     ├── Trip TRP0103: Mini Bus, Mumbai → Lonavala, 15 pax (VIP)

   │     └── Trip TRP0104: Car, Mumbai → Lonavala, 4 pax (Management)

   │

   └── Booking BK0043: "Mr. Sharma One-Way"

         └── Trip TRP0105: Car, Mumbai → Pune, 3 pax

```

  

### 3.3 Booking Entity — `bookings`

  

# Booking Table Schema

| Field                  | Type                | Required | Description                                               |
| ---------------------- | ------------------- | -------- | --------------------------------------------------------- |
| id                     | uuid PK             | Auto     |                                                           |
| booking_number         | text UNIQUE         | Auto     | e.g., `BK0001` (uses setting `booking_prefix`)            |
| booking_date           | date                | Yes      | Date booking was confirmed                                |
| booking_type           | booking_type enum   | Yes      | See §3.5                                                  |
| customer_id            | uuid FK → customers | Yes      |                                                           |
| lead_id                | uuid FK → leads     | No       | Link back to lead (if converted from lead)                |
| contact_person         | text                | No       | On-trip contact (may differ from customer contact_person) |
| contact_phone          | text                | No       |                                                           |
| description            | text                | No       | "Annual Picnic", "Wedding Transport", etc.                |
| from_location          | text                | Yes      | Primary pickup                                            |
| to_location            | text                | No       | Primary destination                                       |
| travel_start_date      | date                | Yes      | When travel begins                                        |
| travel_end_date        | date                | No       | When travel ends (for multi-day)                          |
| pax_count              | integer             | No       | Total passengers across all vehicles                      |
| num_vehicles           | integer             | No       | Number of vehicles needed                                 |
| vehicle_preference     | vehicle_type enum   | No       | Preferred vehicle type                                    |
| special_requirements   | text                | No       | Customer's special instructions                           |
| total_estimated_amount | numeric(12,2)       | No       | Sum of all trip amounts                                   |
| discount_amount        | numeric(12,2)       | No       | Group / negotiated discount                               |
| final_amount           | numeric(12,2)       | No       | total_estimated - discount                                |
| status                 | booking_status enum | Yes      | See §3.5. Default: `draft`                                |
| cancellation_reason    | text                | No       | If cancelled                                              |
| remarks                | text                | No       |                                                           |
| created_by             | uuid FK → profiles  | Yes      |                                                           |
| created_at             | timestamptz         | Auto     |                                                           |
| updated_at             | timestamptz         | Auto     |                                                           |
  

### 3.4 Changes to Existing Tables

  

**`trips` table — new column:**

  

# Trips Table Extension

| Column     | Type               | Notes                                        |
| ---------- | ------------------ | -------------------------------------------- |
| booking_id | uuid FK → bookings | Nullable. Legacy/standalone trips keep NULL. |

  

**`invoices` table — new column:**

  
# Trips Table Extension

| Column     | Type               | Notes                                        |
| ---------- | ------------------ | -------------------------------------------- |
| booking_id | uuid FK → bookings | Nullable. Legacy/standalone trips keep NULL. |

  

### 3.5 New Enums for Bookings

  

```

booking_type:   single, group

booking_status: draft, confirmed, in_progress, completed, cancelled

```

  

### 3.6 Booking-to-Invoice Options

  

```

Option A: One invoice per booking (group invoice)

  Booking BK0042 → Invoice INV0050 (total of all 4 trips)

  

Option B: One invoice per trip (current behavior, booking_id on invoice is NULL)

  Trip TRP0101 → INV0050

  Trip TRP0102 → INV0051

  

Option C: Flexible (user chooses per booking)

```

  

- [ ] TODO: Which invoicing option does the business prefer? (A / B / C)

  

### 3.7 Business Rules — Confirm with Stakeholders

  

- [ ] TODO: When a group booking is created, are all trips created upfront or added over time?**can create upfront as per user needs and later add  or remove as per client demands.**

- [ ] TODO: Can a single booking span multiple days? (e.g., 3-day retreat with different routes each day)**yes**

- [ ] TODO: Should the booking amount be the sum of all trip amounts, or a separate negotiated lump sum?**Included in overall fees by default..checkbox to keep seaprate as per user discretion**

- [ ] TODO: When a booking is cancelled, what happens to in-progress child trips?**Completed charged as it is ,in progress will be charged as per  KMs covered + cancellation fees,pending or not started trips will have only Cancellation fees**

- [ ] TODO: If one trip in a group booking is cancelled, does it affect the overall booking status?**No**

- [ ] TODO: Is there a booking confirmation workflow (draft → manager approval → confirmed)?**No**

- [ ] TODO: Should the system enforce that `num_vehicles` matches the actual number of child trips?**No it could be diffreent dates for same vehicle different groups**

- [ ] TODO: Should discount support percentage-based in addition to flat amount?**Yes**

- [ ] TODO: Should there be a booking confirmation PDF/letter for the customer?**Yes and mail to or send to whatsapp or download option**

- [ ] TODO: Is advance payment mandatory for bookings? What percentage is typical?**10% minimum can be waived by Operator to convert**

- [ ] TODO: Can trips be added to a booking after it's already in progress?**Yes**

- [ ] TODO: Should a `contract` booking type be added for monthly/recurring engagements?**yes**

- [ ] TODO: For contract bookings, how is billing handled? Per trip? Monthly lump sum?**Can be both as per client arrangement**

  

### 3.8 Key Behaviors

  

1. **Group booking creation:** User specifies number of vehicles; system creates N trip shells

   (with booking_id set) that operators then fill in with vehicle/driver assignments.

2. **Booking status roll-up:** Status derives from child trip statuses:

   - All trips scheduled → `confirmed`

   - Any trip in_progress → `in_progress`

   - All trips completed → `completed`

   - All trips cancelled → `cancelled`

3. **Invoice linkage:** Invoices can reference the booking via `invoices.booking_id`.

   Existing `invoice_items.trip_id` still works for per-trip line items.

4. **Backward compatibility:** All existing trip workflows remain unchanged. Booking is additive.

   Trips without a `booking_id` continue to work as standalone trips.

  

---

  

## 4. Multi-Driver Trips

  

### 4.1 Business Context

  

> Currently each trip has exactly one `driver_id`. Real scenarios require multiple drivers:

> - **Night driving** requires rotation (Driver A: 6pm–2am, Driver B: 2am–8am)

> - **Long-distance trips** need 2–3 drivers for safety/legal compliance

> - **Multi-day trips** may have different drivers on different days

> - **Standby drivers** may be pre-assigned as backup

  

### 4.2 Current vs Proposed Model

  

```

CURRENT:  trips.driver_id → 1 driver

  

PROPOSED: trips.driver_id remains (primary driver, backward compatible)

          + trip_driver_assignments table for multi-driver scenarios

```

  

### 4.3 Trip Driver Assignment Entity — `trip_driver_assignments`

  

# Trip Drivers Table Schema

| Field       | Type                      | Required | Description                          |
| ----------- | ------------------------- | -------- | ------------------------------------ |
| id          | uuid PK                   | Auto     |                                      |
| trip_id     | uuid FK → trips (CASCADE) | Yes      | Parent trip                          |
| driver_id   | uuid FK → drivers         | Yes      | Assigned driver                      |
| role        | driver_role enum          | Yes      | See §4.4                             |
| shift_start | timestamptz               | No       | When this driver's shift begins      |
| shift_end   | timestamptz               | No       | When this driver's shift ends        |
| start_km    | numeric(10,2)             | No       | Odometer reading at handover         |
| end_km      | numeric(10,2)             | No       | Odometer reading at handover         |
| allowance   | numeric(10,2)             | No       | This driver's share of allowance     |
| remarks     | text                      | No       | Special instructions for this driver |
| created_at  | timestamptz               | Auto     |                                      |

  

### 4.4 New Enum

  

```

driver_role: primary, relief, standby, backup

```

  

**Definitions:**

- `primary` — Main driver for the trip or shift

- `relief` — Takes over driving duties during the trip (e.g., night relay)

- `standby` — On-call, not necessarily on the vehicle

- `backup` — Pre-assigned replacement if primary is unavailable

  

### 4.5 Interaction with Existing `trips.driver_id`

  

- `trips.driver_id` continues to represent the **primary driver** for backward compatibility.

- When `trip_driver_assignments` records exist for a trip, the UI shows the full driver roster.

- For single-driver trips, no assignment records are needed; `trips.driver_id` suffices.

- When assignments exist, `trips.driver_id` should match the assignment with `role = primary`.

  

### 4.6 Business Rules — Confirm with Stakeholders

  

- [ ] TODO: Must every multi-driver trip have exactly one `primary` at all times, or can there be overlapping primaries during handover?**A driver must be there  fore a trip always**

- [ ] TODO: How are driver allowances calculated for multi-driver trips? (per-km / per-hour / flat per-shift / manual entry)**** manual sometimes, or driver fees divided equally into all concerned drivers by default****

- [ ] TODO: Should the system prevent assigning a driver who is already on another active trip at the same time?**yes**

- [ ] TODO: Do relief/standby drivers appear on the trip sheet / customer-facing documents?**No**

- [ ] TODO: Is driver availability tracking needed (calendar view of who is free)?**yes**

- [ ] TODO: Can the same driver appear on multiple trips on the same day? Should the system warn about conflicts?**Can appear with warnings. User override needed to assign or proceed**

- [ ] TODO: Should there be a maximum driving hours check (e.g., no driver drives > 8 hours continuously)?**Toggle for client.. Safe/Happy Driver button or mode something  like that**

- [ ] TODO: When a trip has 2 drivers, does each get the full trip allowance or is it split?**Split manual entry option needed as well**

  

### 4.7 Impact on Driver Settlements

  

```

CURRENT:  Settlement counts trips WHERE driver_id = this_driver

PROPOSED: Settlement also counts trip_driver_assignments WHERE driver_id = this_driver

          May need to differentiate full-trip vs partial-shift pay

```

  

- [ ] TODO: Define the pay rules for multi-driver trips. Options:

  - Each driver gets full `driver_allowance`

  - Allowance is split proportionally by shift hours **yes**

  - Different rates for primary vs relief drivers

  - Per-assignment `allowance` field is manually set by operator

  

### 4.8 Key Behaviors

  

1. **Conflict detection:** Warn (or block) if a driver is assigned to overlapping trips.

2. **Settlement integration:** `driver_settlements` should aggregate allowances from both

   `trips.driver_allowance` (single-driver) and `trip_driver_assignments.allowance` (multi-driver).

3. **Trip sheet:** Print/PDF shows all assigned drivers with their shift times and roles.

  

---

  

## 5. Driver Document Management

  

### 5.1 Business Context

  

> Currently `drivers` has only `license_number` and `license_expiry`. Real operations need

> to track multiple document types with uploaded copies and expiry alerts. Expired documents

> can mean regulatory fines and safety risks.

  

### 5.2 Existing Driver Fields (No Change)

  

These fields remain on the `drivers` table as quick-reference:

- `license_number` (text)

- `license_expiry` (date)

- `date_of_birth`, `blood_group` (already exist)

- `pan`, `bank_name`, `bank_account`, `ifsc_code` (already exist)

  

### 5.3 Driver Document Entity — `driver_documents`

  

# Driver Documents Table Schema

| Field             | Type                        | Required | Description                                     |
| ----------------- | --------------------------- | -------- | ----------------------------------------------- |
| id                | uuid PK                     | Auto     |                                                 |
| driver_id         | uuid FK → drivers (CASCADE) | Yes      |                                                 |
| document_type     | driver_doc_type enum        | Yes      | See §5.4                                        |
| document_number   | text                        | No       | License number, Aadhar number, etc.             |
| issue_date        | date                        | No       |                                                 |
| expiry_date       | date                        | No       | NULL for non-expiring docs (Aadhar, PAN)        |
| issuing_authority | text                        | No       | E.g., "RTO Mumbai"                              |
| license_type      | license_type enum           | No       | Only for document_type = `driving_license`      |
| file_path         | text                        | No       | Path/URL to uploaded file                       |
| file_name         | text                        | No       | Original filename                               |
| file_size         | integer                     | No       | Bytes                                           |
| is_verified       | boolean                     | No       | Default false. Admin has verified the document. |
| verified_by       | uuid FK → profiles          | No       |                                                 |
| verified_at       | timestamptz                 | No       |                                                 |
| remarks           | text                        | No       |                                                 |
| created_at        | timestamptz                 | Auto     |                                                 |
| updated_at        | timestamptz                 | Auto     |                                                 |

  

### 5.4 New Enums

  

```

driver_doc_type:  driving_license, aadhar, pan_card, police_verification,

                  medical_certificate, photo, address_proof, other

  

license_type:     lmv, hmv, lmv_transport, hmv_transport, other

```

  

### 5.5 Business Rules — Confirm with Stakeholders

  

- [ ] TODO: Which documents are mandatory for onboarding a new driver?**DL& AAdhar**

- [ ] TODO: Should vehicles assigned to a driver be restricted by their license type (e.g., HMV required for bus)?**Higher qualified cna drive lower but LMV  cant drive HMV,subject to human override**

- [ ] TODO: How many days before expiry should alerts start? (Suggest: 30, 15, 7 days)**30**

- [ ] TODO: Should a driver with expired license be automatically blocked from trip assignment?**yes **

- [ ] TODO: Maximum file size for uploads? Accepted file types (PDF, JPG, PNG)?**1mb**

- [ ] TODO: Is document verification a hard requirement before a driver can be assigned to trips?**yes**

- [ ] TODO: Is file upload needed in MVP, or just tracking dates/numbers is sufficient?**optional**

- [ ] TODO: Should vehicle documents (RC, insurance, fitness, permit, pollution) also use this same pattern?**yes Insurance mainly others optional**

- [ ] TODO: Are there RTO/compliance reports needed (e.g., list of drivers with expired licenses)?**no inelegible drivers/vehicles can be  an adhoc**

  

### 5.6 Key Behaviors

  

1. **Expiry dashboard widget:** Show documents expiring in next 30 days on the main dashboard.

2. **Assignment gate:** Optionally block trip assignment if `driving_license` is expired.

3. **Audit:** Document verification creates an `audit_log` entry.

4. **License-vehicle match:** Optionally warn if a driver with LMV license is assigned a bus.

  

---

  

## 6. Customer Payment Tranches

  

### 6.1 Business Context

  

> Customers often pay in installments:

> - 30% advance on booking confirmation

> - 50% before the trip date

> - 20% within 30 days of trip completion

>

> The existing `collections` module records payments against invoices but doesn't track a

> **payment schedule**. There's no way to see "this customer owes ₹2L in tranche 2 which

> was due on March 10."

  

### 6.2 Current Payment Flow (Unchanged)

  

```

Invoice (total_amount) → Collections (each payment recorded) → payment_status auto-synced

```

  

This already works. What's missing is the **schedule/plan** layer.

  

### 6.3 Payment Tranche Entity — `customer_payment_tranches`

  

# Invoice Tranches Table Schema

| Field          | Type                         | Required | Description                                     |
| -------------- | ---------------------------- | -------- | ----------------------------------------------- |
| id             | uuid PK                      | Auto     |                                                 |
| invoice_id     | uuid FK → invoices (CASCADE) | Yes      | Parent invoice                                  |
| tranche_number | integer                      | Yes      | 1, 2, 3… in order                               |
| label          | text                         | No       | "Advance", "Before Trip", "Final Settlement"    |
| due_date       | date                         | Yes      | When this tranche is due                        |
| amount         | numeric(12,2)                | Yes      | Expected amount for this tranche                |
| percentage     | numeric(5,2)                 | No       | % of invoice total (for reference, e.g., 30.00) |
| status         | tranche_status enum          | Yes      | See §6.4. Default: `upcoming`                   |
| collection_id  | uuid FK → collections        | No       | Linked when payment received                    |
| remarks        | text                         | No       |                                                 |
| created_at     | timestamptz                  | Auto     |                                                 |
| updated_at     | timestamptz                  | Auto     |                                                 |

  

### 6.4 New Enum (shared with vendor tranches)

  

```

tranche_status: upcoming, due, overdue, partially_paid, paid, waived

```

  

### 6.5 How Tranches Connect to Existing Collections

  

```

Invoice INV0050 (Total: ₹1,00,000)

  ├── Tranche 1: ₹30,000 due 2026-03-01 (Advance) → PAID (Collection COL0101)

  ├── Tranche 2: ₹50,000 due 2026-03-10 (Before Trip) → OVERDUE

  └── Tranche 3: ₹20,000 due 2026-04-10 (Final) → UPCOMING

  

Collections are still recorded as today. Each collection can optionally

reference which tranche it's paying against.

```

  

- When a `collection` is recorded, the system checks if it matches a tranche amount and auto-links.

- If the amount doesn't match any single tranche, the operator manually assigns it.

- `invoices.payment_status` is derived from tranche statuses:

  - All tranches `paid` → invoice `completed`

  - Some tranches `paid` → invoice `partial`

  - Any tranche `overdue` → invoice `overdue`

  

### 6.6 Changes to Existing Tables

  

**`collections` table — new column:**

  



| Column     | Type                                | Notes                                             |
| ---------- | ----------------------------------- | ------------------------------------------------- |
| tranche_id | uuid FK → customer_payment_tranches | Nullable. Links collection to a specific tranche. |

  

**`system_settings` — new keys:**

  



| Key                              | Default | Description                                           |
| -------------------------------- | ------- | ----------------------------------------------------- |
| `default_customer_tranche_split` | `30,70` | Comma-separated percentages for auto-created tranches |

### 6.7 Business Rules — Confirm with Stakeholders

  

- [ ] TODO: Should tranche templates be configurable per customer (e.g., "Customer X always pays 50-25-25")?**Minimu Transaction value should be 1000rs in tranche**

- [ ] TODO: Can the number of tranches vary? Is there a maximum?**max 10**

- [ ] TODO: Are payment schedules defined at invoice creation or can they be added later?**yes but optional**

- [ ] TODO: Is the schedule always percentage-based (30/50/20) or can it be arbitrary amounts?**arbitrary**

- [ ] TODO: Should the system auto-create a default schedule on invoice creation?**Auto schedule is like whole payment no split but if customer later switches to tranche we should accoomodate that**

- [ ] TODO: When a collection comes in, should the system auto-match to the oldest unpaid tranche?**Cant say but yes logically**

- [ ] TODO: Can a tranche be partially paid, or must each be paid in full?"Tranche pfull

- [ ] TODO: Can a single collection payment be split across multiple tranches?**yes**

- [ ] TODO: What happens if a booking is cancelled after the advance tranche is paid — auto-generate a credit note?**Yes**

- [ ] TODO: Should overdue tranches trigger automated notifications (email/SMS)?**yes**

- [ ] TODO: For group bookings, is the payment schedule per-booking or per-trip?**Trip**

- [ ] TODO: Should the customer outstanding report show tranche-level breakdowns?**history of payments per customer per trip tranche and single wise is good**

  

### 6.8 Key Behaviors

  

1. **Auto-create tranches:** When an invoice is created, apply the default tranche template

   from Settings. Default: 30% advance (due: invoice_date), 70% on completion (due: due_date).

2. **Overdue detection:** On access (or scheduled check), mark tranches as `overdue` when

   `due_date < today AND status IN (upcoming, due)`.

3. **Dashboard widget:** "Collections Due This Week" showing upcoming tranches with amounts.

  

---

  

## 7. Vendor/Owner Payment Tranches

  

### 7.1 Business Context

  

> Just as customers pay in installments, the company pays vehicle owners/vendors in tranches:

> - Advance fuel money before the trip

> - Partial amount after trip completion

> - Final settlement after customer payment is received

>

> Currently, owner settlements are period-based lump sums with no per-payment tracking.

  

### 7.2 Vendor Tranche Entity — `vendor_payment_tranches`

  

# Owner Settlement Tranches Table Schema

| Field            | Type                                  | Required | Description                                           |
| ---------------- | ------------------------------------- | -------- | ----------------------------------------------------- |
| id               | uuid PK                               | Auto     |                                                       |
| settlement_id    | uuid FK → owner_settlements (CASCADE) | Yes      | Parent settlement                                     |
| tranche_number   | integer                               | Yes      | 1, 2, 3…                                              |
| label            | text                                  | No       | "Advance Fuel", "Post-Trip", "Final Settlement"       |
| due_date         | date                                  | Yes      | When this payment is due                              |
| amount           | numeric(12,2)                         | Yes      | Gross amount for this tranche                         |
| tds_amount       | numeric(12,2)                         | No       | TDS deducted on this tranche                          |
| net_amount       | numeric(12,2)                         | No       | amount - tds_amount                                   |
| payment_mode     | payment_mode enum                     | No       | Existing enum: cash, cheque, bank_transfer, upi, card |
| payment_date     | date                                  | No       | Actual payment date                                   |
| reference_number | text                                  | No       | UTR / cheque number                                   |
| status           | tranche_status enum                   | Yes      | Same enum as §6.4                                     |
| remarks          | text                                  | No       |                                                       |
| created_at       | timestamptz                           | Auto     |                                                       |
| updated_at       | timestamptz                           | Auto     |                                                       |

  

### 7.3 Interaction with Existing Settlements

  

- `owner_settlements.status` derives from child tranche statuses (same logic as customer tranches).

- `owner_settlements.payment_date` and `payment_mode` become the values of the **last** tranche paid.

- For single-payment settlements, one tranche is created with 100% of the net amount.

  

### 7.4 Changes to System Settings

  

#### System Settings — New Keys

| Key                            | Default | Description                 |
| ------------------------------ | ------- | --------------------------- |
| `default_vendor_tranche_split` | `100`   | Comma-separated percentages |

  

### 7.5 Business Rules — Confirm with Stakeholders

  

- [ ] TODO: Is TDS deducted per tranche or once on the total settlement amount?**per tranche if user chooses default is one tim,e post settllemnt**

- [ ] TODO: Do vendors have contracted payment schedules (e.g., "pay within 7 days of trip completion")?**can be there**

- [ ] TODO: Should vendor tranches link to specific trips within the settlement period?**Option to link can be there else no need**

- [ ] TODO: Can vendor payments be made in advance (before trip completion)?**yes**

- [ ] TODO: Are vendor payments tied to settlements, or can there be ad-hoc payments?**adhoc cash flow depenedent**

- [ ] TODO: Should the system track vendor advances separately (fuel advance given before trip)?**yes for eg pertrol worth 800 in tank can be considered as advance from venddor (so added to myy invoice+ fuel,i can also while giving back deduct remaining fuel if any**

- [ ] TODO: Do vendors raise their own invoices? If so, should we track vendor invoice numbers?can be used as a refernce,optional venfdor inv uploadsed.

- [ ] TODO: Should there be a vendor ledger showing all payments over time?yes

- [ ] TODO: Should vendor payment be blocked until customer pays?no

- [ ] TODO: For driver payments, is the same tranche model needed or are drivers always paid in a single settlement?**drivers payments to be treated as gig worker payments style ,,more adhoc but need to track advance,food ,their toll expenses if paid by them and so on**

  

---

  

## 8. Connected End-to-End Workflows

  

### 8.1 Current Gaps

  

Today's modules work independently:

- Trips don't originate from tracked leads

- No booking layer groups related trips

- Invoices auto-generate on trip completion but lack payment schedules

- Settlements don't account for multi-driver scenarios

- No connection from lead inquiry to final settlement

  

### 8.2 Target Workflow

  

```

Lead (inquiry)

  ↓ convert

Booking (confirmed)

  ↓ create trips

Trip(s) (scheduled → in_progress → completed)

  ↓ each trip can have driver assignments

  ↓ auto-generate invoice on completion

Invoice (with payment tranches)

  ↓ collect payments per tranche

Collections (linked to tranches)

  ↓ settlement period closes

Driver Settlement (aggregated from trip assignments)

Owner Settlement (with vendor payment tranches)

```

  

### 8.3 Cross-Module Linking Summary

  

# Relational Links Across Modules

| From                      | To                        | Link Column                             |
| ------------------------- | ------------------------- | --------------------------------------- |
| leads                     | bookings                  | `leads.converted_booking_id`            |
| leads                     | customers                 | `leads.customer_id`                     |
| bookings                  | trips                     | `trips.booking_id` (new)                |
| bookings                  | invoices                  | `invoices.booking_id` (new)             |
| trips                     | trip_driver_assignments   | `trip_driver_assignments.trip_id`       |
| drivers                   | driver_documents          | `driver_documents.driver_id`            |
| invoices                  | customer_payment_tranches | `customer_payment_tranches.invoice_id`  |
| invoices                  | collections               | `collections.invoice_id` (existing)     |
| customer_payment_tranches | collections               | `collections.tranche_id` (new)          |
| owner_settlements         | vendor_payment_tranches   | `vendor_payment_tranches.settlement_id` |

  

### 8.4 Status Propagation Rules

  

1. **Booking status** derives from child trip statuses (see §3.8).

2. **Invoice payment_status** derives from customer tranche statuses (see §6.5).

3. **Owner settlement status** derives from vendor tranche statuses (see §7.3).

4. **Lead status** set to `converted` when a booking is created from it.

  

### 8.5 Workflows to Confirm

  

- [ ] TODO: When a lead is marked "converted," should the system auto-create the booking, or should the operator manually create it?**yes**

- [ ] TODO: For group bookings, should there be a "booking dashboard" showing all trips in one view?**yes**

- [ ] TODO: Can a booking be partially cancelled? (e.g., 3 of 4 trips cancelled, 1 remains)**yes**

- [ ] TODO: Should the system calculate profitability per booking? (invoiced - expenses - driver pay - vendor pay)**nice to have**

- [ ] TODO: For contracts, is a separate contract management module needed, or is a recurring booking sufficient?**just a recurring booking suffiecient**

- [ ] TODO: Should completed bookings be archived or always visible?**pagination ultimately..visible alawys stack logic..latest on ttop**

- [ ] TODO: Should there be notifications/alerts at key workflow steps (email/SMS/dashboard)?"nice to have

- [ ] TODO: What user roles can perform each new action? (RBAC matrix needed)**Financial entries of payment incoming outgoing neede  maker checker..rest Operators can update,Invoice deletion,Payment deletion need maker checker and approval proof**

- [ ] TODO: Should audit_log cover all new entities, or only financial ones?**For now financial ones, separate  nice to have rest**

  

---

  

## 9. Scenario Walkthroughs

  

### Scenario 1: Simple Single Trip

  

> A customer calls for a car from Mumbai to Pune tomorrow.

  

1. **Lead:** Operator creates lead LEAD0042 — source: phone, vehicle_preference: car, pax: 4.

2. **Follow-up:** Customer confirms rate ₹3,500. Operator records quotation in follow-up log.

3. **Convert:** Lead → Booking BK0089 (type: single). Customer CUST003 linked.

   Lead status: `converted`, `converted_booking_id` = BK0089.

4. **Trip:** System creates trip TRP0156 under BK0089. Operator assigns vehicle MH-01-AB-1234,

   driver DRV001. Trip status: `scheduled`.

5. **Trip completes:** Status → `completed`. Invoice INV0078 auto-generated (₹3,500 + 5% GST = ₹3,675).

   Two tranches created: ₹1,103 advance (due today), ₹2,573 within 15 days.

6. **Collection:** Customer pays ₹1,103 cash → tranche 1 marked `paid`. Invoice: `partial`.

7. **Collection:** Customer transfers ₹2,573 → tranche 2 marked `paid` → invoice `completed`.

8. **Settlement:** End of month, driver DRV001's settlement includes allowance from TRP0156.

  

### Scenario 2: Group Corporate Outing

  

> ABC Corp books 3 buses for a team outing, 60 employees, Mumbai → Lonavala, 2 days.

  

1. **Lead:** LEAD0043 — source: email, prospect_company: "ABC Corp", pax: 60, num_vehicles: 3.

2. **Quotation:** ₹45,000 per bus × 3 = ₹1,35,000. Discount ₹5,000 for group. Final: ₹1,30,000.

3. **Convert:** Lead → Booking BK0090 (type: group), customer: CUST001 (ABC Corp).

   `total_estimated_amount`: 1,35,000. `discount_amount`: 5,000. `final_amount`: 1,30,000.

4. **Trips:** 3 trip shells created, each linked to BK0090:

   - TRP0157: Bus MH-04-CD-5678, Driver DRV001, 20 pax, ₹45,000

   - TRP0158: Bus MH-04-EF-9012, Driver DRV002, 20 pax, ₹45,000

   - TRP0159: Bus MH-04-GH-3456, Driver DRV003, 20 pax, ₹45,000

5. **Invoice:** One consolidated invoice INV0079 for booking BK0090, total ₹1,30,000 + GST.

   Tranches: 50% advance (₹68,250 due on booking), 50% after trip (₹68,250 due trip_date + 7).

6. **All 3 trips complete** → Booking status: `completed`.

7. **Collections recorded against tranches** → Invoice `completed`.

8. **Settlements:** Each driver's monthly settlement includes their trip's allowance.

   Owner settlements for hired buses include vendor tranches with TDS.

  

### Scenario 3: Night Relay — Multi-Driver Long Distance

  

> Customer books a bus from Mumbai to Goa (overnight, ~12 hours).

  

1. **Booking:** BK0091, type: single, 1 bus.

2. **Trip:** TRP0160 — bus assigned, trip_date covers overnight.

3. **Driver assignments** (trip_driver_assignments):

   - DRV001: role=`primary`, shift 6:00 PM – 12:00 AM, start_km=45000, end_km=45280

   - DRV002: role=`relief`, shift 12:00 AM – 6:00 AM, start_km=45280, end_km=45560

4. **Allowances:** DRV001: ₹800, DRV002: ₹1,000 (night premium).

5. `trips.driver_id` = DRV001 (primary). `trip_driver_assignments` has both records.

6. **Trip sheet PDF** shows both drivers with shift times and roles.

7. **Trip completes** → Invoice generated, tranches created.

8. **Settlement:** DRV001's monthly settlement includes ₹800 from this trip.

   DRV002's settlement includes ₹1,000.

  

### Scenario 4: Monthly Contract with Recurring Trips

  

> Customer has a monthly contract: 1 car, Mon–Sat, local use, ₹25,000/month.

  

1. **Lead:** LEAD0044, trip_type: "monthly contract".

2. **Booking:** BK0092, type: single (or future `contract` type — see Open Questions).

   `final_amount`: ₹25,000.

3. **Trips:** 26 trips created (one per working day), all with `booking_id` = BK0092.

4. **Driver:** Same driver DRV001 assigned to all 26 trips. Single-driver, no assignments needed.

5. **Vehicle:** Same car assigned to all trips.

6. **Invoice:** Monthly invoice INV0080 for ₹25,000 + GST.

   Tranches: 100% due by 5th of next month.

7. **Settlement:** Driver's monthly settlement aggregates all 26 trips.

  

---

  

## 10. Data Model Changes

  

### 10.1 New Tables (7)

  
# Core Tables Overview

| #   | Table                       | Purpose                              |
| --- | --------------------------- | ------------------------------------ |
| 1   | `leads`                     | Lead/inquiry tracking                |
| 2   | `lead_follow_ups`           | Follow-up history per lead           |
| 3   | `bookings`                  | Parent entity above trips            |
| 4   | `trip_driver_assignments`   | Multi-driver support per trip        |
| 5   | `driver_documents`          | Document uploads and expiry tracking |
| 6   | `customer_payment_tranches` | Installment schedule on invoices     |
| 7   | `vendor_payment_tranches`   | Installment payments to owners       |

  

### 10.2 Modified Tables (4)

  
#### Trips Table — Change

| #   | Table   | Change                                          |     |
| --- | ------- | ----------------------------------------------- | --- |
| 1   | `trips` | Add `booking_id` (uuid FK → bookings, nullable) |     |
  # Invoices Table — Change

| #   | Table      | Change                                          |
| --- | ---------- | ----------------------------------------------- |
| 2   | `invoices` | Add `booking_id` (uuid FK → bookings, nullable) |
#### Collections Table — Change

| #   | Table         | Change                                                           |
| --- | ------------- | ---------------------------------------------------------------- |
| 3   | `collections` | Add `tranche_id` (uuid FK → customer_payment_tranches, nullable) |

#### System Settings — Change

| #   | Table             | Change                                                                                                      |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| 4   | `system_settings` | Add keys: `default_customer_tranche_split`, `default_vendor_tranche_split`, `booking_prefix`, `lead_prefix` |
### 10.3 New Enums (9)
# Enums Reference

| #   | Enum              | Values                                                                                                   |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | `lead_status`     | new, contacted, quoted, negotiating, converted, lost, on_hold                                            |
| 2   | `lead_source`     | walk_in, phone, email, whatsapp, website, referral, repeat_customer, agent, other                        |
| 3   | `lead_priority`   | low, medium, high, urgent                                                                                |
| 4   | `booking_type`    | single, group                                                                                            |
| 5   | `booking_status`  | draft, confirmed, in_progress, completed, cancelled                                                      |
| 6   | `driver_role`     | primary, relief, standby, backup                                                                         |
| 7   | `driver_doc_type` | driving_license, aadhar, pan_card, police_verification, medical_certificate, photo, address_proof, other |
| 8   | `license_type`    | lmv, hmv, lmv_transport, hmv_transport, other                                                            |
| 9   | `tranche_status`  | upcoming, due, overdue, partially_paid, paid, waived                                                     |

  

### 10.4 Recommended Indexes

  

```sql

-- Leads

CREATE INDEX idx_leads_customer     ON leads(customer_id);

CREATE INDEX idx_leads_status       ON leads(status);

CREATE INDEX idx_leads_assigned     ON leads(assigned_to);

CREATE INDEX idx_leads_date         ON leads(lead_date);

CREATE INDEX idx_follow_ups_lead    ON lead_follow_ups(lead_id);

  

-- Bookings

CREATE INDEX idx_bookings_customer  ON bookings(customer_id);

CREATE INDEX idx_bookings_status    ON bookings(status);

CREATE INDEX idx_trips_booking      ON trips(booking_id);

CREATE INDEX idx_invoices_booking   ON invoices(booking_id);

  

-- Multi-driver

CREATE INDEX idx_trip_drivers_trip   ON trip_driver_assignments(trip_id);

CREATE INDEX idx_trip_drivers_driver ON trip_driver_assignments(driver_id);

  

-- Driver documents

CREATE INDEX idx_driver_docs_driver ON driver_documents(driver_id);

CREATE INDEX idx_driver_docs_expiry ON driver_documents(expiry_date);

  

-- Tranches

CREATE INDEX idx_cust_tranches_invoice ON customer_payment_tranches(invoice_id);

CREATE INDEX idx_cust_tranches_status  ON customer_payment_tranches(status);

CREATE INDEX idx_vend_tranches_settle  ON vendor_payment_tranches(settlement_id);

CREATE INDEX idx_collections_tranche   ON collections(tranche_id);

```

  

---

  

## 11. Open Questions for Stakeholders

  

Priority: **H** = blocks development, **M** = affects scope, **L** = can defer.

  

### Priority H — Must Decide Before Development

  

# Open Decisions

| # | Area         | Question                                                                 | Decision      |
|---|--------------|--------------------------------------------------------------------------|---------------|
| 1 | Leads        | Should leads auto-create customer records on conversion, or must customer exist first? | ___________   |
| 2 | Bookings     | Can a group booking have a single consolidated invoice, or must each trip be invoiced separately? | ___________   |
| 3 | Bookings     | When a booking is cancelled, what happens to in-progress child trips?     | ___________   |
| 4 | Tranches     | Can a tranche be partially paid, or must each be paid in full?            | ___________   |
| 5 | Tranches     | What is the default tranche split? (e.g., 30-70, 50-50, 100%)             | ___________   |
| 6 | Multi-Driver | How are driver allowances calculated for multi-driver trips? (per-km / per-hour / flat / manual) | ___________   |
| 7 | Vendor       | Is TDS deducted per tranche payment or once on the total settlement amount? | ___________   |
| 8 | Bookings     | Is manager approval required for booking confirmation (draft → confirmed)? | ___________   |

  

### Priority M — Affects Scope

  

# Open Decisions (Extended)

| #  | Area         | Question                                                                 | Decision      |
|----|--------------|--------------------------------------------------------------------------|---------------|
| 9  | Leads        | Can one lead generate multiple bookings?                                 | ___________   |
| 10 | Leads        | Should quotation PDFs be generated from leads?                           | ___________   |
| 11 | Leads        | Do agents/referrers earn commission? What structure?                     | ___________   |
| 12 | Bookings     | Should `num_vehicles` be enforced to match actual child trip count?      | ___________   |
| 13 | Bookings     | Should a `contract` booking type be added for monthly/recurring?         | ___________   |
| 14 | Multi-Driver | Block or warn when assigning a driver already on another active trip?    | ___________   |
| 15 | Multi-Driver | Do relief/standby drivers appear on customer-facing trip sheets?         | ___________   |
| 16 | Documents    | Should expired license automatically block trip assignment?              | ___________   |
| 17 | Documents    | How many days before expiry should alerts trigger? (30/15/7?)            | ___________   |
| 18 | Tranches     | Should overdue tranches trigger automated notifications? What channel?   | ___________   |
| 19 | Tranches     | For group bookings, is the payment schedule per-booking or per-trip?     | ___________   |
| 20 | Vendor       | Should vendor payment be linked to customer payment receipt?             | ___________   |
| 21 | Workflow     | Should the system calculate profitability per booking?                   | ___________   |
| 22 | General      | What user roles can perform each new action? (RBAC matrix needed)        | ___________   |

  

### Priority L — Can Defer

  

# Open Decisions (Extended)

| #  | Area         | Question                                                                 | Decision      |
|----|--------------|--------------------------------------------------------------------------|---------------|
| 23 | Leads        | Auto-escalation for leads stuck in `new` status? After how many days?     | ___________   |
| 24 | Leads        | Lead reassignment permissions — admin/manager only, or any operator?     | ___________   |
| 25 | Bookings     | Should discount support percentage-based in addition to flat amount?     | ___________   |
| 26 | Tranches     | Should tranche templates be configurable per customer?                   | ___________   |
| 27 | Tranches     | Credit note auto-generation on cancellation after advance payment?       | ___________   |
| 28 | Documents    | Max upload file size and accepted file types?                            | ___________   |
| 29 | Documents    | Is document verification required before trip assignment?                | ___________   |
| 30 | Multi-Driver | Is driver availability calendar view needed?                             | ___________   |
| 31 | Vendor       | Can vendor payments be made in advance of trip completion?               | ___________   |
| 32 | Vendor       | Should vendor tranches link to specific trips within a settlement?       | ___________   |
| 33 | Vendor       | Do vendors raise their own invoices? Track vendor invoice numbers?       | ___________   |
| 34 | General      | Should audit_log cover all new entities, or only financial ones?         | ___________   |
| 35 | General      | Should completed bookings be archived or always visible?                 | ___________   |
| 36 | Future       | Dynamic pricing / rate cards per route/vehicle type?                     | ___________   |
| 37 | Future       | GPS/live tracking integration?                                           | ___________   |
| 38 | Future       | Mobile app for drivers (trip acceptance, expense logging)?               | ___________   |
| 39 | Future       | Customer feedback/rating after trip?                                     | ___________   |
| 40 | Future       | Integration with accounting software (Tally, Zoho)?                      | ___________   |

  

---

  

## Appendix A: Existing Schema Reference

  

Current database tables (see `server/db/schema.sql` for full DDL):

  

`profiles`, `customers`, `owners_vendors`, `drivers`, `routes`, `vehicles`,

`trips`, `trip_expenses`, `invoices`, `invoice_items`, `collections`,

`gst_rates`, `driver_settlements`, `owner_settlements`, `audit_log`, `system_settings`

  

Existing enums: `user_role`, `trip_status`, `payment_status`, `payment_mode`,

`vehicle_type`, `settlement_status`

  

---

  

> **Instructions for BA:**

> 1. Walk through each module section (§2–§7) with stakeholders

> 2. Fill in all `[ ] TODO` checkboxes — confirm, reject, or modify each rule

> 3. Fill in the Decision column for all 40 open questions in §11

> 4. Add any new scenarios discovered during gathering to §9

> 5. Mark priorities (must-have vs nice-to-have) for each feature within modules

> 6. Return the filled document for development planning (database migrations + implementation phases)