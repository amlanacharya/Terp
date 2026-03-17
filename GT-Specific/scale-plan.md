# Scale Plan — TravelERP Enterprise Architecture
**Role:** Senior Solution & System Design Architect
**Objective:** Make TravelERP configurable at the micro level — like Finnone / SAP — where master data and config drive invoicing, receipting, settlement, and enquiry without code changes per client.

---

## Context

Phases 1–3 are complete. GT-Plan.md runs to Phase 5 (dynamic tax). Those phases deliver a working GT product but stay tactical — financial logic is scattered across route handlers, charge types are hardcoded columns, settlements are fully manual, and onboarding a new client still requires migrations and code changes.

This plan defines the architectural contract that makes TravelERP a platform, not just a product. The macro shape (Express + React + PostgreSQL) does not change. The micro-control layer becomes exponential: every charge type, every document layout, every settlement rule, every number series, every tax applicability rule is a row in a config table — not a line of code.

**GT-Plan.md continues as the execution track. This plan is the blueprint those phases must satisfy.**

---

## What Is Hardcoded or Manual Today

| Area | Current State | Enterprise Gap |
|---|---|---|
| Trip charges | 16 fixed columns on trips (base_charge, toll, parking…) | Can't add a new charge type without a DB migration |
| Invoice layout | Free-text description per line, no charge type linkage | No traceability from invoice line → source charge rule |
| Tax | `gst_rates` table — one rate per HSN | Can't say "toll is tax-exempt, base charge is taxable" |
| Settlements | Fully manual — user types total, advances, deductions | No engine; can't encode "driver gets 100% of allowance, advance deducted first" |
| Charge allocation | None — toll/parking absorbed as undivided trip cost | Can't split: "80% to owner, 20% to company" |
| Document numbering | `system_settings` key-value prefix only | No yearly reset, no per-customer series, no padding config |
| Approval flow | None | Can't require manager sign-off on invoice above Rs.50,000 |
| GL mapping | None | No accounting integration readiness |

---

## The Six Architectural Pillars

---

### Pillar 1 — Charge Type Registry

Every charge that can appear anywhere in the system — invoice, duty slip, settlement, receipt — is a row in this table. This replaces hardcoded columns with a data-driven registry.

**New table: `charge_types`**

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE | e.g. `BASE_CHARGE`, `TOLL`, `TDS` |
| name | text | Display name |
| category | enum | `revenue` / `expense` / `advance` / `deduction` |
| direction | enum | `debit` / `credit` — from company perspective |
| default_applies_to | enum | `customer` / `driver` / `owner` / `company` / `split` |
| calc_method | enum | `fixed` / `percentage` / `per_km` / `per_hour` / `per_day` / `formula` |
| calc_base | text null | `trip_amount` / `base_charge` / `total_km` / null |
| default_calc_value | numeric | Default rate/pct; overridable per customer |
| is_taxable | boolean | |
| default_hsn_code | text null | Links to `gst_rates` |
| gl_account_code | text null | For future accounting integration |
| is_system | boolean | System charges cannot be deleted |
| is_active | boolean | |
| sort_order | integer | |

**Pre-seeded system charge types (`is_system = true`):**

Rate engine outputs: `BASE_CHARGE`, `EXTRA_KM`, `EXTRA_HR`, `FUEL`, `NIGHT_HALT`, `FIXED_ROUTE`, `OT`
Ad-hoc trip: `TOLL`, `PARKING`, `DRIVER_ALLOWANCE`, `OTHER_CHARGES`
Advances: `ADVANCE_HIRER`, `ADVANCE_TRAVELS`, `FUEL_ADVANCE`, `CASH_ADVANCE`
Deductions: `TDS`, `FINE`, `DAMAGE`

New charge types (`AIRPORT_SURCHARGE`, `WAITING_CHARGE`, `STATE_PERMIT`) are added from the Settings UI by an admin — no migration required.

---

### Pillar 2 — Document Charge Configuration

Controls which charge types appear on each document type, in what order, with what label, and whether they add or subtract from the total. A per-customer override is supported so RBI and IFFCO can have different invoice layouts.

