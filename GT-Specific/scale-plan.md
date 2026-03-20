# Scale Plan - TravelERP Enterprise Architecture
**Role:** Senior Solution & System Design Architect
**Objective:** Make TravelERP configurable at the micro level - like Finnone / SAP - where master data and config drive invoicing, receipting, settlement, and enquiry without code changes per client.

**Last reviewed against codebase:** 2026-03-19

---

## Context

GT-Plan Phases 4 and 5 are already implemented in the current codebase. TravelERP now has:

- Annexures, annexure billing, grouped annexure billing, and GT-specific invoice/annexure PDFs
- Dynamic `tax_components` with invoice-level and invoice-item tax snapshot tables
- Invoice lifecycle baseline in `invoices`: `invoice_type`, `reference_invoice_id`, `invoice_status`, `void_reason`, `voided_at`, `voided_by`
- Duty-slip travel metrics plus annexure source-lineage via `trip_travel_metrics.source_metric_id`

That delivered a strong GT baseline, but the platform gap remains: trip charges are still hardcoded columns, document layout is still not charge-type driven, settlements are still manual, charge allocation is absent, numbering is still prefix-based rather than series-based, and approvals / GL mapping are still not modeled.

**GT-Plan.md remains the client-delivery track. This document is the platform blueprint for Phase 6 onward and now incorporates the invoice-lifecycle baseline already present in code.**

---

## Current Codebase Status

| Area | Status | Current Evidence | Scaling Implication |
|---|---|---|---|
| GT Phase 4 - Annexures + GT invoice PDF | Done | `annexures.routes.ts`, `annexure-builder.ts`, `pdf-annexure.ts`, `pdf-invoice-gt.ts`, `AnnexureList.tsx`, consolidated annexure schema | Phase 6 normalization must preserve trip / annexure lineage |
| GT Phase 5 - Dynamic tax components | Done | `005_tax_components.sql`, `tax-engine.ts`, `tax-components.routes.ts`, `TaxComponentList.tsx` | Phase 9 extends this baseline instead of replacing it |
| Invoice lifecycle baseline | Done and now factored into this plan | `006_void_invoices.sql`, `invoices.routes.ts`, `src/lib/types.ts` | Number series, approval, reporting, and GL must support `invoice`, `credit_note`, `void`, `written_off` |
| Duty-slip workflow enhancement layer | Done | `DutySlipForm.tsx` 5-tab editor, GT auto-numbering in `auto-code.ts`, parent-trip annexure flow, standalone annexure billing page | Scale phases must layer on top of the current GT duty-slip UX, not replace it |
| Duty-slip metric lineage | Done and now factored into this plan | `trip_travel_metrics`, `source_metric_id`, annexure-builder validation | Charge normalization must retain enough audit linkage for annexure-derived billing |
| Resource allocation / availability control | Not started | `trips` stores one `vehicle_id` + one `driver_id`, but there is no overlap validation, no reservation ledger, and no relief-driver / vehicle-swap model | Impossible live operations can still be recorded; this must become an explicit scale-phase capability |
| Settlement engine | Not started | `settlements.routes.ts` is still manual CRUD + PDF | Phase 7 still required |
| Charge registry / allocation / number series | Not started | No `charge_types`, `document_charge_configs`, `charge_party_configs`, `trip_charge_lines`, `charge_allocations`, `number_series` tables yet | Phases 6-8 remain open |

---

## What Is Hardcoded or Manual Today

