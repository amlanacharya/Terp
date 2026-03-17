# Gayatri Travels — Automated Test Results

**Project:** TravelERP — GT Customization

**Branch:** GT

**Run date:** 2026-03-17

**Test runner:** Vitest v4.1.0

**Test suite summary:** 87 tests across 3 test files — all passing

---

## Overview

| Phase   | Scope                                               | Test File                | Tests | Result                                           |
| ------- | --------------------------------------------------- | ------------------------ | ----- | ------------------------------------------------ |
| Phase 1 | DB schema, leads, basic trip CRUD                   | —                        | —     | No unit tests (CRUD coverage via manual testing) |
| Phase 2 | Rate engine — chart resolution, pricing patterns    | `rate-engine.test.ts`    | 23    | ✅ All pass                                       |
| Phase 3 | Travel metric aggregation — duty-slip segment logic | `trip-metrics.test.ts`   | 30    | ✅ All pass                                       |
| Phase 4 | GT invoice helpers — GST routing, night halts       | `invoice-gt.test.ts`     | 32    | ✅ All pass                                       |

---

## Phase 1 — Base Setup

Phase 1 established the core DB schema (customers, vehicles, drivers, routes, trips, leads) and basic CRUD endpoints. No automated unit tests were written for Phase 1; correctness was validated manually through the UI and API during setup.

---

## Phase 2 — Rate Engine (`rate-engine.test.ts`)

**Module:** `server/src/utils/rate-engine.ts`

**Fixtures:** `server/src/utils/rate-engine.fixtures.ts`

**Total:** 23 tests — ✅ 23 passed

### Fixture 1 — RBI: 8Hr/80KM base package with use-higher-of KM/HR

**Pattern:** Base package `8Hr/80KM = Rs.3000`, extra KM `Rs.18/km`, extra HR `Rs.180/hr`, `use_higher_of_km_hr = true`. Two packages (8HR80KM, 4HR40KM).

| # | Test Case                                                                          | Inputs                       | Expected                                     | Result |
| - | ---------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------- | ------ |
| 1 | Returns base charge when within package limits                                     | 60 km, 6 hr                  | base=3000, extras=0, final=3000              | ✅ Pass |
| 2 | Applies extra KM charge when KM exceeds base and KM wins higher-of                 | 110 km, 10 hr                | extra_km=540 (30×18), extra_hr=0, final=3540 | ✅ Pass |
| 3 | Applies extra HR charge when HR exceeds base and HR wins higher-of                 | 82 km, 11 hr                 | extra_hr=540 (3×180), extra_km=0, final=3540 | ✅ Pass |
| 4 | Selects 4Hr/40KM package when explicitly requested                                 | 30 km, 3 hr, package=4HR40KM | base=2000, final=2000                        | ✅ Pass |
| 5 | Throws PACKAGE_SELECTION_REQUIRED when no package_code and multiple packages exist | no package_code              | RateEngineError thrown                       | ✅ Pass |

### Fixture 2 — TSM: Fuel formula + fixed drop routes

**Pattern:** Fuel formula `KM/10 × Rs.102.15`, fixed route `TSM→BBSR = Rs.4000` for `drop_pickup`.

| # | Test Case                                            | Inputs                         | Expected                                           | Result |
| - | ---------------------------------------------------- | ------------------------------ | -------------------------------------------------- | ------ |
| 6 | Applies fuel formula for local duty                  | 100 km, local                  | fuel=1021.50, final=1021.50                        | ✅ Pass |
| 7 | Returns fixed amount for TSM→BBSR drop_pickup route  | from=TSM, to=BBSR, drop_pickup | fixed=4000, final=4000, applied_fixed_route_id set | ✅ Pass |
| 8 | Fixed route match is case and whitespace insensitive | from='  tsm  ', to=' bbsr '    | fixed=4000                                         | ✅ Pass |
| 9 | Does not match fixed route for wrong duty type       | local + TSM→BBSR               | applied_fixed_route_id=null, fuel_charge>0         | ✅ Pass |

### Fixture 3 — UNIT-4: Fuel formula per vehicle category

**Pattern:** Two vehicle categories (4AIR BAG at divisor 12, 6AIR BAG at divisor 10), fuel-only pricing.