**New table: `document_charge_configs`**

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| document_type | enum | `invoice` / `duty_slip` / `driver_settlement` / `owner_settlement` / `annexure` |
| charge_type_id | uuid FK charge_types | |
| display_label | text | Override charge_type.name for this document |
| display_order | integer | |
| is_visible | boolean | Show/hide without deleting config |
| direction_override | enum null | `add` / `subtract` — null = use charge_type.direction |
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

### Pillar 3 — Charge Party Config (Master Split Table)

**This is the single source of truth for every percentage, allocation, and share across the entire system.** Every split — owner's cut of base charge, toll shared between customer and company, TDS rate, driver allowance pass-through — is a row here. No percentage lives in application code.

**New table: `charge_party_configs`**

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| charge_type_id | uuid FK charge_types | Which charge this config applies to |
| party | enum | `customer` / `driver` / `owner` / `company` |
| share_pct | numeric | This party's share e.g. 70.00 |
| calc_basis | enum | `percentage` / `per_km` / `per_hour` / `per_day` / `fixed` / `full` |
| fixed_value | numeric null | Used when calc_basis = `fixed` |
| direction | enum | `payable` / `deductible` — from this party's perspective |
| deduction_priority | integer null | Order deductions apply (1 = first); null for payables |
| party_id | uuid null | `null` = global default; set = per-owner / per-driver / per-customer override |
| effective_from | date | |
| effective_to | date null | |
| is_active | boolean | |

**Resolution rule (most specific wins, always):**
1. Row where `party_id = this specific owner/driver/customer` → individual contract
2. Row where `party_id = null` → global default

Shares across all parties for a given charge type must sum to 100% (validated at save time).

**Example config rows:**

| Charge Type | Party | Share | Basis | Direction | party_id |
|---|---|---|---|---|---|
| BASE_CHARGE | owner | 70% | percentage | payable | null (global) |
| BASE_CHARGE | company | 30% | percentage | — | null (global) |
| BASE_CHARGE | owner | 65% | percentage | payable | ramesh_owner_id (override) |
| BASE_CHARGE | company | 35% | percentage | — | ramesh_owner_id (override) |
| FUEL_CHARGE | owner | 80% | percentage | payable | null |
| FUEL_CHARGE | company | 20% | percentage | — | null |
| TOLL | customer | 60% | percentage | payable | null |
| TOLL | company | 40% | percentage | — | null |
| TDS | owner | 2% | percentage | deductible | null |
| DRIVER_ALLOWANCE | driver | 100% | full | payable | null |
| CASH_ADVANCE | driver | 100% | full | deductible | null (priority 1) |
| FINE | driver | 100% | full | deductible | null (priority 2) |

---

### Pillar 4 — Settlement Engine + Trip Charge Snapshot

**New table: `trip_charge_lines`** _(Phase 6 — normalized charge store alongside legacy columns)_

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| trip_id | uuid FK trips | |
| charge_type_id | uuid FK charge_types | |
| amount | numeric | Total charge amount |
| source | enum | `rate_engine` / `manual` / `system` |
| notes | text null | |
| created_at | timestamptz | |

**New table: `charge_allocations`** _(Phase 8 — per-trip snapshot of what was actually applied)_

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
3. Computes each party's share and writes a `charge_allocations` row — the audit snapshot
4. Operator can override any allocation before finalising (sets `config_source = manual_override`)
5. Settlement reports aggregate `charge_allocations` by party across trips in the period

The settlement engine (`server/src/utils/settlement-engine.ts`) applies deductions in `deduction_priority` order and produces a net payable per party. The operator reviews and approves — no manual arithmetic.

---

### Pillar 5 — Enhanced Tax Engine

Extends the Phase 5 `tax_components` plan with charge-type-level applicability, compound taxes, threshold rules, and explicit exemptions.

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

### Pillar 6 — Number Series Engine

Replaces the `system_settings` key-value prefix with a proper series table that supports yearly reset, per-customer series, and configurable padding.

