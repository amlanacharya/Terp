# GT Detailed Specs - UI Modal Refactor

## Purpose
This document formalizes the GT UI refactor described in [UI-Cahnges-Plan.md](/C:/travelerp/UI-Cahnges-Plan.md). The goal is to remove page-level inline create and edit forms from GT-facing module screens, replace browser `window.confirm()` prompts with branded confirmation dialogs, and make every primary module screen read cleanly as a list-first workspace.

This is a frontend-only slice. It must not change API contracts, database schema, route behavior, or billing logic.

## Current Baseline
Based on the current GT branch:

- [App.tsx](/C:/travelerp/src/App.tsx) already mounts all sidebar modules through page-key routing.
- [Sidebar.tsx](/C:/travelerp/src/components/Layout/Sidebar.tsx) exposes the current module set: Leads, Trips, Drivers, Vehicles, Vehicle Categories, Rate Charts, Annexures, Tax Config, Customers, Vehicle Owners, Invoices, Collections, Driver Settlements, Owner Settlements, Reports, and Settings.
- Several modules still render a create or edit form inline at the top of the page, which pushes the list or detail content down and mixes browsing with editing.
- Delete actions across the frontend still use `window.confirm()` in multiple files, including nested detail subviews.
- [InvoiceList.tsx](/C:/travelerp/src/components/Invoices/InvoiceList.tsx) already contains custom void and write-off dialogs, but still uses an inline manual invoice form and still uses `window.confirm()` for delete.
- [TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx) renders [DutySlipForm.tsx](/C:/travelerp/src/components/Trips/DutySlipForm.tsx) side-by-side with the list instead of opening it as a focused workflow.
- [RateChartList.tsx](/C:/travelerp/src/components/RateCharts/RateChartList.tsx) already separates chart detail into [RateChartDetail.tsx](/C:/travelerp/src/components/RateCharts/RateChartDetail.tsx), but its chart header form and duplicate form are still inline.
- [AnnexureList.tsx](/C:/travelerp/src/components/Annexures/AnnexureList.tsx) still has an inline create form and still uses `window.confirm()` for delete, even though the rough plan did not list it.

## UX Goals
This refactor must produce four consistent UX outcomes:

1. Primary module pages open in browse mode by default, with a clean header, list, and action buttons.
2. Primary create and edit actions open inside a reusable centered modal.
3. Destructive actions use a shared confirmation modal instead of browser prompts.
4. Contextual detail panels that are genuinely part of a selected record can remain embedded, but they must stop using `window.confirm()`.

## Scope
This slice includes:

1. Creating reusable shared modal components.
2. Converting page-level inline create and edit forms to modal workflows.
3. Replacing `window.confirm()` usage across sidebar modules and nested maintenance panels.
4. Preserving existing page-key routing and role-based access behavior.
5. Preserving current business logic and API behavior.

## Explicitly Out Of Scope
The following are out of scope for this refactor:

- backend changes
- database or seed changes
- API payload changes
- redesign of Reports or Dashboard
- Settings page per-item inline editing
- rewriting GT billing, annexure logic, or tax logic
- converting every nested contextual form to a modal when the form belongs naturally inside a selected-record detail panel

## Critical Design Clarifications

### 1. Page-Level Forms Move To Modals; Contextual Subforms May Stay Embedded
The primary problem is page-level forms occupying the main list surface. This spec therefore distinguishes between:

- page-level create or edit forms that should move into a modal
- nested detail-panel forms that may remain embedded because they belong to a selected record workflow

Examples:

- [LeadList.tsx](/C:/travelerp/src/components/Leads/LeadList.tsx) lead create or edit form moves to a modal.
- Lead follow-up entry can remain in the selected-lead area, but its delete action must use `ConfirmModal`.
- [TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx) moves `DutySlipForm` into a modal.
- Trip expense entry may remain in the selected-trip detail area, but expense delete must use `ConfirmModal`.
- [RateChartDetail.tsx](/C:/travelerp/src/components/RateCharts/RateChartDetail.tsx) package and fixed-route forms may remain embedded, but delete confirmations must use `ConfirmModal`.