| #  | Test Case                                                    | Inputs                            | Expected                     | Result |
| -- | ------------------------------------------------------------ | --------------------------------- | ---------------------------- | ------ |
| 10 | Calculates fuel for 4AIR BAG at divisor 12                   | 120 km, 4AIR BAG                  | fuel=1021.50 (120/12×102.15) | ✅ Pass |
| 11 | Calculates fuel for 6AIR BAG at divisor 10                   | 120 km, 6AIR BAG                  | fuel=1225.80 (120/10×102.15) | ✅ Pass |
| 12 | Throws RATE_ITEM_NOT_FOUND when using wrong vehicle category | CRYSTA (not configured for UNIT4) | RateEngineError thrown       | ✅ Pass |

### Fixture 4 — NTPC: Local-to-long threshold at 250 KM

**Pattern:** Local `8Hr/80KM`, `long_km_threshold=250`. Above threshold upgrades to long per-km rate `Rs.22/km`.

| #  | Test Case                                              | Inputs        | Expected                                                       | Result |
| -- | ------------------------------------------------------ | ------------- | -------------------------------------------------------------- | ------ |
| 13 | Uses local package pricing when KM is within threshold | 200 km, local | applied=local, base=2800, extra_km=1920                        | ✅ Pass |
| 14 | Upgrades to long pricing when KM exceeds 250 threshold | 300 km, local | applied=long, base=6600 (300×22), warning contains "threshold" | ✅ Pass |
| 15 | Threshold is exclusive — exactly 250 KM stays local    | 250 km, local | applied=local                                                  | ✅ Pass |

### Fixture 5 — IFFCO: 10Hr/80KM with no_km_limit_cap and outstation

**Pattern:** Local `10Hr/80KM = Rs.3200`, outstation per-km `Rs.25`, night halt `Rs.500`, OT `Rs.200/hr` above `long_day_hours=10`, `no_km_limit_cap_km=450`.

| #  | Test Case                                                     | Inputs                 | Expected                                       | Result |
| -- | ------------------------------------------------------------- | ---------------------- | ---------------------------------------------- | ------ |
| 16 | Calculates local trip within limits                           | 60 km, 8 hr            | base=3200, extras=0, final=3200                | ✅ Pass |
| 17 | Charges extra KM beyond 80 KM base                            | 130 km, 8 hr           | extra_km=1000 (50×20), final=4200              | ✅ Pass |
| 18 | Issues a warning for no_km_limit_cap_km field                 | 400 km                 | warning contains "cap"                         | ✅ Pass |
| 19 | Calculates outstation trip with per-km rate and night halts   | 400 km, 8 hr, 2 halts  | base=10000, night_halt=1000, ot=0, final=11000 | ✅ Pass |
| 20 | Adds OT charge when hours exceed long_day_hours on outstation | 200 km, 12 hr, 0 halts | ot=400 (2×200), final=5400                     | ✅ Pass |

### Cross-cutting edge cases

| #  | Test Case                                             | Inputs                     | Expected                                                | Result |
| -- | ----------------------------------------------------- | -------------------------- | ------------------------------------------------------- | ------ |
| 21 | Returns zero extras for all-zero trip inputs          | 0 km, 0 hr                 | extra_km=0, extra_hr=0, final=3000 (base still charged) | ✅ Pass |
| 22 | Throws RATE_ITEM_NOT_FOUND for unconfigured duty type | RBI chart, outstation duty | RateEngineError thrown                                  | ✅ Pass |
| 23 | Fuel charge rounds to 2 decimal places                | 1 km, TSM fuel formula     | fuel=10.22 (1/10×102.15=10.215→rounds up)               | ✅ Pass |

---

## Phase 3 — Travel Metric Aggregation (`trip-metrics.test.ts`)

**Module:** `server/src/utils/trip-metrics.ts`

**Fixtures:** `server/src/utils/trip-metrics.fixtures.ts`

**Total:** 30 tests — ✅ 30 passed

### Fixture 1 — Single complete row: local duty (8Hr)

**Pattern:** One row, odometer 100→175, 08:00→16:00. Validates baseline segment calculation and compatibility snapshot derivation.

| # | Test Case                                                 | Inputs                               | Expected                                                                               | Result |
| - | --------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- | ------ |
| 1 | Returns correct segment_km and segment_hours              | 08:00→16:00, km 100→175              | segment_km=75, segment_hours=8, is_complete=true                                       | ✅ Pass |
| 2 | Sums to total_km and total_hours from the single segment  | same                                 | total_km=75, total_hours=8                                                             | ✅ Pass |
| 3 | Populates compatibility snapshot fields                   | same                                 | start_km=100, end_km=175, start_time=2025-06-01T08:00:00, end_time=2025-06-01T16:00:00 | ✅ Pass |
| 4 | Reports no incomplete rows                                | same                                 | has_incomplete_rows=false                                                              | ✅ Pass |
| 5 | Normalizes HH:MM times to HH:MM:SS in the returned metric | start_time='08:00', end_time='16:00' | start_time='08:00:00', end_time='16:00:00'                                             | ✅ Pass |