**New table: `number_series`** _(Phase 8)_

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| document_type | enum | `invoice` / `trip` / `lead` / `collection` / `driver_settlement` / `owner_settlement` / `annexure` |
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
- `GT/INV/00001/25-26` — default series, yearly reset in April
- `RBI/INV/00023` — per-customer series for RBI

---

## Extended Phase Roadmap

GT-Plan.md phases remain unchanged. Scale phases follow after Phase 5.

| Phase | Scope | Key Deliverables |
|---|---|---|
| **4** — GT-Plan | Annexures + GT Invoice PDF | annexures table (in schema), pdf-invoice-gt.ts, pdf-annexure.ts |
| **5** — GT-Plan | Dynamic tax components | tax_components table, tax config UI |
| **6** — Scale | Charge Type Registry + Document Charge Config | charge_types, document_charge_configs, trip_charge_lines, Settings UI |
| **7** — Scale | Settlement Calculation Engine | settlement_rules, settlement-engine.ts, auto-calculated settlements |
| **8** — Scale | Pro-Rata Allocation + Number Series | charge_allocations, number_series, charge-allocator.ts |
| **9** — Scale | Tax Engine Extensions | tax_applicability_overrides, compound/threshold/exemption config |
| **10** — Future | Approval Workflow | approval_rules, approval_requests, email/notification triggers |
| **11** — Future | GL Account Mapping | gl_accounts, gl_postings, accounting integration readiness |

---

## Migration Strategy — No Breaking Changes

The existing trips charge columns (`base_charge`, `extra_km_charge`, `toll_charges`, etc.) are **preserved**. The config layer is layered on top:

1. **Phase 6**: Create `charge_types` with `is_system = true` rows whose codes match existing column names. No data migration needed.
2. **Dual-write period**: New trips write to both legacy columns (backward compat) AND `trip_charge_lines` (normalized).
3. **Phase 7+**: Settlement engine reads from `trip_charge_lines`. Legacy columns become read-only snapshots for PDFs and old reports.
4. **No hard cutover**: Legacy columns remain permanently for existing reports and invoice PDFs. New features use the normalized store.

---

## Business Capabilities Unlocked by Phase

| Capability | Enabled In |
|---|---|
| Add a new charge type from UI (no migration) | Phase 6 |
| Different invoice layout per customer | Phase 6 |
| "Show toll as a deduction on invoice" | Phase 6 |
| All party splits configurable per charge type (owner %, toll split, TDS…) | Phase 6 |
| Per-owner / per-driver / per-customer split override — most-specific-wins | Phase 6 |
| Auto-calculate driver net payout from trips | Phase 7 |
| "Recover advance before deducting fines" (deduction_priority) | Phase 7 |
| Split toll: 60% customer / 40% company — fetched from config at calc time | Phase 8 |
| Yearly invoice number reset in April | Phase 8 |
| Per-customer invoice number series | Phase 8 |
| "Toll is always GST-exempt" | Phase 9 |
| "Unregistered customer pays higher rate" | Phase 9 |
| Compound cess on cess | Phase 9 |
| Manager approval for invoice > Rs.1 lakh | Phase 10 |
| Export to Tally / accounting system | Phase 11 |

---

## Files to Create (Scale Phases)

```
server/db/migrations/006_charge_types.sql
server/db/migrations/007_settlement_rules.sql
server/db/migrations/008_charge_allocations_number_series.sql
server/db/migrations/009_tax_engine_extensions.sql

server/src/utils/settlement-engine.ts
server/src/utils/charge-allocator.ts

server/src/routes/charge-types.routes.ts
server/src/routes/settlement-rules.routes.ts
server/src/routes/number-series.routes.ts

src/components/Settings/ChargeTypeList.tsx
src/components/Settings/DocumentChargeConfig.tsx
src/components/Settings/SettlementRules.tsx
src/components/Settings/NumberSeries.tsx
```

---

## Immediate Next Step

Execute **GT-Plan Phase 4** (Annexures + GT Invoice PDF) — that is the current client deliverable. When implementing Phase 4 invoice line items, store the `charge_type_id` reference on `invoice_items` (already has `trip_id`/`annexure_id`). This single addition means Phase 6 normalization is a natural extension, not a rewrite of invoice generation.