| Area | Current State | Enterprise Gap |
|---|---|---|
| Trip charges | Fixed columns on `trips` (`base_charge`, `toll_charges`, `parking_charges`, etc.) | Cannot add a new charge type without schema + code change |
| Invoice layout | `invoice_items` links to `trip_id` / `annexure_id`, but line descriptions are still free text and there is no `charge_type_id` | No charge-type traceability from invoice line -> source rule / source config |
| Tax | `tax_components` + `invoice_tax_components` + `invoice_item_tax_components` exist | Still cannot express charge-type-specific taxability, thresholds, compound taxes, or per-customer exemptions |
| Settlements | Fully manual - user enters totals, advances, deductions | No settlement engine; no config-driven deduction priority or split logic |
| Charge allocation | None | Cannot split toll / parking / allowance / TDS across owner, driver, company, customer |
| Resource assignment | Each trip has exactly one `vehicle_id` and one `driver_id`, but there is no overlap / shortage validation | System can record 4 trips in progress with only 3 active drivers or 3 vehicles unless the operator catches it manually |
| Document numbering | Invoice numbers still use `system_settings.invoice_prefix` + row count; other documents are still manual/prefix-based | No yearly reset, no per-customer series, no credit-note series, no concurrency-safe sequencing |
| Approval flow | None | Cannot require approval for invoice / credit note / void / write-off above thresholds |
| Invoice lifecycle | `invoice_type`, `reference_invoice_id`, `invoice_status`, and void/write-off metadata now exist | Lifecycle is not yet governed by config, approval, numbering, reporting, or GL rules |
| GL mapping | None | No accounting integration readiness; reversals cannot post with lineage |

---

## The Six Architectural Pillars

---

### Pillar 1 - Charge Type Registry

**Status:** Pending

Every charge that can appear anywhere in the system - invoice, duty slip, settlement, receipt - is a row in this table. This replaces hardcoded columns with a data-driven registry.

**New table: `charge_types`**

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE | e.g. `BASE_CHARGE`, `TOLL`, `TDS` |
| name | text | Display name |
| category | enum | `revenue` / `expense` / `advance` / `deduction` |
| direction | enum | `debit` / `credit` - from company perspective |
| default_applies_to | enum | `customer` / `driver` / `owner` / `company` / `split` |
| calc_method | enum | `fixed` / `percentage` / `per_km` / `per_hour` / `per_day` / `formula` |
| calc_base | text null | `trip_amount` / `base_charge` / `total_km` / null |
| default_calc_value | numeric | Default rate/pct; overridable per customer |
| is_taxable | boolean | |
| default_hsn_code | text null | Links to `gst_rates` / `tax_components` baseline |
| gl_account_code | text null | For future accounting integration |
| is_system | boolean | System charges cannot be deleted |
| is_active | boolean | |
| sort_order | integer | |

**Pre-seeded system charge types (`is_system = true`):**

Rate engine outputs: `BASE_CHARGE`, `EXTRA_KM`, `EXTRA_HR`, `FUEL`, `NIGHT_HALT`, `FIXED_ROUTE`, `OT`
Ad-hoc trip: `TOLL`, `PARKING`, `DRIVER_ALLOWANCE`, `OTHER_CHARGES`
Advances: `ADVANCE_HIRER`, `ADVANCE_TRAVELS`, `FUEL_ADVANCE`, `CASH_ADVANCE`
Deductions: `TDS`, `FINE`, `DAMAGE`

New charge types (`AIRPORT_SURCHARGE`, `WAITING_CHARGE`, `STATE_PERMIT`) are added from the Settings UI by an admin - no migration required.

---

### Pillar 2 - Document Charge Configuration

**Status:** Pending

Controls which charge types appear on each document type, in what order, with what label, and whether they add or subtract from the total. A per-customer override is supported so RBI and IFFCO can have different invoice layouts.

**New table: `document_charge_configs`**

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| document_type | enum | `invoice` / `credit_note` / `duty_slip` / `driver_settlement` / `owner_settlement` / `annexure` |
| charge_type_id | uuid FK charge_types | |
| display_label | text | Override charge_type.name for this document |
| display_order | integer | |
| is_visible | boolean | Show/hide without deleting config |
| direction_override | enum null | `add` / `subtract` - null = use charge_type.direction |
| include_in_total | boolean | |
| consolidate_rows | boolean | Merge all instances into one line |
| customer_id | uuid null | null = all clients; set for per-customer layout |
| is_active | boolean | |

**Example invoice config:**

| Charge Type | Label | Order | Direction | In Total |
|---|---|---|---|---|
| BASE_CHARGE | Transport Charge | 1 | add | yes |
| EXTRA_KM | Extra KM Charge | 2 | add | yes |
| NIGHT_HALT | Night Halt | 3 | add | yes |
| TOLL | Toll (Actuals) | 4 | add | yes |
| ADVANCE_HIRER | Less: Advance Received | 5 | subtract | yes |

