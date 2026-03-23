# Credit Note Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs in the invoice void/credit note flow: (1) direct-trip orphan `invoice_items` blocking rebill after void, and (2) credit notes consuming invoice number series.

**Architecture:** Two independent fixes, each in its own worktree/branch. Task 1 modifies only the void handler in `invoices.routes.ts`. Task 2 modifies `invoice-gt.ts` (number generation) and adds a migration for the CN counter in `system_settings`. Both merge into `GT-Dev`.

**Tech Stack:** TypeScript, Express 4, PostgreSQL raw SQL (`pg`), no ORM. No test framework yet (Vitest when tests are added). Manual verification via curl / UI.

**Worktrees:**
- Task 1 → `.worktrees/fix-invoice-items-void` on branch `fix/invoice-items-void`
- Task 2 → `.worktrees/fix-cn-number-series` on branch `fix/cn-number-series`

---

## Task 1: Delete invoice_items on void (Issue 1 — Rebilling)

**Working directory:** `C:/travelerp/.worktrees/fix-invoice-items-void`

**Files:**
- Modify: `server/src/routes/invoices.routes.ts:984-997` (void handler, after annexure reset)

### Background

The void handler at line 984 queries `invoice_items` to collect annexure IDs, resets those annexures (`is_billed = false`), but never deletes the `invoice_items` rows for the voided invoice. These orphan rows can cause the trip to appear as still-billed in list filters. The fix: delete them after the annexure reset.