### Fixture 2 — Two complete rows: outstation 2-day duty slip

**Pattern:** Day 1 (12000→12180 km, 08:00→20:00 = 180 km, 12 hr) + Day 2 (12180→12380 km, 09:00→17:30 = 200 km, 8.5 hr). Validates per-row sum aggregation per spec §3.

| #  | Test Case                                                              | Inputs                                 | Expected                                       | Result |
| -- | ---------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------- | ------ |
| 6  | Sums segment_km across both rows, not last_end_km minus first_start_km | seq1: 180 km, seq2: 200 km             | total_km=380 (180+200)                         | ✅ Pass |
| 7  | Sums segment_hours across both rows                                    | seq1: 12 hr, seq2: 8.5 hr              | total_hours=20.5 (12+8.5)                      | ✅ Pass |
| 8  | start_km and start_time come from seq=1 row (first after sort)         | seq1 starts at 12000, 2025-06-01 08:00 | start_km=12000, start_time=2025-06-01T08:00:00 | ✅ Pass |
| 9  | end_km and end_time come from last completed segment row               | seq2 ends at 12380, 2025-06-02 17:30   | end_km=12380, end_time=2025-06-02T17:30:00     | ✅ Pass |
| 10 | Reports no incomplete rows                                             | both rows complete                     | has_incomplete_rows=false                      | ✅ Pass |

### Fixture 3 — In-progress duty slip (one open row)

**Pattern:** seq=1 complete (200→260 km, 08:00→12:00 = 60 km, 4 hr), seq=2 open (started at 12:30, no end fields). Validates partial aggregation and open-row handling.

| #  | Test Case                                                            | Inputs                          | Expected                                     | Result |
| -- | -------------------------------------------------------------------- | ------------------------------- | -------------------------------------------- | ------ |
| 11 | Reports has_incomplete_rows when any row lacks end fields            | seq=2 has no end fields         | has_incomplete_rows=true                     | ✅ Pass |
| 12 | Open row has null segment_km and segment_hours                       | seq=2 incomplete                | segment_km=null, segment_hours=null          | ✅ Pass |
| 13 | total_km and total_hours count only completed rows                   | seq=1: 60 km, 4 hr; seq=2: open | total_km=60, total_hours=4                   | ✅ Pass |
| 14 | end_km and end_time reflect the last completed row, not the open row | seq=1 ends at 260, 12:00        | end_km=260, end_time=2025-06-01T12:00:00     | ✅ Pass |
| 15 | Start fields still come from the first row                           | seq=1 starts at 200, 08:00      | start_km=200, start_time=2025-06-01T08:00:00 | ✅ Pass |

### Fixture 4 — Seq ordering (records supplied out of order)

**Pattern:** Array supplied as [seq=2, seq=1]. seq=1 is 06:00→08:00 (60 km, 2 hr), seq=2 is 08:30→10:00 (50 km, 1.5 hr). Validates sort-by-seq, not array position.

| #  | Test Case                                                                | Inputs                               | Expected                                    | Result |
| -- | ------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------- | ------ |
| 16 | Processes rows in seq order regardless of array position                 | seq=2 at index 0, seq=1 at index 1   | metrics[0].seq=1, metrics[1].seq=2          | ✅ Pass |
| 17 | start_km and start_time come from seq=1 even when it was second in array | seq=1: start@50, 06:00               | start_km=50, start_time=2025-06-01T06:00:00 | ✅ Pass |
| 18 | Totals are correct after ordering                                        | seq1: 60 km/2 hr, seq2: 50 km/1.5 hr | total_km=110, total_hours=3.5               | ✅ Pass |

### Empty metrics array

| #  | Test Case                                         | Inputs           | Expected                                                                                          | Result |
| -- | ------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------- | ------ |
| 19 | Returns zero totals and null compatibility fields | empty array `[]` | total_km=0, total_hours=0, start_km=null, end_km=null, start_time=null, end_time=null, metrics=[] | ✅ Pass |

### Validation errors