This config is managed from the Settings UI. No code change is needed when a new client needs a different document layout.

---

### Pillar 3 - Charge Party Config (Master Split Table)

**Status:** Pending

**This is the single source of truth for every percentage, allocation, and share across the entire system.** Every split - owner's cut of base charge, toll shared between customer and company, TDS rate, driver allowance pass-through - is a row here. No percentage lives in application code.

**New table: `charge_party_configs`**

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| charge_type_id | uuid FK charge_types | Which charge this config applies to |
| party | enum | `customer` / `driver` / `owner` / `company` |
| share_pct | numeric | This party's share e.g. 70.00 |
| calc_basis | enum | `percentage` / `per_km` / `per_hour` / `per_day` / `fixed` / `full` |
| fixed_value | numeric null | Used when calc_basis = `fixed` |
| direction | enum | `payable` / `deductible` - from this party's perspective |
| deduction_priority | integer null | Order deductions apply (1 = first); null for payables |
| party_id | uuid null | `null` = global default; set = per-owner / per-driver / per-customer override |
| effective_from | date | |
| effective_to | date null | |
| is_active | boolean | |

**Resolution rule (most specific wins, always):**
1. Row where `party_id = this specific owner/driver/customer` -> individual contract
2. Row where `party_id = null` -> global default

Shares across all parties for a given charge type must sum to 100% (validated at save time).

**Example config rows:**

| Charge Type | Party | Share | Basis | Direction | party_id |
|---|---|---|---|---|---|
| BASE_CHARGE | owner | 70% | percentage | payable | null (global) |
| BASE_CHARGE | company | 30% | percentage | - | null (global) |
| BASE_CHARGE | owner | 65% | percentage | payable | ramesh_owner_id (override) |
| BASE_CHARGE | company | 35% | percentage | - | ramesh_owner_id (override) |
| FUEL_CHARGE | owner | 80% | percentage | payable | null |
| FUEL_CHARGE | company | 20% | percentage | - | null |
| TOLL | customer | 60% | percentage | payable | null |
| TOLL | company | 40% | percentage | - | null |
| TDS | owner | 2% | percentage | deductible | null |
| DRIVER_ALLOWANCE | driver | 100% | full | payable | null |
| CASH_ADVANCE | driver | 100% | full | deductible | null (priority 1) |
| FINE | driver | 100% | full | deductible | null (priority 2) |

---

### Pillar 4 - Settlement Engine + Trip Charge Snapshot

**Status:** Pending

**New table: `trip_charge_lines`** _(Phase 6 - normalized charge store alongside legacy columns)_

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid FK trips | |
| charge_type_id | uuid FK charge_types | |
| amount | numeric | Total charge amount |
| source | enum | `rate_engine` / `manual` / `system` |
| notes | text null | |
| created_at | timestamptz | |

**New table: `charge_allocations`** _(Phase 8 - per-trip snapshot of what was actually applied)_

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid FK trips | |
| charge_type_id | uuid FK charge_types | |
| total_amount | numeric | Total charge for this type on this trip |
| customer_amount | numeric | Customer's share (computed) |
| driver_amount | numeric | Driver's share (computed) |
| owner_amount | numeric | Owner's share (computed) |
| company_amount | numeric | Company's share (computed) |
| config_source | enum | `party_config` / `manual_override` |
| notes | text null | |

**How it works at calculation time:**
1. Rate engine / manual entry produces a `trip_charge_lines` row for each charge type on the trip
2. Settlement engine fetches `charge_party_configs` for each charge type (most-specific-wins resolution)
3. Computes each party's share and writes a `charge_allocations` row - the audit snapshot
4. Operator can override any allocation before finalising (sets `config_source = manual_override`)
5. Settlement reports aggregate `charge_allocations` by party across trips in the period

The settlement engine (`server/src/utils/settlement-engine.ts`) applies deductions in `deduction_priority` order and produces a net payable per party. The operator reviews and approves - no manual arithmetic.