### 2. Legacy Manual Invoice Form Is In Scope
Although the rough plan only called out delete confirmation for [InvoiceList.tsx](/C:/travelerp/src/components/Invoices/InvoiceList.tsx), the current screen still includes a page-level manual invoice form. That form is subject to the same browse-versus-edit problem and must move into a modal.

Existing void and write-off dialogs should remain functionally unchanged in this phase. They may continue as bespoke dialogs or be restyled onto the shared modal shell only if that can be done without altering invoice lifecycle behavior.

### 3. Annexure Screen Is In Scope
The rough plan omitted [AnnexureList.tsx](/C:/travelerp/src/components/Annexures/AnnexureList.tsx), but the current GT branch includes it in sidebar navigation and it still has both page-level creation and browser confirm deletion. The formal implementation scope must include it.

Required rule:

- standalone `AnnexureList` create flow uses the shared modal
- embedded `AnnexureList` inside [TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx) can use the same modal with parent trip preselected and locked

### 4. Delete Confirmation Standardization Applies To Nested Views Too
This refactor is not complete if only top-level row deletes are converted. The following nested delete flows must also stop using `window.confirm()`:

- lead follow-up delete in [LeadList.tsx](/C:/travelerp/src/components/Leads/LeadList.tsx)
- travel metric delete in [DutySlipForm.tsx](/C:/travelerp/src/components/Trips/DutySlipForm.tsx)
- trip expense delete in [TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx)
- package delete in [RateChartDetail.tsx](/C:/travelerp/src/components/RateCharts/RateChartDetail.tsx)
- fixed-route delete in [RateChartDetail.tsx](/C:/travelerp/src/components/RateCharts/RateChartDetail.tsx)

### 5. No Module Should Lose Its Existing Permissions Or Guardrails
This slice is purely presentational. It must preserve:

- the current role checks already enforced in each module
- existing disabled states during saves and destructive actions
- current API sequencing and refresh behavior after create, edit, delete, void, write-off, billing, or PDF download

## Shared Component Specification

### 1. New Component: `Modal`
Create [Modal.tsx](/C:/travelerp/src/components/Layout/Modal.tsx).

Required props:

- `isOpen: boolean`
- `onClose: () => void`
- `title: string`
- `children: ReactNode`
- `size?: 'sm' | 'md' | 'lg' | 'xl'`
- optional `footer?: ReactNode`
- optional `closeOnBackdrop?: boolean` default `true`
- optional `closeOnEsc?: boolean` default `true`

Required behavior:

- rendered through a React portal into `document.body`
- fixed full-screen backdrop with centered dialog
- ESC closes when not explicitly disabled
- clicking the backdrop closes when not explicitly disabled
- close button in the header
- sticky header and footer where appropriate
- body content scrolls independently when the form is tall
- body scroll is locked while the modal is open
- size mapping:
  - `sm` -> `max-w-sm`
  - `md` -> `max-w-lg`
  - `lg` -> `max-w-2xl`
  - `xl` -> `max-w-5xl`

Implementation notes:

- keep styling aligned with current rounded card language already used across the GT branch
- use a high z-index so the modal always sits above sticky page content
- do not create a global modal manager in this slice; local state per screen is sufficient

### 2. New Component: `ConfirmModal`
Create [ConfirmModal.tsx](/C:/travelerp/src/components/Layout/ConfirmModal.tsx).

Required props:

- `isOpen: boolean`
- `onClose: () => void`
- `onConfirm: () => void | Promise<void>`
- `title: string`
- `message: string`
- optional `confirmLabel?: string`
- optional `cancelLabel?: string`
- optional `loading?: boolean`
- optional `tone?: 'danger' | 'warning'`

Required behavior:

- built on top of the shared `Modal` shell with `size="sm"`
- primary confirm button styled as destructive by default
- cancel button closes without side effects
- buttons disabled while `loading` is true
- confirm action does not auto-close on failure; parent screen remains responsible for error handling

## Module Conversion Matrix

