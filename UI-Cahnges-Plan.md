# UI Modal Refactor — All Sidebar Modules

## Context

Currently all CREATE / EDIT / DELETE operations across every module use an **inline form at the top of the page** that pushes the list down. This hurts UX:
- Form and list compete for screen space
- No clear separation between "browsing" and "editing" mode
- Delete uses browser `confirm()` — not branded, not consistent
- Some modules (TripList, RateChartList) are already partially modal but inconsistently

**Goal:** Every create / edit opens a centered modal popup; every delete shows a small confirmation modal. The list page stays clean — just a table/cards + "Add New" button.

---

## Approach

### 1. Shared `Modal` component — `src/components/Layout/Modal.tsx`
A single reusable modal with:
- `isOpen`, `onClose`, `title`, `children`, optional `size?: 'sm' | 'md' | 'lg' | 'xl'`
- Backdrop click closes; ESC key closes
- `size` maps to `max-w-sm / max-w-lg / max-w-2xl / max-w-4xl`
- Fixed header (title + ✕ button) + scrollable body
- Rendered via React Portal into `document.body`

### 2. Shared `ConfirmModal` component — `src/components/Layout/ConfirmModal.tsx`
Small danger confirmation dialog:
- `isOpen`, `onClose`, `onConfirm`, `title`, `message`, optional `loading`
- Red "Delete" / "Confirm" button + "Cancel"
- Replaces all `window.confirm()` delete confirmations

### 3. Convert each module (inline form → modal)

For every module the pattern is the same:
1. Remove the inline form block from the JSX
2. Add `isModalOpen` / `isConfirmOpen` state
3. Change "Edit" button → `openModal(item)`; "Add New" button → `openModal(null)`
4. Render `<Modal>` with the form inside
5. Render `<ConfirmModal>` for delete

---

## Files to Create

| File | Purpose |
|---|---|
| `src/components/Layout/Modal.tsx` | Shared modal shell |
| `src/components/Layout/ConfirmModal.tsx` | Shared delete confirmation |

---

## Files to Modify

| File | Current Pattern | Change |
|---|---|---|
| `src/components/Leads/LeadList.tsx` | Inline form (26 fields) | Move form into `<Modal size="xl">` |
| `src/components/Drivers/DriverList.tsx` | Inline form | Move form into `<Modal size="lg">` |
| `src/components/Vehicles/VehicleList.tsx` | Inline form | Move form into `<Modal size="lg">` |
| `src/components/Customers/CustomerList.tsx` | Inline form | Move form into `<Modal size="lg">` |
| `src/components/Owners/OwnerList.tsx` | Inline form | Move form into `<Modal size="lg">` |
| `src/components/VehicleCategories/VehicleCategoryList.tsx` | Inline form | Move form into `<Modal size="md">` |
| `src/components/Collections/CollectionList.tsx` | Inline form | Move form into `<Modal size="lg">` |
| `src/components/TaxConfig/TaxComponentList.tsx` | Inline form | Move form into `<Modal size="md">` |
| `src/components/Settlements/DriverSettlements.tsx` | Inline form | Move form into `<Modal size="xl">` |
| `src/components/Settlements/OwnerSettlements.tsx` | Inline form | Move form into `<Modal size="xl">` |
| `src/components/RateCharts/RateChartList.tsx` | Inline form + embedded detail | Move header form into `<Modal size="lg">`; keep RateChartDetail embedded (secondary panel) |
| `src/components/Trips/TripList.tsx` | DutySlipForm embedded side-by-side | Move into `<Modal size="xl">` full-screen style |
| `src/components/Invoices/InvoiceList.tsx` | Already has void/write-off modals | Add `<ConfirmModal>` for delete; keep existing void/write-off modals as-is |

---

## Implementation Order

1. Create `Modal.tsx` and `ConfirmModal.tsx`
2. Convert simple master-data modules first (VehicleCategories, TaxComponents, Drivers, Vehicles, Owners, Customers)
3. Convert transactional modules (Collections, Settlements)
4. Convert complex modules (Leads, RateCharts, Trips)
5. Update InvoiceList delete confirmation

---

## Modal Size Guide

- `sm` — confirmations only (ConfirmModal uses this internally)
- `md` (max-w-lg) — 2-3 field forms (VehicleCategories, TaxComponents)
- `lg` (max-w-2xl) — standard forms (Drivers, Vehicles, Customers, Owners, Collections)
- `xl` (max-w-4xl) — complex/many-field forms (Leads, Settlements, Trips, RateCharts)

---

## State Pattern for Each Converted Component

```tsx
const [modalOpen, setModalOpen] = useState(false);
const [editingId, setEditingId] = useState<string | null>(null);
const [confirmId, setConfirmId] = useState<string | null>(null);

function openCreate() { resetForm(); setEditingId(null); setModalOpen(true); }
function openEdit(item: T) { populateForm(item); setEditingId(item.id); setModalOpen(true); }
function closeModal() { setModalOpen(false); resetForm(); }
async function handleSubmit() { /* POST or PUT */ closeModal(); fetchList(); }
async function handleDelete() { await fetch DELETE; setConfirmId(null); fetchList(); }
```

---

## Verification

- Open each module → list shows cleanly with "Add New" button at top-right
- Click "Add New" → centered modal opens with empty form
- Click "Edit" on a row → modal opens pre-filled
- Submit → modal closes, list refreshes with new/updated record
- Click "Delete" → `<ConfirmModal>` appears; confirm → record removed; cancel → no change
- ESC key and backdrop click close the modal without saving
- No regressions on existing data (no backend changes — purely frontend)

---

## Out of Scope

- No backend changes
- Settings page (per-item inline edit is appropriate there — keep as-is)
- Reports / Dashboard (read-only, no forms)
- RateChartDetail sub-panel (secondary detail view, not a create/edit form — leave as-is)