**Additional requirement from current codebase:** because annexures now derive from `trip_travel_metrics` and preserve `source_metric_id`, normalization must retain enough trip / annexure / source-metric lineage for audit and regrouping. The normalized charge store must not break annexure-derived billing or re-open metric allocation ambiguities.

---

### Pillar 5 - Enhanced Tax Engine

**Status:** Baseline delivered in Phase 5; extension still pending

This pillar now extends the delivered Phase 5 baseline:

- `tax_components`
- `invoice_tax_components`
- `invoice_item_tax_components`
- `server/src/utils/tax-engine.ts`
- tax configuration API + UI

The next step is charge-type-level applicability, compound taxes, threshold rules, and explicit exemptions.

**Extensions to Phase 5 `tax_components`:**

| New Column | Type | Description |
|---|---|---|
| applies_to_charge_types | uuid[] null | null = all taxable charges |
| is_compound | boolean | Tax is compounded on top of other taxes |
| compound_on | uuid[] null | Which tax_component IDs to compound on |
| min_amount_threshold | numeric null | Only apply if charge exceeds this amount |
| applies_to_customer_type | enum | `all` / `gstin_registered` / `unregistered` |
| reverse_charge | boolean | Buyer pays tax (B2B reverse charge mechanism) |

**New table: `tax_applicability_overrides`** _(Phase 9)_

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| charge_type_id | uuid FK charge_types | |
| customer_id | uuid null | null = all customers |
| tax_component_id | uuid FK tax_components | |
| override_rate | numeric null | null = use tax_component.rate |
| is_exempt | boolean | Explicit exemption for this charge+customer combo |
| effective_from | date | |
| effective_to | date null | |

This makes "toll is always tax-exempt" and "base charge for unregistered customers uses a different rate" expressible as config rows, not code.

---

### Pillar 6 - Number Series Engine

**Status:** Pending

Replaces the `system_settings` key-value prefix with a proper series table that supports yearly reset, per-customer series, configurable padding, and separate lifecycle-aware series such as credit notes.

**New table: `number_series`** _(Phase 8)_

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| document_type | enum | `invoice` / `credit_note` / `trip` / `lead` / `collection` / `driver_settlement` / `owner_settlement` / `annexure` |
| series_name | text | e.g. "GT Invoice 2025-26" |
| prefix | text | e.g. `GT/INV/` |
| suffix | text null | e.g. `/25-26` |
| current_sequence | integer default 1 | |
| padding | integer default 5 | Zero-pad to this length |
| reset_frequency | enum | `never` / `yearly` / `monthly` |
| reset_month | integer null | 4 = April (India FY start) |
| customer_id | uuid null | null = default; set for per-customer series |
| is_default | boolean | |
| is_active | boolean | |

**Generated numbers:**
- `GT/INV/00001/25-26` - default invoice series, yearly reset in April
- `GT/CN/00001/25-26` - dedicated credit-note series
- `RBI/INV/00023` - per-customer series for RBI

---

## Cross-Cutting Requirement - Fleet and Driver Capacity Control

This constraint is now explicit and should not remain an operator-only responsibility.

**Current limitation in code:**

- A trip can only point to one `vehicle_id` and one `driver_id`.
- Trip status supports `scheduled`, `in_progress`, `completed`, and `cancelled`.
- There is currently no backend rule that checks whether the same driver or vehicle is already committed to another overlapping trip.
- There is currently no model for relief driver handover, mid-trip vehicle replacement, or temporary unassignment.

**Operational failure cases that must be modeled:**

- 4 trips are marked `in_progress`, but only 3 active drivers exist.
- 4 trips are marked `in_progress`, but only 3 active vehicles exist.
- 3 vehicles and 2 drivers are available, but operators still need to plan 4 bookings across time windows.
- One trip starts with Driver A and Vehicle X, then Driver B relieves mid-duty or Vehicle Y replaces Vehicle X because of breakdown.

**Platform requirement from this point onward:**

- The system must distinguish `planned allocation`, `live allocation`, and `historical allocation`.
- A driver or vehicle may be assigned to multiple trips only when time windows do not overlap, or when the earlier allocation is explicitly ended before the next begins.
- `in_progress` trips must block conflicting active assignments unless an explicit reassignment / relief action is recorded.
- Capacity checks must use only active master records (`drivers.is_active`, `vehicles.is_active`) and must fail fast in the backend, not only in the UI.
- Reassignment history must be auditable so duty-slip PDF, invoice, settlement, and incident review can explain who actually drove and which vehicle actually operated at each stage.

