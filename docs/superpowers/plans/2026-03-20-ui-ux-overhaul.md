# UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the TravelERP UI across all pages — fixing sidebar collapse behaviour, tab sizing, list presentation (headers, row banding, minimal columns, filters, toggles), and modal patterns for Leads, Rate Charts, Tax Config, Fleet, Vehicle Categories, Customers, Drivers, Owners, Invoices, and Vendor Invoices.

**Architecture:** All changes are purely frontend (React + Tailwind). No backend API changes are needed. Shared patterns (table header style, row banding, active toggle, filter bar) are extracted as small inline helpers rather than new files — keep it DRY but avoid premature abstraction. Each page component is self-contained; changes are isolated to its `*List.tsx` file and `Sidebar.tsx`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, existing `Modal` + `ConfirmModal` components in `src/components/Layout/`

---

## Shared Patterns Reference

These patterns are used across multiple tasks. Define them once here; copy-paste into each file as needed.

### Table header row (bold + background)
```tsx
<thead>
  <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
    <th className="px-4 py-3">Column</th>
  </tr>
</thead>
```

### Alternating row banding
```tsx
<tbody>
  {rows.map((row, i) => (
    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
```

### Active/Inactive toggle button
```tsx
<button
  type="button"
  onClick={() => void handleToggleActive(item)}
  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
    item.is_active ? 'bg-emerald-500' : 'bg-slate-300'
  }`}
>
  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
    item.is_active ? 'translate-x-6' : 'translate-x-1'
  }`} />
</button>
```

### Filter bar (date range + text search)
```tsx
<div className="flex flex-wrap gap-3">
  <input
    type="text"
    placeholder="Search name..."
    value={filterName}
    onChange={(e) => setFilterName(e.target.value)}
    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
  />
  <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
    className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
  <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
    className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
</div>
```

---

## File Map

| File | Change |
|---|---|
| `src/components/Layout/Sidebar.tsx` | Default collapsed, +/− icons |
| `src/components/Trips/DutySlipForm.tsx` | Fixed-size tabs (no auto-fit) |
| `src/components/Leads/LeadList.tsx` | Slim table list, filters, edit → modal |
| `src/components/RateCharts/RateChartList.tsx` | Slim table list, active toggle |
| `src/components/TaxConfig/TaxComponentList.tsx` | Slim table list, active toggle, filters |
| `src/components/Vehicles/VehicleList.tsx` | Slim table list, active toggle, filters |
| `src/components/VehicleCategories/VehicleCategoryList.tsx` | Slim table list, active toggle, filters |
| `src/components/Customers/CustomerList.tsx` | Slim table list, active toggle, filters |
| `src/components/Drivers/DriverList.tsx` | Slim table list, active toggle, filters |
| `src/components/Owners/OwnerList.tsx` | Slim table list, active toggle, filters |
| `src/components/Invoices/InvoiceList.tsx` | Checkbox selection, bulk download, PDF in Actions |
| `src/components/Settlements/OwnerSettlements.tsx` | Change card layout to flat table list |

---

## Task 1: Sidebar — default collapsed + +/− icons

**Files:**
- Modify: `src/components/Layout/Sidebar.tsx`

**What to change:**
1. Default state: all groups collapsed (`false`) except the group containing the current page.
2. Replace `'Hide'` / `'Show'` text labels with `−` / `+` characters.

- [ ] **Step 1: Change default open state to false**

In `Sidebar.tsx`, find:
```tsx
const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
  Object.fromEntries(navGroups.map((group) => [group.key, true]))
);
```
Replace with:
```tsx
const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
  Object.fromEntries(navGroups.map((group) => [group.key, false]))
);
```

- [ ] **Step 2: Change Show/Hide text to +/−**

Find:
```tsx
{isOpen ? 'Hide' : 'Show'}
```
Replace with:
```tsx
{isOpen ? '−' : '+'}
```