| File | Current State | Target State | Modal Size |
|---|---|---|---|
| [LeadList.tsx](/C:/travelerp/src/components/Leads/LeadList.tsx) | Page-level lead form inline | Move lead form into modal; keep selected-lead detail inline | `xl` |
| [DriverList.tsx](/C:/travelerp/src/components/Drivers/DriverList.tsx) | Inline master form | Move create/edit to modal | `lg` |
| [VehicleList.tsx](/C:/travelerp/src/components/Vehicles/VehicleList.tsx) | Inline master form | Move create/edit to modal | `lg` |
| [CustomerList.tsx](/C:/travelerp/src/components/Customers/CustomerList.tsx) | Inline master form | Move create/edit to modal | `lg` |
| [OwnerList.tsx](/C:/travelerp/src/components/Owners/OwnerList.tsx) | Inline master form | Move create/edit to modal | `lg` |
| [VehicleCategoryList.tsx](/C:/travelerp/src/components/VehicleCategories/VehicleCategoryList.tsx) | Inline master form | Move create/edit to modal | `md` |
| [CollectionList.tsx](/C:/travelerp/src/components/Collections/CollectionList.tsx) | Inline transactional form | Move create/edit to modal | `lg` |
| [TaxComponentList.tsx](/C:/travelerp/src/components/TaxConfig/TaxComponentList.tsx) | Inline master form | Move create/edit to modal | `md` |
| [DriverSettlements.tsx](/C:/travelerp/src/components/Settlements/DriverSettlements.tsx) | Inline transactional form | Move create/edit to modal | `xl` |
| [OwnerSettlements.tsx](/C:/travelerp/src/components/Settlements/OwnerSettlements.tsx) | Inline transactional form | Move create/edit to modal | `xl` |
| [RateChartList.tsx](/C:/travelerp/src/components/RateCharts/RateChartList.tsx) | Inline chart header form plus inline duplicate form | Move both into modals; keep detail panel embedded | `xl` |
| [TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx) | `DutySlipForm` embedded beside list | Open `DutySlipForm` in modal; keep selected-trip detail panels on page | `xl` |
| [AnnexureList.tsx](/C:/travelerp/src/components/Annexures/AnnexureList.tsx) | Inline create form | Use modal for create flow in standalone and embedded contexts | `xl` |
| [InvoiceList.tsx](/C:/travelerp/src/components/Invoices/InvoiceList.tsx) | Legacy manual invoice form inline | Move manual create/edit form into modal; keep void/write-off dialogs | `lg` |

## Destructive Action Coverage
Replace `window.confirm()` with `ConfirmModal` in all of the following files:

- [LeadList.tsx](/C:/travelerp/src/components/Leads/LeadList.tsx)
- [DriverList.tsx](/C:/travelerp/src/components/Drivers/DriverList.tsx)
- [VehicleList.tsx](/C:/travelerp/src/components/Vehicles/VehicleList.tsx)
- [CustomerList.tsx](/C:/travelerp/src/components/Customers/CustomerList.tsx)
- [OwnerList.tsx](/C:/travelerp/src/components/Owners/OwnerList.tsx)
- [VehicleCategoryList.tsx](/C:/travelerp/src/components/VehicleCategories/VehicleCategoryList.tsx)
- [CollectionList.tsx](/C:/travelerp/src/components/Collections/CollectionList.tsx)
- [TaxComponentList.tsx](/C:/travelerp/src/components/TaxConfig/TaxComponentList.tsx)
- [DriverSettlements.tsx](/C:/travelerp/src/components/Settlements/DriverSettlements.tsx)
- [OwnerSettlements.tsx](/C:/travelerp/src/components/Settlements/OwnerSettlements.tsx)
- [RateChartList.tsx](/C:/travelerp/src/components/RateCharts/RateChartList.tsx)
- [RateChartDetail.tsx](/C:/travelerp/src/components/RateCharts/RateChartDetail.tsx)
- [TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx)
- [DutySlipForm.tsx](/C:/travelerp/src/components/Trips/DutySlipForm.tsx)
- [AnnexureList.tsx](/C:/travelerp/src/components/Annexures/AnnexureList.tsx)
- [InvoiceList.tsx](/C:/travelerp/src/components/Invoices/InvoiceList.tsx)

