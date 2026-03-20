# GT Duty Slip PDF Specification

## Summary

Duty slip PDFs are split into three variants:

- `open_external`: driver and hirer facing dispatch slip with a blank movement grid
- `closed_external`: driver and hirer facing completed slip with populated movement rows and recorded trip-incurred costs
- `internal`: current ops and calculation snapshot for staff

Default behavior:

- the standard duty slip action downloads an external slip
- non-completed trips default to `open_external`
- completed trips default to `closed_external`
- `internal` stays available as a separate explicit option

No digital signature capture is added. External slips only print a blank client signature area for physical signing.

## External Slip Content

### Common external fields

- company header
- duty slip number using `trip_number`
- duty date
- hirer name and address
- hirer contact person and phone when available
- booked by
- report to
- nature of duty using trip `purpose` when present, otherwise `duty_type`
- car number
- driver name
- advances:
  - hirer
  - travels
- remarks when present
- blank client signature area

### Open external slip

- GT paper-pad style layout
- blank movement grid with 6 columns:
  - Starting Date
  - Starting Time
  - Starting KM
  - Closing Time
  - Closing KM
  - Closing Date
- always render at least 5 blank rows
- never prefill movement rows even if partial trip metrics already exist

### Closed external slip

- same GT paper-pad style header and booking fields
- same 6-column movement grid populated from trip travel metrics in `seq` order
- pad remaining rows up to a minimum of 5 rows to preserve the GT printed-sheet feel
- show a structured `Trip Costs Incurred` box sourced from `trip_expenses`
- print one row per expense with:
  - expense type
  - optional description
  - amount
- show all recorded trip-expense rows in this box regardless of billable flag

### Fields excluded from external slips

- rate chart
- package
- fixed route source
- calculated amount
- billed amount
- internal charge-head breakdown
- customer code
- driver code
- GT vehicle category / rate source metadata
- fuel advance
- cash advance

## Data / API Changes

- Add `trip_expenses.is_billable_to_hirer boolean NOT NULL DEFAULT false`
- Include `is_billable_to_hirer` in trip expense create, update, read, shared types, and UI form state
- Extend `GET /api/trips/:id/duty-slip-pdf` with:
  - `variant=open_external|closed_external|internal`
- If `variant` is omitted:
  - `completed` -> `closed_external`
  - all other statuses -> `open_external`
- If `variant=closed_external` is requested for a non-completed trip, return `400`

## Implementation Notes

- Keep the existing PDF content as the internal variant with no behavior change beyond variant selection
- External out-of-pocket cost display must use detailed `trip_expenses`, not header-level trip charge fields
- The new billable flag is stored for later invoicing logic only; it does not change duty slip rendering in this phase
- Update schema, migration, and seed so fresh DBs and reseeds are aligned

## Acceptance Checks

- non-completed trip default PDF -> open external
- completed trip default PDF -> closed external
- explicit internal PDF -> current internal snapshot
- external PDFs never expose calculation or billing fields
- open external PDFs render a blank movement grid
- closed external PDFs render populated movement rows and trip-expense rows
- expense billable flag persists end to end