Also update the span classes to make +/− clearly visible:
```tsx
<span className={`text-base font-bold leading-none ${hasActiveItem ? 'text-sky-300' : 'text-slate-400'}`}>
  {isOpen ? '−' : '+'}
</span>
```

- [ ] **Step 3: Verify active group auto-expands on navigation**

The existing `useEffect` already calls `next[group.key] = true` when the current page is in a group — this is correct. No change needed here.

- [ ] **Step 4: Manual test**
  - Reload the page — all groups should be collapsed except the one containing the current page.
  - Click `+` on any group — it expands.
  - Click `−` — it collapses.
  - Navigate to a page in a collapsed group — that group auto-expands.

- [ ] **Step 5: Commit**
```bash
git add src/components/Layout/Sidebar.tsx
git commit -m "feat(sidebar): default collapsed state, +/- icons"
```

---

## Task 2: DutySlip tabs — fixed equal width, no shrink/jitter

**Files:**
- Modify: `src/components/Trips/DutySlipForm.tsx`

**What to change:**
The tab bar renders buttons that auto-size to label text width. Force equal widths using a grid with fixed column count equal to the number of tabs (5). This eliminates the width-change jitter when switching tabs.

- [ ] **Step 1: Find the tab bar render in DutySlipForm.tsx**

Search for the `tabs.map(` render. It will look similar to:
```tsx
<div className="flex ...">
  {tabs.map((tab) => (
    <button key={tab.key} ...>{tab.label}</button>
  ))}
</div>
```

- [ ] **Step 2: Replace flex container with fixed grid**

