# PDF Overflow & Alignment Fixes

## Context
All five PDF generators have structural bugs causing content to overflow outside boxes and off-page. The most severe bug draws table rows onto the wrong page entirely when page breaks occur. Secondary bugs cause text to spill out of info boxes and section boxes. The user wants all PDFs to be well-aligned, professional, and fully overflow-free.

---

## Root Cause Analysis

### Bug 1 — CRITICAL: Page-break `y` tracking in table loops
**Files:** `pdf-duty-slip.ts` (3 tables), `pdf-settlement.ts` (1 table), `pdf-invoice.ts` (1 table)

All broken tables use a local `y` variable to track vertical drawing position and call `ensureSpace(doc, ...)` inside the row loop. When `ensureSpace` adds a new page, `doc.y` resets to the top margin (~40pt), but the local `y` variable still holds the old bottom-of-page value (e.g., 790pt). The next row is drawn at y=790 on the new page — completely off the visible area.

**Note:** `pdf-invoice-gt.ts`'s `drawItemTable` already uses the correct pattern (`bottomLimit` comparison + `doc.addPage()` + `y = drawTableHeader(...)`) — this is the reference to replicate everywhere.

### Bug 2 — SERIOUS: `drawInfoBox` fixed row height ignores text wrapping
**Files:** All five files

Current formula: `contentHeight = Math.max(N, 18 + rows.length * rowPx)` — assumes each row is exactly one line tall. If a value (e.g., billing address, customer name) wraps, text overflows the box bottom.

Fix: Measure each row's actual height with `doc.heightOfString(row.value, { width: innerWidth })` and accumulate.

### Bug 3 — SERIOUS: Notes section sequential `doc.y` positioning bug
**File:** `pdf-invoice-gt.ts` lines 333-349

Three consecutive `doc.text(text, x, doc.y + offset)` calls where `doc.y` shifts after each call. The +30 and +48 offsets are applied to an already-advanced `doc.y`, causing the second and third lines to render far below the Notes box.

Fix: Save `const sectionY = doc.y` before drawing the box, then use `sectionY + offset` for all text calls.

### Bug 4 — MODERATE: Hardcoded `doc.y` offsets after `drawInfoBox`
**Files:** `pdf-invoice-gt.ts` (line 359: `bankTop + 100`), `pdf-settlement.ts` (lines 304 and 370: `bankTop + 92`), `pdf-invoice.ts` (line 306: `bankTop + 92`)

These fixed offsets are often LESS than the actual box height, causing the next element to overlap the bank details box.

Fix: Use the height returned by `drawInfoBox`: `doc.y = bankTop + bankBoxHeight + 12`.

### Bug 5 — MODERATE: Internal duty slip Remarks box hardcoded at 56px
**File:** `pdf-duty-slip.ts` lines 405-413

Box is drawn at fixed 56px; long remarks overflow it. Also uses `doc.y + 12` for text position after `roundedRect` draws (which shifts `doc.y`).

Fix: Calculate height from `doc.heightOfString`, save `remarksY = doc.y` before drawing.

### Bug 6 — MINOR: Amount In Words box hardcoded at 44px
**File:** `pdf-invoice-gt.ts` line 327

Large invoice totals produce long word strings that wrap and overflow.

Fix: Dynamic height from `doc.heightOfString`.

### Bug 7 — MINOR: External remarks uses character-count line estimate
**File:** `pdf-duty-slip.ts` line 657

`Math.ceil(remarks.length / 90)` doesn't account for variable character widths.

Fix: Use `doc.heightOfString` to derive actual line count.

---

## File-by-File Changes

### `pdf-duty-slip.ts`

**`drawInfoBox`** (line 192)
- Replace `Math.max(88, 18 + rows.length * 26)` with per-row `doc.heightOfString`-based calculation (Bug 2)

**`drawMetricsTable`** (lines 247-281)
- Remove `ensureSpace(doc, rowHeight + 20)` call from inside the `forEach` loop
- Add `const bottomLimit = doc.page.height - doc.page.margins.bottom;` before loop
- Replace with: `if (y + rowHeight > bottomLimit) { doc.addPage(); y = drawTableHeader(doc, headers, widths, startX, doc.y); }` (Bug 1)

**`drawAmountTable`** (lines 291-307)
- Same Bug 1 fix pattern as `drawMetricsTable`

**`drawExternalExpensesTable`** (lines 561-611)
- Same Bug 1 fix for expense rows loop
- Also fix the total row guard: replace `ensureSpace(doc, totalHeight + 20)` with direct `bottomLimit` check (Bug 1)

**Internal Remarks box** (lines 405-413)
- Save `const remarksY = doc.y` before `roundedRect`
- Calculate `remarksBoxHeight = Math.max(40, doc.heightOfString(remarks, { width }) + 24)`
- Draw rect at `remarksY`, text at `remarksY + 12`, advance `doc.y = remarksY + remarksBoxHeight + 8` (Bug 5)

**`drawExternalRemarks`** (line 657)
- Replace character-count estimate with `doc.heightOfString`-based calculation (Bug 7)

---

### `pdf-invoice-gt.ts`

