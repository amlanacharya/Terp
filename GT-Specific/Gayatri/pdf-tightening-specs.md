# PDF Tightening Specification

## Summary

Standardize all server-side PDF generators so long content wraps inside its boxes, table sections
paginate safely, and post-section spacing is driven by rendered height instead of hardcoded pixel
offsets.

Scope is limited to layout correctness and presentation stability in these files:

- `server/src/utils/pdf-duty-slip.ts`
- `server/src/utils/pdf-invoice-gt.ts`
- `server/src/utils/pdf-settlement.ts`
- `server/src/utils/pdf-annexure.ts`
- `server/src/utils/pdf-invoice.ts`

No route contracts, business rules, or document copy change in this phase unless required to keep
rendered content aligned.

## Locked Fixes

### 1. Dynamic info-box heights in all five generators

Every `drawInfoBox()` implementation must stop assuming one fixed row height per field.

Required behavior:

- measure label/value text heights before drawing
- size each row from actual wrapped text height
- return the true rendered box height
- advance the next section using the larger of the sibling box heights

This applies to:

- customer / bill-to boxes
- invoice / snapshot boxes
- bank details boxes
- annexure identity boxes
- settlement party / payment boxes
- duty-slip party / rate-source boxes

### 2. Safe table pagination in broken table loops

Broken loops that currently call `ensureSpace()` inside the row loop must switch to explicit
`bottomLimit` checks tied to the local row cursor.

Required pattern:

- compute `const bottomLimit = doc.page.height - doc.page.margins.bottom`
- before drawing each row, check `if (y + rowHeight > bottomLimit)`
- on overflow, `doc.addPage()` and redraw the table header
- continue drawing the row at the new page header position

Files / tables:

- `pdf-duty-slip.ts`
  - `drawMetricsTable`
  - `drawAmountTable`
  - `drawExternalExpensesTable`
- `pdf-settlement.ts`
  - `drawTripsTable`
- `pdf-invoice.ts`
  - `drawInvoiceTable`

### 3. GT invoice note sections must use stable anchors

`pdf-invoice-gt.ts` must stop positioning multiple note lines off the mutating `doc.y`.

Required behavior:

- save a section anchor before drawing the notes box
- compute dynamic height for payment terms, interest note, and optional remarks
- render each line from a local `textY` cursor
- advance `doc.y` from the saved section anchor plus the real box height

### 4. Remove hardcoded post-bank offsets

The next section after bank details must use the `drawInfoBox()` return value, not a constant like
`bankTop + 92` or `bankTop + 100`.

Files:

- `pdf-invoice-gt.ts`
- `pdf-settlement.ts`
- `pdf-invoice.ts`

### 5. Remarks and amount-in-words boxes must grow with content

Specific wrapped-text fixes:

- `pdf-duty-slip.ts`
  - internal remarks box height from `heightOfString`
  - external remarks line count from `heightOfString`, not character-count heuristics
- `pdf-invoice-gt.ts`
  - amount-in-words box height from `heightOfString`

## File-Specific Expectations

### `server/src/utils/pdf-duty-slip.ts`

- dynamic `drawInfoBox()`
- correct page-break/header redraw in metrics, amount, and external-expense tables
- dynamic internal remarks box
- external remarks line count derived from measured text height

### `server/src/utils/pdf-invoice-gt.ts`

- dynamic `drawInfoBox()`
- dynamic amount-in-words box
- notes box rendered from a stable `sectionY` anchor
- bank-details follow-up spacing uses the returned info-box height

### `server/src/utils/pdf-settlement.ts`

- dynamic `drawInfoBox()`
- correct page-break/header redraw in the trips table
- both bank-details follow-up spacings use returned info-box height

### `server/src/utils/pdf-annexure.ts`

- dynamic `drawInfoBox()` only

### `server/src/utils/pdf-invoice.ts`

- dynamic `drawInfoBox()`
- correct page-break/header redraw in the line-items table
- bank-details follow-up spacing uses returned info-box height

## Acceptance Checks

- Long customer names and addresses do not spill out of info boxes.
- Multi-page duty-slip, settlement, and standard-invoice tables redraw headers on each page and
  never render rows off-page.
- GT invoice notes stay inside the notes box regardless of remarks length.
- GT invoice amount-in-words stays inside its box for large totals.
- Internal duty-slip remarks and closed external duty-slip remarks stay inside their sections.
- Bank-details sections do not overlap the footer or the next block in any PDF.