**Recommended data-model extension:**

**New table: `trip_resource_allocations`**

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid FK trips | |
| resource_type | enum | `driver` / `vehicle` |
| resource_id | uuid | FK to `drivers` or `vehicles` by type |
| allocation_role | enum | `primary` / `relief` / `replacement` |
| start_at | timestamptz | When this resource actually became active on the trip |
| end_at | timestamptz null | Null while still active |
| status | enum | `planned` / `active` / `released` / `cancelled` |
| notes | text null | Breakdown, handover, shortage reason, etc. |
| created_by | uuid null | Audit |
| created_at | timestamptz | |

**Rules:**

1. At most one active primary vehicle per trip at a time.
2. At most one active primary driver per trip at a time.
3. The same driver cannot be `active` on overlapping trips unless one allocation is ended first and the overlap is explicitly resolved.
4. The same vehicle cannot be `active` on overlapping trips unless one allocation is ended first and the overlap is explicitly resolved.
5. `trips.vehicle_id` and `trips.driver_id` remain as current snapshot fields for compatibility, but the allocation table becomes the operational source of truth in the scale phases.

**Phasing recommendation:**

- Phase 6A: add backend conflict checks for current `trips.vehicle_id` and `trips.driver_id` using trip status plus open-ended allocation logic.
- Phase 6B: introduce `trip_resource_allocations` and reassignment APIs.
- Phase 7: make settlements read the final historical driver/vehicle allocation instead of assuming one immutable pair per trip.

---

## Cross-Cutting Requirement - Document Lifecycle and Reversals

This was not in the original scale plan, but the current codebase now has enough lifecycle behavior that the platform design must account for it explicitly.

**Baseline already implemented:**

- `invoice_type` = `invoice` / `credit_note`
- `reference_invoice_id`
- `invoice_status` = `active` / `void` / `written_off`
- void metadata (`void_reason`, `voided_at`, `voided_by`)

**Platform requirement from this point onward:**

- Number series must support `credit_note` as a first-class document type
- Approval workflow must cover invoice void, write-off, and credit-note issuance
- Reporting must treat `active`, `void`, and `written_off` as lifecycle states, not just filters
- GL mapping must support reversal postings with reference-document lineage
- Audit views must preserve source invoice -> credit note -> collections / write-off trail

---

## Extended Phase Roadmap

GT-Plan phases remain unchanged. Scale phases follow after Phase 5, but the roadmap is updated below to reflect what the codebase has already delivered.

| Track | Phase | Status | Scope | Key Deliverables |
|---|---|---|---|---|
| GT-Plan | **4** | Done | Annexures + GT Invoice PDF | `annexures` table, `pdf-invoice-gt.ts`, `pdf-annexure.ts`, annexure billing routes/UI |
| GT-Plan | **5** | Done | Dynamic tax components | `tax_components`, `invoice_tax_components`, `invoice_item_tax_components`, `tax-engine.ts`, tax config UI |
| Current baseline | - | Done | Invoice lifecycle | `invoice_type`, `reference_invoice_id`, `invoice_status`, void / write-off flow |
| Scale | **6** | Pending | Charge Type Registry + Document Charge Config | `charge_types`, `document_charge_configs`, `trip_charge_lines`, `invoice_items.charge_type_id`, Settings UI |
| Scale | **7** | Pending | Settlement Calculation Engine | `charge_party_configs`, `settlement-engine.ts`, auto-calculated settlements |
| Scale | **8** | Pending | Pro-Rata Allocation + Number Series | `charge_allocations`, `number_series`, `charge-allocator.ts`, lifecycle-aware series |
| Scale | **9** | Pending | Tax Engine Extensions | `tax_applicability_overrides`, compound / threshold / exemption config |
| Future | **10** | Pending | Approval Workflow | approval rules for invoice, credit note, void, write-off, settlement |
| Future | **11** | Pending | GL Account Mapping | `gl_accounts`, `gl_postings`, reversal-posting readiness |