| #  | Test Case                                                                | Inputs                                   | Expected error code        | Result |
| -- | ------------------------------------------------------------------------ | ---------------------------------------- | -------------------------- | ------ |
| 20 | Throws INVALID_START_KM when start_km is negative                        | start_km=-1                              | `INVALID_START_KM`         | ✅ Pass |
| 21 | Throws INVALID_END_KM when end_km is less than start_km                  | start_km=200, end_km=150                 | `INVALID_END_KM`           | ✅ Pass |
| 22 | Throws INVALID_METRIC_RANGE when end timestamp is before start timestamp | start=16:00, end=08:00 (same day)        | `INVALID_METRIC_RANGE`     | ✅ Pass |
| 23 | Throws INCOMPLETE_METRIC when only some end fields are present           | end_date set, end_time=null, end_km=null | `INCOMPLETE_METRIC`        | ✅ Pass |
| 24 | Throws INCOMPLETE_METRIC when only end_km is present                     | end_km=180, end_date=null, end_time=null | `INCOMPLETE_METRIC`        | ✅ Pass |
| 25 | Throws INVALID_METRIC_TIMESTAMP when start_date is malformed             | start_date='not-a-date'                  | `INVALID_METRIC_TIMESTAMP` | ✅ Pass |

### Date and time edge cases

| #  | Test Case                                                                  | Inputs                                       | Expected                                   | Result |
| -- | -------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ | ------ |
| 26 | Calculates hours correctly for overnight trip spanning midnight            | 22:00 day 1 → 06:00 day 2, km 500→620        | segment_hours=8, segment_km=120            | ✅ Pass |
| 27 | Handles zero-km zero-hour same-point row                                   | start=end (same time and odometer)           | segment_km=0, segment_hours=0, total_km=0  | ✅ Pass |
| 28 | Accepts start_km = 0 (odometer starts from zero)                           | start_km=0, end_km=50                        | no error thrown, total_km=50               | ✅ Pass |
| 29 | Rounds segment_km and segment_hours to 2 decimal places                    | 08:00→08:20, km 100→110                      | segment_hours=0.33 (20 min), segment_km=10 | ✅ Pass |
| 30 | Accepts numeric strings for start_km and end_km (as returned by pg driver) | start_km='100.50', end_km='200.50' (strings) | start_km=100.5, end_km=200.5, total_km=100 | ✅ Pass |

---

---

## Phase 4 — GT Invoice Helpers (`invoice-gt.test.ts`)

**Modules:** `server/src/utils/invoice-gt.ts`, `server/src/utils/annexure-builder.ts`, `server/src/utils/gst.ts`

**Fixtures:** `server/src/utils/invoice-gt.fixtures.ts`

**Total:** 32 tests — ✅ 32 passed

### Group 1 — `isInterState` (GSTIN state-code comparison)

| #  | Test Case                                              | Inputs                              | Expected | Result |
| -- | ------------------------------------------------------ | ----------------------------------- | -------- | ------ |
| 1  | Same state (Odisha 21) — intra-state                   | company=21AABCT…, customer=21AABCU… | false    | ✅ Pass |
| 2  | Different states — Odisha vs Maharashtra (27)          | company=21…, customer=27…           | true     | ✅ Pass |
| 3  | Different states — Odisha vs Delhi (07)                | company=21…, customer=07…           | true     | ✅ Pass |
| 4  | Different states — Odisha vs Karnataka (29)            | company=21…, customer=29…           | true     | ✅ Pass |
| 5  | Null customer GSTIN — defaults to intra-state          | customer=null                       | false    | ✅ Pass |
| 6  | Undefined company GSTIN — defaults to intra-state      | company=undefined                   | false    | ✅ Pass |
| 7  | Both null/undefined                                    | both null                           | false    | ✅ Pass |
| 8  | Same first-2-char prefix, different rest               | 21AAAAA…, 21BBBBB…                  | false    | ✅ Pass |

### Group 2 — `formatDutyTypeLabel` (duty type to display label)

| #  | Test Case                           | Input            | Expected       | Result |
| -- | ----------------------------------- | ---------------- | -------------- | ------ |
| 9  | local → Local                       | 'local'          | 'Local'        | ✅ Pass |
| 10 | outstation → Outstation             | 'outstation'     | 'Outstation'   | ✅ Pass |
| 11 | drop_pickup → Drop Pickup           | 'drop_pickup'    | 'Drop Pickup'  | ✅ Pass |
| 12 | station_drop → Station Drop         | 'station_drop'   | 'Station Drop' | ✅ Pass |
| 13 | long → Long                         | 'long'           | 'Long'         | ✅ Pass |
| 14 | Null input → null                   | null             | null           | ✅ Pass |
| 15 | Empty string → null                 | ''               | null           | ✅ Pass |