Replace the outer `div` wrapping the tab buttons with:
```tsx
<div className="grid grid-cols-5 gap-1 rounded-2xl bg-slate-100 p-1">
  {tabs.map((tab) => (
    <button
      key={tab.key}
      type="button"
      onClick={() => setActiveTab(tab.key)}
      className={`rounded-xl px-2 py-2 text-center text-sm font-medium transition ${
        activeTab === tab.key
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>
```

Note: `grid-cols-5` matches the 5 tabs defined in the `tabs` array. Each column is exactly 1/5 of the container — no auto-sizing, no jitter.

- [ ] **Step 3: Manual test**
  - Open a Duty Slip edit form.
  - Click through all 5 tabs — the tab bar width should remain completely stable, no layout shift.

- [ ] **Step 4: Commit**
```bash
git add src/components/Trips/DutySlipForm.tsx
git commit -m "fix(duty-slip): fixed-width tab grid to eliminate resize jitter"
```

---

## Task 3: Leads page — slim table list + filters + edit modal

**Files:**
- Modify: `src/components/Leads/LeadList.tsx`

**What to change:**
1. Replace the current card-based list with a slim `<table>` showing: Lead #, Name, Status, Priority, Travel Date, Actions.
2. Add filter bar: Date Range (travel_date), Name search, Status dropdown.
3. Edit already opens a `Modal` — verify and keep as-is (it does use `Modal`, confirmed in code). The `startEdit` function currently calls `setIsLeadModalOpen(true)` via `openCreate` — but actually looking at the code, `startEdit` only sets state but does NOT call `setIsLeadModalOpen(true)`. Fix this so clicking Edit opens the modal.
4. Keep the Follow-ups panel as a separate section below the table (not in the table).

- [ ] **Step 1: Add filter state variables**

After the existing state declarations, add:
```tsx
const [filterName, setFilterName] = useState('');
const [filterStatus, setFilterStatus] = useState('');
const [filterFrom, setFilterFrom] = useState('');
const [filterTo, setFilterTo] = useState('');
```

- [ ] **Step 2: Add filtered leads derived value**

After the `selectedLead` useMemo, add:
```tsx
const filteredLeads = useMemo(() => {
  return leads.filter((lead) => {
    const name = (lead.customer?.name || lead.prospect_name || lead.prospect_phone).toLowerCase();
    if (filterName && !name.includes(filterName.toLowerCase())) return false;
    if (filterStatus && lead.status !== filterStatus) return false;
    if (filterFrom && lead.travel_date && lead.travel_date < filterFrom) return false;
    if (filterTo && lead.travel_date && lead.travel_date > filterTo) return false;
    return true;
  });
}, [leads, filterName, filterStatus, filterFrom, filterTo]);
```

- [ ] **Step 3: Fix startEdit to open the modal**

Find `startEdit` function. It sets `editingId` and `leadForm` but never opens the modal. Add `setIsLeadModalOpen(true)` at the end:
```tsx
function startEdit(lead: Lead) {
  setEditingId(lead.id);
  setSelectedLeadId(lead.id);
  setLeadForm({ /* ... existing fields ... */ });
  setIsLeadModalOpen(true);  // ADD THIS LINE
}
```

- [ ] **Step 4: Replace card list with table**

Find the `leads.map(...)` section rendering `<article>` cards. Replace the entire left column `<div className="space-y-4">` content with:

```tsx
<div className="overflow-x-auto rounded-2xl border border-slate-200">
  <table className="min-w-full text-sm">
    <thead>
      <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
        <th className="px-4 py-3">Lead #</th>
        <th className="px-4 py-3">Name</th>
        <th className="px-4 py-3">Status</th>
        <th className="px-4 py-3">Priority</th>
        <th className="px-4 py-3">Travel Date</th>
        <th className="px-4 py-3">Actions</th>
      </tr>
    </thead>
    <tbody>
      {filteredLeads.length === 0 ? (
        <tr>
          <td colSpan={6} className="px-4 py-6 text-center text-slate-500">No leads found.</td>
        </tr>
      ) : null}
      {filteredLeads.map((lead, i) => (
        <tr
          key={lead.id}
          className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${lead.id === selectedLeadId ? 'ring-1 ring-inset ring-sky-300' : ''}`}
        >
          <td className="px-4 py-3 font-mono text-xs text-slate-500">{lead.lead_number}</td>
          <td className="px-4 py-3 font-medium text-slate-900">{getLeadLabel(lead)}</td>
          <td className="px-4 py-3">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {lead.status.replace(/_/g, ' ')}
            </span>
          </td>
          <td className="px-4 py-3 text-slate-600 capitalize">{lead.priority}</td>
          <td className="px-4 py-3 text-slate-600">{lead.travel_date ? formatDate(lead.travel_date) : '-'}</td>
          <td className="px-4 py-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedLeadId(lead.id === selectedLeadId ? null : lead.id)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700"
              >
                Follow-ups
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => startEdit(lead)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700"
                >
                  Edit
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteLead(lead)}
                  className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

- [ ] **Step 5: Add filter bar above the table**

Above the table div, add:
```tsx
<div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
  <input
    type="text"
    placeholder="Search name..."
    value={filterName}
    onChange={(e) => setFilterName(e.target.value)}
    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
  />
  <select
    value={filterStatus}
    onChange={(e) => setFilterStatus(e.target.value)}
    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
  >
    <option value="">All Statuses</option>
    {leadStatusOptions.map((s) => (
      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
    ))}
  </select>
  <input
    type="date"
    value={filterFrom}
    onChange={(e) => setFilterFrom(e.target.value)}
    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
    title="Travel date from"
  />
  <input
    type="date"
    value={filterTo}
    onChange={(e) => setFilterTo(e.target.value)}
    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
    title="Travel date to"
  />
</div>
```

- [ ] **Step 6: Manual test**
  - List shows slim table with 6 columns and alternating row bands.
  - Filters narrow the list in real time.
  - Clicking Edit opens the Modal popup.
  - Follow-ups panel still works when a row is selected.

- [ ] **Step 7: Commit**
```bash
git add src/components/Leads/LeadList.tsx
git commit -m "feat(leads): slim table list, filters, fix edit-opens-modal"
```

---

## Task 4: Rate Charts — slim list + active toggle

**Files:**
- Modify: `src/components/RateCharts/RateChartList.tsx`

**What to change:**
Replace the current layout with a flat table: Name, Customer, Effective From, Effective To, Active toggle, Actions. All sub-actions (packages, routes, etc.) continue to use the existing Modal. The edit form already uses Modal — no change needed there.

- [ ] **Step 1: Read the full render section of RateChartList.tsx**

Run: read `src/components/RateCharts/RateChartList.tsx` from line 60 onwards to understand the current list rendering.

- [ ] **Step 2: Add handleToggleActive function**

After `loadCharts` (or wherever data loading functions are), add:
```tsx
async function handleToggleActive(chart: RateChartSummary) {
  try {
    await api.put(`/rate-charts/${chart.id}`, { is_active: !chart.is_active });
    await loadCharts();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unable to update status.');
  }
}
```

- [ ] **Step 3: Replace list rendering with table**

Find the section that maps over `rateCharts` (likely rendering cards or rows). Replace with:
```tsx
<div className="overflow-x-auto rounded-2xl border border-slate-200">
  <table className="min-w-full text-sm">
    <thead>
      <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
        <th className="px-4 py-3">Name</th>
        <th className="px-4 py-3">Customer</th>
        <th className="px-4 py-3">Effective From</th>
        <th className="px-4 py-3">Effective To</th>
        <th className="px-4 py-3">Active</th>
        <th className="px-4 py-3">Actions</th>
      </tr>
    </thead>
    <tbody>
      {rateCharts.length === 0 ? (
        <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No rate charts yet.</td></tr>
      ) : null}
      {rateCharts.map((chart, i) => (
        <tr key={chart.id} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
          <td className="px-4 py-3 font-medium text-slate-900">{chart.name}</td>
          <td className="px-4 py-3 text-slate-600">{chart.customer?.name ?? '-'}</td>
          <td className="px-4 py-3 text-slate-600">{formatDate(chart.effective_from)}</td>
          <td className="px-4 py-3 text-slate-600">{chart.effective_to ? formatDate(chart.effective_to) : '—'}</td>
          <td className="px-4 py-3">
            {canManage ? (
              <button
                type="button"
                onClick={() => void handleToggleActive(chart)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  chart.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  chart.is_active ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            ) : (
              <span className={chart.is_active ? 'text-emerald-600' : 'text-slate-400'}>
                {chart.is_active ? 'Active' : 'Inactive'}
              </span>
            )}
          </td>
          <td className="px-4 py-3">
            <div className="flex gap-2">
              {canManage ? (
                <button type="button" onClick={() => startEdit(chart)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">Edit</button>
              ) : null}
              <button type="button" onClick={() => void loadChartDetail(chart.id)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">View</button>
              {canManage ? (
                <button type="button" onClick={() => void handleDuplicate(chart)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">Duplicate</button>
              ) : null}
              {canManage ? (
                <button type="button" onClick={() => setDeleteTarget(chart)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700">Delete</button>
              ) : null}
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

Note: You'll need to check what functions already exist (`startEdit`, `loadChartDetail`, `handleDuplicate`) by reading lines 60–150 of `RateChartList.tsx` before this step.

- [ ] **Step 4: Manual test**
  - Rate Charts page shows flat table.
  - Active toggle switches chart active/inactive immediately.
  - Edit opens Modal popup.
  - View/Duplicate/Delete still work.

- [ ] **Step 5: Commit**
```bash
git add src/components/RateCharts/RateChartList.tsx
git commit -m "feat(rate-charts): slim table list with active toggle"
```

---

## Task 5: Tax Config — slim list + active toggle + filters

**Files:**
- Modify: `src/components/TaxConfig/TaxComponentList.tsx`

**What to change:**
Replace current display with table: Name, Mode, Rate, Applies To, Active toggle, Actions. Remove Code column from list (still in edit form). Add filters: Name, Date Range (if components have dates; if not, just Name filter).

- [ ] **Step 1: Read the full render section of TaxComponentList.tsx** (line 60 onwards)

- [ ] **Step 2: Add filter state + handleToggleActive**

```tsx
const [filterName, setFilterName] = useState('');

async function handleToggleActive(component: TaxComponent) {
  try {
    await api.put(`/tax-components/${component.id}`, { ...component, is_active: !component.is_active });
    await loadComponents();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unable to update status.');
  }
}

const filteredComponents = useMemo(() => {
  return components.filter((c) =>
    !filterName || c.name.toLowerCase().includes(filterName.toLowerCase())
  );
}, [components, filterName]);
```

Note: TaxComponent does not have a date field — skip date range filter for this page.

- [ ] **Step 3: Add filter bar + replace list with table**

```tsx
{/* Filter bar */}
<div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
  <input
    type="text"
    placeholder="Search name..."
    value={filterName}
    onChange={(e) => setFilterName(e.target.value)}
    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
  />
</div>

{/* Table */}
<div className="overflow-x-auto rounded-2xl border border-slate-200">
  <table className="min-w-full text-sm">
    <thead>
      <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
        <th className="px-4 py-3">Name</th>
        <th className="px-4 py-3">Mode</th>
        <th className="px-4 py-3">Rate</th>
        <th className="px-4 py-3">Applies To</th>
        <th className="px-4 py-3">Active</th>
        <th className="px-4 py-3">Actions</th>
      </tr>
    </thead>
    <tbody>
      {filteredComponents.map((c, i) => (
        <tr key={c.id} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
          <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
          <td className="px-4 py-3 capitalize text-slate-600">{c.mode}</td>
          <td className="px-4 py-3 text-slate-600">
            {c.mode === 'percentage' ? `${c.rate}%` : `₹${c.flat_amount}`}
          </td>
          <td className="px-4 py-3 text-slate-600">{c.applies_to.replace(/_/g, ' ')}</td>
          <td className="px-4 py-3">
            <button
              type="button"
              onClick={() => void handleToggleActive(c)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                c.is_active ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                c.is_active ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </td>
          <td className="px-4 py-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => startEdit(c)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">Edit</button>
              <button type="button" onClick={() => setDeleteTarget(c)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700">Delete</button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

Note: Check existing `startEdit` function name in the file — rename references accordingly.

- [ ] **Step 4: Manual test** — table renders, toggle works, filter narrows list, edit modal opens.

- [ ] **Step 5: Commit**
```bash
git add src/components/TaxConfig/TaxComponentList.tsx
git commit -m "feat(tax-config): slim table, active toggle, name filter"
```

---

## Task 6: Fleet Master (Vehicles) — slim list + active toggle + filters

**Files:**
- Modify: `src/components/Vehicles/VehicleList.tsx`

**What to change:**
Table columns: Name (make+model), Number, Type, Category, Owner, Active toggle, Actions. Filters: Name, Owner (dropdown), Number, Type (dropdown).

- [ ] **Step 1: Read VehicleList.tsx from line 60 onwards**

- [ ] **Step 2: Add filter state + handleToggleActive**

```tsx
const [filterName, setFilterName] = useState('');
const [filterNumber, setFilterNumber] = useState('');
const [filterType, setFilterType] = useState('');
const [filterOwnerId, setFilterOwnerId] = useState('');

async function handleToggleActive(vehicle: Vehicle) {
  try {
    await api.put(`/vehicles/${vehicle.id}`, { ...vehicle, is_active: !vehicle.is_active });
    await loadVehicles();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unable to update status.');
  }
}

const filteredVehicles = useMemo(() => {
  return vehicles.filter((v) => {
    const displayName = `${v.make ?? ''} ${v.model ?? ''}`.toLowerCase();
    if (filterName && !displayName.includes(filterName.toLowerCase())) return false;
    if (filterNumber && !v.vehicle_number.toLowerCase().includes(filterNumber.toLowerCase())) return false;
    if (filterType && v.vehicle_type !== filterType) return false;
    if (filterOwnerId && v.owner_id !== filterOwnerId) return false;
    return true;
  });
}, [vehicles, filterName, filterNumber, filterType, filterOwnerId]);
```

Note: Check `Vehicle` type in `src/lib/types.ts` to confirm field names (`make`, `model`, `vehicle_type`, `owner_id`).

- [ ] **Step 3: Add filter bar + table** (follow same table pattern as Tasks 4/5)

Columns: Make/Model, Number, Type, Category, Owner, Active, Actions.

- [ ] **Step 4: Manual test** — filters work, toggle works, edit modal opens.

- [ ] **Step 5: Commit**
```bash
git add src/components/Vehicles/VehicleList.tsx
git commit -m "feat(vehicles): slim table list, active toggle, filters"
```

---

## Task 7: Vehicle Categories — slim list + active toggle + filter

**Files:**
- Modify: `src/components/VehicleCategories/VehicleCategoryList.tsx`

**What to change:**
Table columns: Name, Description, Active toggle, Actions. Filter: Name.

- [ ] **Step 1: Add filter state + handleToggleActive**

```tsx
const [filterName, setFilterName] = useState('');

async function handleToggleActive(cat: VehicleCategory) {
  try {
    await api.put(`/vehicle-categories/${cat.id}`, { ...cat, is_active: !cat.is_active });
    await loadCategories();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unable to update status.');
  }
}

const filteredCategories = useMemo(() => {
  return categories.filter((c) =>
    !filterName || c.name.toLowerCase().includes(filterName.toLowerCase())
  );
}, [categories, filterName]);
```

Add `useMemo` to imports if not already there.

- [ ] **Step 2: Add filter bar + table**

```tsx
{/* Filter */}
<input type="text" placeholder="Search name..." value={filterName}
  onChange={(e) => setFilterName(e.target.value)}
  className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />

{/* Table */}
<div className="overflow-x-auto rounded-2xl border border-slate-200">
  <table className="min-w-full text-sm">
    <thead>
      <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
        <th className="px-4 py-3">Name</th>
        <th className="px-4 py-3">Description</th>
        <th className="px-4 py-3">Active</th>
        <th className="px-4 py-3">Actions</th>
      </tr>
    </thead>
    <tbody>
      {filteredCategories.map((cat, i) => (
        <tr key={cat.id} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
          <td className="px-4 py-3 font-medium text-slate-900">{cat.name}</td>
          <td className="px-4 py-3 text-slate-600">{cat.description ?? '-'}</td>
          <td className="px-4 py-3">
            <button type="button" onClick={() => void handleToggleActive(cat)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cat.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${cat.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </td>
          <td className="px-4 py-3">
            <div className="flex gap-2">
              {canManage ? <button type="button" onClick={() => startEdit(cat)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">Edit</button> : null}
              {canManage ? <button type="button" onClick={() => setDeleteTarget(cat)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700">Delete</button> : null}
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

- [ ] **Step 3: Manual test** — filter, toggle, edit modal.

- [ ] **Step 4: Commit**
```bash
git add src/components/VehicleCategories/VehicleCategoryList.tsx
git commit -m "feat(vehicle-categories): slim table, active toggle, filter"
```

---

## Task 8: Customers — slim list + active toggle + filters

**Files:**
- Modify: `src/components/Customers/CustomerList.tsx`

**What to change:**
Remove from list: GST/PAN, Credit, Duty Defaults, Invoice PDF. Keep: Code, Name, Contact Person, Phone, City, Active toggle. Add filters: Name, City. Edit modal is already Modal-based.

- [ ] **Step 1: Read CustomerList.tsx from line 60 onwards to find list rendering and any existing toggleActive**

- [ ] **Step 2: Add filter state + handleToggleActive**

```tsx
const [filterName, setFilterName] = useState('');
const [filterCity, setFilterCity] = useState('');

async function handleToggleActive(customer: Customer) {
  try {
    await api.put(`/customers/${customer.id}`, { ...customer, is_active: !customer.is_active });
    await loadCustomers();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unable to update status.');
  }
}

const filteredCustomers = useMemo(() => {
  return customers.filter((c) => {
    if (filterName && !c.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterCity && !(c.city ?? '').toLowerCase().includes(filterCity.toLowerCase())) return false;
    return true;
  });
}, [customers, filterName, filterCity]);
```

- [ ] **Step 3: Replace list rendering with table**

Columns: Code, Name, Contact, Phone, City, Active, Actions.

- [ ] **Step 4: Commit**
```bash
git add src/components/Customers/CustomerList.tsx
git commit -m "feat(customers): slim table, active toggle, filters"
```

---

## Task 9: Drivers — slim list + active toggle + filters

**Files:**
- Modify: `src/components/Drivers/DriverList.tsx`

**What to change:**
Remove from list: PAN/Aadhaar, Night Halt, OT/Hour, Expiry. Keep: Code, Name, Phone, License #, Active toggle. Filters: Name, Phone.

- [ ] **Step 1: Read DriverList.tsx from line 50 onwards**

- [ ] **Step 2: Add filter state + handleToggleActive + filteredDrivers** (same pattern as Tasks 6–8)

- [ ] **Step 3: Table columns:** Code, Name, Phone, License #, Active, Actions.

- [ ] **Step 4: Commit**
```bash
git add src/components/Drivers/DriverList.tsx
git commit -m "feat(drivers): slim table, active toggle, filters"
```

---

## Task 10: Vehicle Owners — slim list + active toggle + filters

**Files:**
- Modify: `src/components/Owners/OwnerList.tsx`

**What to change:**
Keep in list: Code, Name, Contact Person, Phone, City, Active toggle. Filters: Name, City.

- [ ] **Step 1: Read OwnerList.tsx from line 50 onwards**

- [ ] **Step 2: Add filter state + handleToggleActive + filteredOwners** (same pattern)

- [ ] **Step 3: Table columns:** Code, Name, Contact, Phone, City, Active, Actions.

- [ ] **Step 4: Commit**
```bash
git add src/components/Owners/OwnerList.tsx
git commit -m "feat(owners): slim table, active toggle, filters"
```

---

## Task 11: Invoices — checkbox selection + bulk download + PDF in Actions

**Files:**
- Modify: `src/components/Invoices/InvoiceList.tsx`

**What to change:**
1. Add per-row checkbox. Track `selectedIds: Set<string>` state.
2. Move individual PDF download into the Actions column dropdown/button.
3. Add "Download Selected" bulk action button (appears when 1+ selected).
4. Remove "Mark Overdue" as standalone button — fold into Actions per row.

- [ ] **Step 1: Read InvoiceList.tsx from line 60 onwards to understand full render structure**

- [ ] **Step 2: Add checkbox selection state**

```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

function toggleSelect(id: string) {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function toggleSelectAll() {
  if (selectedIds.size === invoices.length) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(invoices.map((inv) => inv.id)));
  }
}
```

- [ ] **Step 3: Add bulk download function**

```tsx
async function handleBulkDownload() {
  for (const id of selectedIds) {
    await handleDownloadPdf(id);  // reuse existing download function — check its actual name in the file
  }
}
```

- [ ] **Step 4: Add checkbox column to table header and rows**

In `<thead>`, add first column:
```tsx
<th className="px-4 py-3">
  <input type="checkbox"
    checked={selectedIds.size === invoices.length && invoices.length > 0}
    onChange={toggleSelectAll}
    className="rounded"
  />
</th>
```

In each row, add first cell:
```tsx
<td className="px-4 py-3">
  <input type="checkbox"
    checked={selectedIds.has(invoice.id)}
    onChange={() => toggleSelect(invoice.id)}
    className="rounded"
  />
</td>
```

- [ ] **Step 5: Add bulk download bar (shows when selection > 0)**

Above the table, conditionally render:
```tsx
{selectedIds.size > 0 ? (
  <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2">
    <span className="text-sm text-sky-700">{selectedIds.size} selected</span>
    <button type="button" onClick={() => void handleBulkDownload()}
      className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">
      Download Selected PDFs
    </button>
    <button type="button" onClick={() => setSelectedIds(new Set())}
      className="text-xs text-slate-500">Clear</button>
  </div>
) : null}
```

- [ ] **Step 6: Move PDF download and Mark Overdue into Actions column**

Find existing PDF download button and Mark Overdue button. Remove them from wherever they are (standalone buttons or separate columns) and add them to the Actions cell alongside Edit/Delete:
```tsx
<button type="button" onClick={() => void handleDownloadPdf(invoice.id)}
  className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">PDF</button>
<button type="button" onClick={() => void handleMarkOverdue(invoice.id)}
  className="rounded-lg border border-amber-200 px-2 py-1 text-xs text-amber-700">Mark Overdue</button>
```

Note: Check actual function names in the file before this step.

- [ ] **Step 7: Manual test** — checkboxes select rows, bulk download fires, PDF and Mark Overdue are in Actions column.

- [ ] **Step 8: Commit**
```bash
git add src/components/Invoices/InvoiceList.tsx
git commit -m "feat(invoices): checkbox selection, bulk download, PDF in actions"
```

---

## Task 12: Vendor Invoices (OwnerSettlements) — card to flat table

**Files:**
- Modify: `src/components/Settlements/OwnerSettlements.tsx`

**What to change:**
Replace card/block layout with flat table. Columns: Settlement #, Owner, Vehicle, Period, Total, Net, Status, Actions.

- [ ] **Step 1: Read OwnerSettlements.tsx from line 80 onwards to find list rendering**

- [ ] **Step 2: Replace card rendering with table**

```tsx
<div className="overflow-x-auto rounded-2xl border border-slate-200">
  <table className="min-w-full text-sm">
    <thead>
      <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
        <th className="px-4 py-3">Settlement #</th>
        <th className="px-4 py-3">Owner</th>
        <th className="px-4 py-3">Vehicle</th>
        <th className="px-4 py-3">Period</th>
        <th className="px-4 py-3">Total</th>
        <th className="px-4 py-3">Net</th>
        <th className="px-4 py-3">Status</th>
        <th className="px-4 py-3">Actions</th>
      </tr>
    </thead>
    <tbody>
      {settlements.map((s, i) => (
        <tr key={s.id} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
          <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.settlement_number}</td>
          <td className="px-4 py-3 font-medium text-slate-900">{s.owner?.name ?? '-'}</td>
          <td className="px-4 py-3 text-slate-600">{s.vehicle?.vehicle_number ?? '-'}</td>
          <td className="px-4 py-3 text-slate-600">{formatDate(s.period_from)} – {formatDate(s.period_to)}</td>
          <td className="px-4 py-3 text-slate-600">{formatCurrency(s.total_amount)}</td>
          <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(s.net_amount)}</td>
          <td className="px-4 py-3 capitalize text-slate-600">{s.status.replace(/_/g, ' ')}</td>
          <td className="px-4 py-3">
            <div className="flex gap-2">
              {canManage ? <button type="button" onClick={() => startEdit(s)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">Edit</button> : null}
              {/* PDF download button if it exists */}
              {canManage ? <button type="button" onClick={() => setDeleteTarget(s)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700">Delete</button> : null}
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

Note: Check `OwnerSettlement` type for actual field names (`owner`, `vehicle`, `settlement_number`, etc.) before implementing.

- [ ] **Step 3: Manual test** — list renders as flat table, all actions work.

- [ ] **Step 4: Commit**
```bash
git add src/components/Settlements/OwnerSettlements.tsx
git commit -m "feat(vendor-invoices): flat table list replacing card layout"
```

---

## Final Verification

- [ ] Run `npm run typecheck` from project root — zero errors.
- [ ] Visually verify each page: headers bold+background, alternating rows, toggles work, filters narrow results, modals open/close correctly.
- [ ] Final commit if any cleanup needed:
```bash
git commit -m "chore(ui): post-overhaul cleanup"
```