**`drawInfoBox`** (line 115)
- Same Bug 2 fix as duty slip (Bug 2)

**Amount In Words** (lines 326-331)
- Calculate `amountBoxHeight = Math.max(44, doc.heightOfString(text, { width }) + 28)`
- Save `const amtY = doc.y`, draw rect at `amtY`, text at `amtY + 14`, advance to `amtY + amountBoxHeight + 8` (Bug 6)

**Notes section** (lines 333-349)
- Save `const sectionY = doc.y` before the rounded rect
- Calculate dynamic box height by summing line heights for payment terms, interest note, and optional remarks
- Use `sectionY + offset` for all text draws, not `doc.y + offset`
- Advance `doc.y = sectionY + notesHeight + 8` (Bug 3)

**Bank Details** (lines 351-360)
- `const bankBoxHeight = drawInfoBox(...); doc.y = bankTop + bankBoxHeight + 12;` (Bug 4)

---

### `pdf-settlement.ts`

**`drawInfoBox`** (line 107)
- Same Bug 2 fix (Bug 2)

**`drawTripsTable`** (lines 150-191)
- Same Bug 1 fix pattern: `bottomLimit` + `doc.addPage()` + header redraw on new page (Bug 1)

**Both `bankTop + 92` occurrences** (lines 304, 370 in driver and owner functions)
- `const bankBoxHeight = drawInfoBox(...); doc.y = bankTop + bankBoxHeight + 12;` (Bug 4)

---

### `pdf-annexure.ts`

**`drawInfoBox`** (line 81)
- Same Bug 2 fix (Bug 2)
- No page-break table bugs (annexure is always single-page)

---

### `pdf-invoice.ts`

**`drawInfoBox`** (line 88)
- Same Bug 2 fix (Bug 2)

**`drawInvoiceTable`** (lines 131-176)
- Same Bug 1 fix: replace `ensureSpace` inside loop with `bottomLimit` comparison + header redraw (Bug 1)

**Bank Details** (line 306)
- `const bankBoxHeight = drawInfoBox(...); doc.y = bankTop + bankBoxHeight + 12;` (Bug 4)

---

## `drawInfoBox` Fix Pattern (apply identically in all five files)

```ts
function drawInfoBox(doc, x, y, width, title, rows): number {
  const innerWidth = width - 24;

  // Measure actual height per row before drawing anything
  doc.font('Helvetica').fontSize(10);  // set font to value font for accurate measurement
  const rowHeights = rows.map((row) =>
    Math.max(26, 9 + doc.heightOfString(row.value, { width: innerWidth }) + 8)
  );

  const totalRowHeight = rowHeights.reduce((a, b) => a + b, 0);
  const contentHeight = Math.max(60, 36 + totalRowHeight + 8);

  doc.save();
  doc.roundedRect(x, y, width, contentHeight, 8).lineWidth(1).stroke('#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(title, x + 12, y + 10, { width: innerWidth });
  doc.moveTo(x + 12, y + 28).lineTo(x + width - 12, y + 28).stroke('#e2e8f0');

  let rowY = y + 36;
  rows.forEach((row, i) => {
    // draw label + value (existing drawLabelValue call or inline equivalent)
    rowY += rowHeights[i];
  });
  doc.restore();

  return contentHeight;
}
```

## Table Page-Break Fix Pattern (apply to all broken tables)

```ts
// BEFORE the forEach loop:
const bottomLimit = doc.page.height - doc.page.margins.bottom;
let y = drawTableHeader(doc, headers, widths, startX, doc.y);

// INSIDE the forEach loop, REPLACE ensureSpace call with:
if (y + rowHeight > bottomLimit) {
  doc.addPage();
  y = drawTableHeader(doc, headers, widths, startX, doc.y);
}
// Then draw row cells using local `y` as before
```

---

## Implementation Order

1. Fix all `drawInfoBox` functions (5 files, same change) — Bug 2
2. Fix table page-break loops (duty slip ×3, settlement ×1, invoice ×1) — Bug 1
3. Fix Notes section in GT invoice — Bug 3
4. Fix all hardcoded `bankTop + N` offsets — Bug 4
5. Fix Remarks box in internal duty slip — Bug 5
6. Fix Amount in Words box in GT invoice — Bug 6
7. Fix external remarks line count — Bug 7

---

## Verification

After changes, test each PDF by downloading via UI or direct API:
- `GET /api/trips/:id/pdf/internal` — check metrics table paginates correctly with header repeat
- `GET /api/trips/:id/pdf/closed_external` — check expenses table and remarks line wrapping
- `GET /api/invoices/:id/pdf` (GT) — check Notes section alignment, Amount In Words box, info boxes
- `GET /api/settlements/owners/:id/pdf` — check trips table page break and bank details gap
- `GET /api/settlements/drivers/:id/pdf` — same
- `GET /api/annexures/:id/pdf` — check long customer name doesn't overflow Annexure Identity box
- Standard invoice: `GET /api/invoices/:id/pdf` (non-GT) — check item table breaks and bank details

Test with real data that includes: long customer addresses, many trip rows (>20), long remarks, large invoice amounts.