### Group 3 — `buildInterestNote` (payment terms to interest note text)

| #  | Test Case                             | Input     | Expected                                                        | Result |
| -- | ------------------------------------- | --------- | --------------------------------------------------------------- | ------ |
| 16 | 30-day terms                          | 30        | 'Interest @ 18% p.a. applies after 30 day(s) from invoice date.' | ✅ Pass |
| 17 | 1-day terms                           | 1         | 'Interest @ 18% p.a. applies after 1 day(s) from invoice date.'  | ✅ Pass |
| 18 | 0-day terms                           | 0         | 'Interest @ 18% p.a. applies after 0 day(s) from invoice date.'  | ✅ Pass |
| 19 | null (no credit period) → null        | null      | null                                                            | ✅ Pass |
| 20 | undefined → null                      | undefined | null                                                            | ✅ Pass |

### Group 4 — `getDateDiffInDays` (calendar day difference)

| #  | Test Case                                     | Inputs                        | Expected | Result |
| -- | --------------------------------------------- | ----------------------------- | -------- | ------ |
| 21 | Same-day — 0 nights                           | 2025-06-01 → 2025-06-01       | 0        | ✅ Pass |
| 22 | 2-night outstation (Jun 1 → Jun 3)            | 2025-06-01 → 2025-06-03       | 2        | ✅ Pass |
| 23 | End before start — floors to 0                | 2025-06-05 → 2025-06-01       | 0        | ✅ Pass |
| 24 | Month boundary (May 30 → Jun 2 = 3 days)      | 2025-05-30 → 2025-06-02       | 3        | ✅ Pass |
| 25 | Year boundary (Dec 30 → Jan 2 = 3 days)       | 2025-12-30 → 2026-01-02       | 3        | ✅ Pass |

### Group 5 — `deriveNightHalts` (night halts from metric date span)

| #  | Test Case                                           | Fixture              | Expected | Result |
| -- | --------------------------------------------------- | -------------------- | -------- | ------ |
| 26 | Empty metrics array                                 | `[]`                 | 0        | ✅ Pass |
| 27 | Single-day local trip (same start and end date)     | `METRICS_SINGLE_DAY` | 0        | ✅ Pass |
| 28 | 2-night outstation (Jun 1 → Jun 3)                  | `METRICS_TWO_NIGHT`  | 2        | ✅ Pass |
| 29 | Last row open — falls back to last start_date       | `METRICS_LAST_OPEN`  | 0        | ✅ Pass |

### Group 6 — `calculateGst` GT invoice tax scenarios

| #  | Test Case                                           | Inputs                              | Expected                                | Result |
| -- | --------------------------------------------------- | ----------------------------------- | --------------------------------------- | ------ |
| 30 | Intra-state (CGST + SGST, no IGST)                  | subtotal=3000, intra, 2.5%/2.5%/5% | cgst=75, sgst=75, igst=0, total=3150    | ✅ Pass |
| 31 | Inter-state (IGST only, no CGST/SGST)               | subtotal=3000, inter, 5%            | cgst=0, sgst=0, igst=150, total=3150    | ✅ Pass |
| 32 | Multi-item grouped annexure invoice (intra-state)   | items=[2000,1500], 2.5%/2.5%        | cgst=87.5, sgst=87.5, total=3675        | ✅ Pass |
| 33 | Zero amount — all taxes zero                        | subtotal=0                          | cgst=0, sgst=0, igst=0, total=0         | ✅ Pass |
| 34 | Fractional paise rounding (2dp)                     | subtotal=3000.50, 2.5%              | cgst=75.01, sgst=75.01, total≈3150.52   | ✅ Pass |

---

## Aggregate Summary

| Phase     | File                             | Tests  | Passed | Failed |
| --------- | -------------------------------- | ------ | ------ | ------ |
| Phase 2   | `src/utils/rate-engine.test.ts`  | 23     | 23     | 0      |
| Phase 3   | `src/utils/trip-metrics.test.ts` | 30     | 30     | 0      |
| Phase 4   | `src/utils/invoice-gt.test.ts`   | 32     | 32     | 0      |
| **Total** |                                  | **87** | **87** | **0**  |

All 87 automated tests pass as of 2026-03-17.