The exact block to modify (lines 984–997 in the file you'll be working in):

```typescript
// Unlink annexures so they can be re-billed
const itemResult = await client.query<{ annexure_id: string | null }>(
  'SELECT annexure_id FROM invoice_items WHERE invoice_id = $1',
  [invoiceId]
);
const annexureIds = Array.from(new Set(
  itemResult.rows.map((r) => r.annexure_id).filter((v): v is string => Boolean(v))
));
if (annexureIds.length > 0) {
  await client.query(
    'UPDATE annexures SET is_billed = false, invoice_id = NULL, updated_at = now() WHERE id = ANY($1::uuid[])',
    [annexureIds]
  );
}
```

- [ ] **Step 1: Read the void handler to confirm line numbers match**

  ```bash
  sed -n '980,1005p' server/src/routes/invoices.routes.ts
  ```

  Expected: you see the `SELECT annexure_id FROM invoice_items` query and the `UPDATE annexures` block, followed by `UPDATE invoices SET invoice_status = 'void'`.

- [ ] **Step 2: Add DELETE after the annexure reset**

  In `server/src/routes/invoices.routes.ts`, immediately after the `if (annexureIds.length > 0)` block (after line 997, before the `UPDATE invoices` at line 999), add:

  ```typescript
  // Remove invoice_items for the voided invoice so the trip becomes rebillable.
  // NOTE: $1 is invoiceId (the voided invoice), NOT the credit note ID.
  await client.query(
    'DELETE FROM invoice_items WHERE invoice_id = $1',
    [invoiceId]
  );
  ```

  The resulting block should look like:

  ```typescript
  // Unlink annexures so they can be re-billed
  const itemResult = await client.query<{ annexure_id: string | null }>(
    'SELECT annexure_id FROM invoice_items WHERE invoice_id = $1',
    [invoiceId]
  );
  const annexureIds = Array.from(new Set(
    itemResult.rows.map((r) => r.annexure_id).filter((v): v is string => Boolean(v))
  ));
  if (annexureIds.length > 0) {
    await client.query(
      'UPDATE annexures SET is_billed = false, invoice_id = NULL, updated_at = now() WHERE id = ANY($1::uuid[])',
      [annexureIds]
    );
  }

  // Remove invoice_items for the voided invoice so the trip becomes rebillable.
  // NOTE: $1 is invoiceId (the voided invoice), NOT the credit note ID.
  await client.query(
    'DELETE FROM invoice_items WHERE invoice_id = $1',
    [invoiceId]
  );
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd server && npm run build 2>&1 | tail -20
  ```

  Expected: no TypeScript errors. Build completes.

- [ ] **Step 4: Start the dev server and manually verify**

  ```bash
  cd server && npm run dev
  ```

  Then in the UI or via curl:

  1. Find a trip that has an active invoice (direct-billed, no annexures).
  2. Note the trip ID and invoice ID.
  3. Void the invoice via the Invoices UI (or `POST /api/invoices/:id/void`).
  4. Navigate to Trips. The "Bill Trip" button should reappear on that trip.
  5. Confirm in the DB: `SELECT * FROM invoice_items WHERE invoice_id = '<voided-invoice-id>';` → 0 rows.
  6. Confirm credit note's items are intact: `SELECT * FROM invoice_items WHERE invoice_id = '<credit-note-id>';` → row(s) present.

- [ ] **Step 5: Commit**

  ```bash
  git add server/src/routes/invoices.routes.ts
  git commit -m "fix(invoices): delete invoice_items on void so trip becomes rebillable"
  ```

---

## Task 2: Separate credit note number series (Issue 2 — CN Numbering)

**Working directory:** `C:/travelerp/.worktrees/fix-cn-number-series`

**Files:**
- Modify: `server/src/utils/invoice-gt.ts:136-143` (fix `generateInvoiceNumber`; add `generateCreditNoteNumber`)
- Modify: `server/src/routes/invoices.routes.ts:948-952` (use `generateCreditNoteNumber`)
- Create: `server/db/migrations/20260323_cn_sequence.sql`

### Background

`generateInvoiceNumber` (line 136–143 of `invoice-gt.ts`) counts all invoices matching `LIKE 'GT-INV-YYYY-%'`. Credit notes stored as `GT-INV-2025-00001-CN` match this pattern and inflate the count. Fix: add `AND invoice_type = 'invoice'` to the COUNT query.

Credit notes are currently numbered as `${inv.invoice_number}-CN` (line 952 of `invoices.routes.ts`). Fix: use a separate `cn_sequence_YYYY` counter in `system_settings`, locked with `FOR UPDATE` inside the transaction, and produce numbers like `GT-CN-2026-00001`.

### Part A — Migration: seed CN sequence counter

- [ ] **Step 1: Create the migration file**

  Create `server/db/migrations/20260323_cn_sequence.sql`:

  ```sql
  -- Add per-year credit note sequence counters to system_settings.
  -- The void handler reads and increments these with FOR UPDATE inside the transaction.
  INSERT INTO system_settings (setting_key, setting_value)
  VALUES
    ('cn_sequence_2024', '0'),
    ('cn_sequence_2025', '0'),
    ('cn_sequence_2026', '0')
  ON CONFLICT (setting_key) DO NOTHING;
  ```

- [ ] **Step 2: Run the migration**

  ```bash
  psql $DATABASE_URL -f server/db/migrations/20260323_cn_sequence.sql
  ```

  Expected: `INSERT 0 3` (or `INSERT 0 0` if already present — both are fine due to `ON CONFLICT DO NOTHING`).

- [ ] **Step 3: Verify in DB**

  ```bash
  psql $DATABASE_URL -c "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'cn_sequence_%' ORDER BY setting_key;"
  ```

  Expected:
  ```
  setting_key      | setting_value
  -----------------+--------------
  cn_sequence_2024 | 0
  cn_sequence_2025 | 0
  cn_sequence_2026 | 0
  ```

### Part B — Fix `generateInvoiceNumber` in invoice-gt.ts

- [ ] **Step 4: Edit `generateInvoiceNumber` (line 136–143)**

  In `server/src/utils/invoice-gt.ts`, change:

  ```typescript
  async function generateInvoiceNumber(db: Queryable, prefix: string): Promise<string> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM invoices WHERE invoice_number LIKE $1',
      [`${prefix}-%`]
    );

    return `${prefix}-${String(Number(result.rows[0]?.count || 0) + 1).padStart(5, '0')}`;
  }
  ```

  To:

  ```typescript
  async function generateInvoiceNumber(db: Queryable, prefix: string): Promise<string> {
    const result = await db.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM invoices WHERE invoice_number LIKE $1 AND invoice_type = 'invoice'",
      [`${prefix}-%`]
    );

    return `${prefix}-${String(Number(result.rows[0]?.count || 0) + 1).padStart(5, '0')}`;
  }
  ```

### Part C — Add `generateCreditNoteNumber` to invoice-gt.ts

- [ ] **Step 5: Add `generateCreditNoteNumber` after `generateInvoiceNumber`**

  In `server/src/utils/invoice-gt.ts`, after the closing brace of `generateInvoiceNumber` (after line 143), add:

  ```typescript
  export async function generateCreditNoteNumber(db: Queryable, prefix: string, year: number): Promise<string> {
    const key = `cn_sequence_${year}`;

    // Lock the row so concurrent voids cannot produce duplicate CN numbers.
    const lockResult = await db.query<{ setting_value: string }>(
      'SELECT setting_value FROM system_settings WHERE setting_key = $1 FOR UPDATE',
      [key]
    );

    if (!lockResult.rows[0]) {
      throw new Error(`Credit note sequence key "${key}" not found in system_settings. Run migration 20260323_cn_sequence.sql.`);
    }

    const next = Number(lockResult.rows[0].setting_value) + 1;

    await db.query(
      'UPDATE system_settings SET setting_value = $2, updated_at = now() WHERE setting_key = $1',
      [key, String(next)]
    );

    return `${prefix}-CN-${year}-${String(next).padStart(5, '0')}`;
  }
  ```

  > **Important:** `FOR UPDATE` only works inside a transaction. This function MUST be called from within an active `BEGIN`/`COMMIT` block — which the void handler already uses.

### Part D — Use `generateCreditNoteNumber` in the void handler

- [ ] **Step 6: Update the void handler import and usage**

  In `server/src/routes/invoices.routes.ts`:

  **6a.** Find the import of `invoice-gt.ts` utilities (search for `generateCreditNoteNumber` or look for the existing imports from `'../utils/invoice-gt'`). Add `generateCreditNoteNumber` to the import:

  ```typescript
  import { buildInterestNote, generateCreditNoteNumber, getGtInvoiceSettings } from '../utils/invoice-gt';
  ```

  The current import on line 6 is `import { buildInterestNote, getGtInvoiceSettings } from '../utils/invoice-gt';` — just add `generateCreditNoteNumber` to it. Do NOT add `createGtInvoice` (it is not used in this file).

  **6b.** Find line 948–952 in the void handler:

  ```typescript
  let creditNoteId: string | null = null;
  let creditNoteNumber: string | null = null;

  if (collectedAmount > 0) {
    creditNoteNumber = `${inv.invoice_number}-CN`;
  ```

  Replace `creditNoteNumber = \`${inv.invoice_number}-CN\`;` with:

  ```typescript
  const settings = await getGtInvoiceSettings(client);
  const currentYear = new Date().getFullYear();
  creditNoteNumber = await generateCreditNoteNumber(client, settings.invoice_prefix, currentYear);
  ```

  The resulting block:

  ```typescript
  let creditNoteId: string | null = null;
  let creditNoteNumber: string | null = null;

  if (collectedAmount > 0) {
    const settings = await getGtInvoiceSettings(client);
    const currentYear = new Date().getFullYear();
    creditNoteNumber = await generateCreditNoteNumber(client, settings.invoice_prefix, currentYear);
    const cnRemarks = `Credit note for refund received on voided invoice ${inv.invoice_number}.${reason ? ` Reason: ${reason}` : ''}`;
    // ... rest of CN insert unchanged
  ```

- [ ] **Step 7: Verify TypeScript compiles**

  ```bash
  cd server && npm run build 2>&1 | tail -20
  ```

  Expected: no errors.

- [ ] **Step 8: Start dev server and manually verify**

  ```bash
  cd server && npm run dev
  ```

  1. Find an invoice with a collected amount > 0.
  2. Void it via the UI or `POST /api/invoices/:id/void` with `{"reason": "test"}`.
  3. Check the response — `credit_note.invoice_number` should be `GT-CN-2026-00001` (not `GT-INV-...-CN`).
  4. Check DB: `SELECT setting_value FROM system_settings WHERE setting_key = 'cn_sequence_2026';` → `1`.
  5. Void another invoice with collected amount. Credit note should be `GT-CN-2026-00002`.
  6. Create a new regular invoice. Its number should NOT skip — it should be one above the last invoice (credit notes no longer inflate the count).

- [ ] **Step 9: Commit**

  ```bash
  git add server/src/utils/invoice-gt.ts \
          server/src/routes/invoices.routes.ts \
          server/db/migrations/20260323_cn_sequence.sql
  git commit -m "fix(invoices): separate credit note number series (GT-CN-YYYY-NNNNN)

  - generateInvoiceNumber now excludes credit_note rows from count
  - generateCreditNoteNumber uses FOR UPDATE on system_settings cn_sequence_YYYY
  - void handler uses new CN generator instead of hardcoded -CN suffix"
  ```

---

## Task 3: Merge both branches into GT-Dev

Once both worktree branches are committed:

- [ ] **Step 1: Merge fix/invoice-items-void**

  ```bash
  cd /c/travelerp
  git checkout GT-Dev
  git merge fix/invoice-items-void --no-ff -m "fix(invoices): delete invoice_items on void so trip becomes rebillable"
  ```

- [ ] **Step 2: Merge fix/cn-number-series**

  ```bash
  git merge fix/cn-number-series --no-ff -m "fix(invoices): separate credit note number series (GT-CN-YYYY-NNNNN)"
  ```

- [ ] **Step 3: Clean up worktrees**

  ```bash
  git worktree remove .worktrees/fix-invoice-items-void
  git worktree remove .worktrees/fix-cn-number-series
  git branch -d fix/invoice-items-void fix/cn-number-series
  ```

- [ ] **Step 4: Final smoke test on GT-Dev**

  Run the full manual test sequence from Task 1 Step 4 and Task 2 Step 8 against the merged `GT-Dev` branch to confirm both fixes work together.