---

## Migration Strategy - No Breaking Changes

The existing trip charge columns (`base_charge`, `extra_km_charge`, `toll_charges`, etc.) are **preserved**. The config layer is layered on top:

1. **Preserve delivered GT baseline**: keep annexures, tax snapshots, and invoice lifecycle fields exactly as-is.
2. **Phase 6**: create `charge_types` with `is_system = true` rows whose codes match existing trip charge / advance / deduction semantics. No destructive data migration.
3. **Add `invoice_items.charge_type_id` as nullable**: all newly generated invoices write it; historical rows can remain null until backfilled where deterministic.
4. **Dual-write period**: new trips write to both legacy columns (backward compat) and `trip_charge_lines` (normalized).
5. **Phase 7+**: settlement engine reads from `trip_charge_lines` and `charge_allocations`. Legacy columns become read-only snapshots for old PDFs and reports.
6. **No hard cutover**: legacy columns remain for backward compatibility. New features use the normalized store.

---

## Business Capabilities Unlocked by Phase

| Capability | Enabled In |
|---|---|
| Add a new charge type from UI (no migration) | Phase 6 |
| Different invoice layout per customer | Phase 6 |
| Show toll as a deduction on invoice | Phase 6 |
| All party splits configurable per charge type (owner %, toll split, TDS, etc.) | Phase 7 |
| Per-owner / per-driver / per-customer split override - most-specific-wins | Phase 7 |
| Auto-calculate driver net payout from trips | Phase 7 |
| Recover advance before deducting fines (`deduction_priority`) | Phase 7 |
| Split toll: 60% customer / 40% company - fetched from config at calc time | Phase 8 |
| Yearly invoice number reset in April | Phase 8 |
| Per-customer invoice number series | Phase 8 |
| Dedicated credit-note series with reference linkage | Phase 8 |
| Toll is always GST-exempt | Phase 9 |
| Unregistered customer pays higher rate | Phase 9 |
| Compound cess on cess | Phase 9 |
| Manager approval for invoice / credit note / void / write-off above threshold | Phase 10 |
| Export to Tally / accounting system with reversal postings | Phase 11 |

---

## Files to Create / Update (Scale Phases)

**New migrations**

```
server/db/migrations/007_charge_types.sql
server/db/migrations/008_settlement_rules.sql
server/db/migrations/009_charge_allocations_number_series.sql
server/db/migrations/010_tax_engine_extensions.sql
```

`006_void_invoices.sql` already exists in the current repo, so the original `006_charge_types.sql` filename is no longer valid.

**New backend files**

```
server/src/utils/settlement-engine.ts
server/src/utils/charge-allocator.ts

server/src/routes/charge-types.routes.ts
server/src/routes/settlement-rules.routes.ts
server/src/routes/number-series.routes.ts
```

**Existing backend files that must be updated**

```
server/src/utils/invoice-gt.ts
server/src/routes/invoices.routes.ts
server/src/routes/annexures.routes.ts
server/src/routes/trips.routes.ts
server/src/utils/tax-engine.ts
```

**New frontend files**

```
src/components/Settings/ChargeTypeList.tsx
src/components/Settings/DocumentChargeConfig.tsx
src/components/Settings/SettlementRules.tsx
src/components/Settings/NumberSeries.tsx
```

**Existing frontend files that must be updated**

```
src/components/Settings/Settings.tsx
src/components/Invoices/InvoiceList.tsx
src/components/Annexures/AnnexureList.tsx
src/components/Trips/TripList.tsx
src/lib/types.ts
```

---

## Immediate Next Step

Execute **Scale Phase 6** - not GT Phase 4.

The first implementation slice should be:

1. Create `charge_types`, `document_charge_configs`, and `trip_charge_lines`
2. Add nullable `invoice_items.charge_type_id`
3. Update trip calculation, invoice generation, and annexure billing flows to dual-write charge-type lineage without disturbing existing GT PDFs, tax snapshots, or invoice lifecycle logic

That makes the current GT system the compatibility layer while the platform architecture starts underneath it.