## Module-Specific Requirements

### 1. Leads
Update [LeadList.tsx](/C:/travelerp/src/components/Leads/LeadList.tsx).

Required behavior:

- replace the top lead capture form with a modal opened by `Add Lead` and `Edit`
- keep selected lead details and follow-up history on the page
- keep follow-up entry embedded in the selected-lead context for now
- replace lead delete and follow-up delete browser confirms with `ConfirmModal`
- closing the lead modal resets create state and preserves the selected lead unless the user explicitly changes it

### 2. Trips
Update [TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx) and [DutySlipForm.tsx](/C:/travelerp/src/components/Trips/DutySlipForm.tsx).

Required behavior:

- `New GT Trip` opens a modal containing `DutySlipForm`
- editing an existing trip opens the same modal prefilled
- selected trip detail, billing cards, annexure panel, calculation breakdown, and expense section remain on the page
- travel metric delete inside `DutySlipForm` uses `ConfirmModal`
- trip delete and trip expense delete use `ConfirmModal`
- closing the trip modal must not wipe the currently selected trip detail unless it is a true create-cancel flow

### 3. Annexures
Update [AnnexureList.tsx](/C:/travelerp/src/components/Annexures/AnnexureList.tsx).

Required behavior:

- creation uses the shared modal in both standalone and embedded modes
- when embedded inside a selected trip, parent-trip context is preselected and not editable
- create modal still supports both selection modes: `metric_rows` and `date_range`
- metric preview and range inputs remain visible inside the modal
- annexure delete uses `ConfirmModal`
- annexure bill and PDF actions remain inline actions on the list rows

### 4. Rate Charts
Update [RateChartList.tsx](/C:/travelerp/src/components/RateCharts/RateChartList.tsx) and [RateChartDetail.tsx](/C:/travelerp/src/components/RateCharts/RateChartDetail.tsx).

Required behavior:

- main chart create and edit move into a modal
- duplicate-chart flow also moves into a modal because it is a create action, not just a detail view
- `RateChartDetail` remains embedded as the secondary workspace for packages and fixed routes
- package delete and fixed-route delete use `ConfirmModal`
- package and fixed-route create or edit forms may remain embedded in this phase

### 5. Invoices
Update [InvoiceList.tsx](/C:/travelerp/src/components/Invoices/InvoiceList.tsx).

Required behavior:

- legacy manual invoice create and edit form moves into a modal
- existing void and write-off dialogs remain intact functionally
- invoice delete uses `ConfirmModal`
- annexure PDF mode menu behavior implemented earlier remains unchanged
- copy on the page should continue to tell operators that GT trip and annexure invoices belong in Trips or Annexures screens

### 6. Master And Transactional Forms
Update the following screens using the standard modal pattern:

- [DriverList.tsx](/C:/travelerp/src/components/Drivers/DriverList.tsx)
- [VehicleList.tsx](/C:/travelerp/src/components/Vehicles/VehicleList.tsx)
- [CustomerList.tsx](/C:/travelerp/src/components/Customers/CustomerList.tsx)
- [OwnerList.tsx](/C:/travelerp/src/components/Owners/OwnerList.tsx)
- [VehicleCategoryList.tsx](/C:/travelerp/src/components/VehicleCategories/VehicleCategoryList.tsx)
- [CollectionList.tsx](/C:/travelerp/src/components/Collections/CollectionList.tsx)
- [TaxComponentList.tsx](/C:/travelerp/src/components/TaxConfig/TaxComponentList.tsx)
- [DriverSettlements.tsx](/C:/travelerp/src/components/Settlements/DriverSettlements.tsx)
- [OwnerSettlements.tsx](/C:/travelerp/src/components/Settlements/OwnerSettlements.tsx)

Required behavior:

- page opens in list mode
- `Add New` opens empty modal
- `Edit` opens prefilled modal
- successful save closes modal and refreshes the list
- delete uses `ConfirmModal`
- cancel closes modal and resets form state

## State Pattern
Each converted page should follow a predictable local state model.

Recommended baseline:

```tsx
const [isModalOpen, setIsModalOpen] = useState(false);
const [editingId, setEditingId] = useState<string | null>(null);
const [confirmTarget, setConfirmTarget] = useState<T | null>(null);

function openCreate() {
  resetForm();
  setEditingId(null);
  setIsModalOpen(true);
}

function openEdit(item: T) {
  populateForm(item);
  setEditingId(item.id);
  setIsModalOpen(true);
}

function closeModal() {
  setIsModalOpen(false);
  resetForm();
}
```

Rules:

- submit handlers keep their current API calls and refresh behavior
- modal close must not race with an active save
- confirm modal target objects should be cleared after successful delete or cancel
- row-level loading states should continue to disable relevant buttons during destructive actions

## Layout And Copy Rules

- primary page header remains visible behind the modal workflow
- `Add New` or equivalent CTA should move to the page header action area when practical
- do not remove helpful explanatory text already present on pages unless it becomes redundant
- preserve current Tailwind visual language; this refactor is about interaction consistency, not a new design system
- modal titles should use action-oriented copy such as `Add Driver`, `Edit Customer`, `Create Annexure`, `Duplicate Rate Chart`, `Manual Invoice`

## Accessibility And Interaction Rules

- ESC closes modal when not saving
- backdrop click closes modal when not saving and when the form has no destructive unsaved-state blocker in this phase
- close button is always visible in modal header
- form submit buttons remain keyboard reachable
- confirmation modals must keep focus on a visible action, not behind the overlay
- do not rely on browser-native confirmation prompts anywhere in the touched scope once this refactor is complete

## Implementation Order

1. Create [Modal.tsx](/C:/travelerp/src/components/Layout/Modal.tsx) and [ConfirmModal.tsx](/C:/travelerp/src/components/Layout/ConfirmModal.tsx).
2. Convert simple master-data screens first: Vehicle Categories, Tax Config, Drivers, Vehicles, Customers, Vehicle Owners.
3. Convert transactional but still straightforward screens: Collections, Driver Settlements, Owner Settlements.
4. Convert invoice manual form and delete confirmation.
5. Convert Leads, Trips, Annexures, and Rate Charts because they include selected-record secondary panels.
6. Replace remaining nested `window.confirm()` usage in `DutySlipForm`, `RateChartDetail`, and lead follow-up handling.
7. Run frontend build and manual browser verification across all touched modules.

## Acceptance Criteria

This UI refactor is complete only when all of the following are true:

- no touched sidebar module uses a page-level inline create or edit form where this spec calls for a modal
- no touched file in scope still uses `window.confirm()`
- existing role-based access and disabled states still behave correctly
- modal create, edit, cancel, and save flows work without page layout jumps
- void and write-off invoice actions still work exactly as before
- trip, annexure, invoice PDF, tax preview, and billing flows remain behaviorally unchanged apart from modal presentation
- no backend endpoint or payload needs to change to support the UI refactor

## Verification Checklist

1. Open each converted module and confirm the page lands in list-first browse mode.
2. Click the primary add action and confirm a centered modal opens with an empty form.
3. Click edit on an existing row and confirm the modal opens prefilled.
4. Save a new record and confirm the modal closes and the list refreshes.
5. Cancel an edit and confirm the underlying list or selected-record state remains stable.
6. Trigger delete on each touched module and confirm `ConfirmModal` appears instead of a browser prompt.
7. In Trips, delete a travel metric and an expense and confirm both use shared confirmation UI.
8. In Leads, delete a follow-up and confirm shared confirmation UI.
9. In Rate Charts, delete a package and a fixed route and confirm shared confirmation UI.
10. In Invoices, verify manual invoice modal, delete confirm, PDF download menu, void modal, and write-off modal all coexist correctly.
11. In Annexures, verify create modal works both from the standalone page and from the embedded trip context.
12. Run `npm run build` and fix any frontend regressions before merging.

## Phase Exit Condition
This phase is done when the GT branch has a consistent modal-based CRUD experience across its primary module screens, branded confirmation dialogs instead of browser prompts, and no regression in current GT workflows.
