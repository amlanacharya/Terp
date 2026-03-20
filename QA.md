# QA Guide For The Last 3 Pushes

This guide covers the latest 3 commits on the current branch:

- `ef0fa44` `pdf changes` on March 19, 2026
- `d4ec755` `payment hardening-Correct credit note refunds and financial history semantics` on March 18, 2026
- `39f1977` `Merge branch 'feature/gt-ui-modal-refactor' into GT` on March 18, 2026

This document assumes:

- you are starting from a fresh local environment
- you can use the seeded login accounts for authentication and permissions
- you should not rely on pre-existing business data
- all records created for this run should use `QA-` prefixes so they are easy to find

If a step says "keep this record", do not delete it until a later cleanup step.

## 0. Database SQL Scripts Relevant To This QA Run

Use the SQL path that matches your environment:

- Fresh reset with `docker compose down -v` + `docker compose up -d postgres`:
  PostgreSQL auto-runs `server/db/schema.sql` and `server/db/seed.sql` from `docker-compose.yml`, so no separate manual SQL run is needed.
- Existing local database that you are not resetting:
  run the relevant migration scripts below in this order before starting QA for these pushes:
  `server/db/migrations/007_customer_invoice_pdf_mode.sql`
  `server/db/migrations/008_trip_expenses_billable_flag.sql`
  `server/db/migrations/009_financial_ledger.sql`
  `server/db/migrations/010_credit_note_refund_ledger.sql`

## 1. Reset And Start

1. Reset the local database so schema and seed data are reapplied.

```powershell
cd C:\travelerp
docker compose down -v
docker compose up -d postgres
```

   On a brand-new Docker volume, this automatically runs `server/db/schema.sql` and `server/db/seed.sql`.
   If you are intentionally keeping an existing database instead of resetting it, run the migration SQL files listed in section `0` before continuing.

2. Start the backend.

```powershell
cd C:\travelerp\server
npm install
npm run dev
```

3. Start the frontend in a second terminal.

```powershell
cd C:\travelerp
npm install
npm run dev
```

4. Open `http://localhost:5173`.
5. Sign in as admin:
   `admin@travelerp.com` / `Admin@123456`
6. Clear the browser download folder so PDF checks are easy to validate.

Pass if:

- the login page loads
- admin login works
- the sidebar is visible

Result: [ ] Pass [ ] Fail
Notes:

## 2. Test Data To Reuse

Use these exact values unless a test step says otherwise.

### 2.1 Copy/Paste Text Blocks

Use this long address for the Odisha customer (`QA Odisha Infra Pvt Ltd` / `QA-CUST-OD`):

```text
QA Accounts Department, 3rd Floor, Meridian Trade Center, Plot 88, Janpath Extension, Near Old Airport Service Road, Bhubaneswar, Odisha - 751022
```

Use this long address for the Maharashtra customer (`QA Maharashtra Projects Ltd` / `QA-CUST-MH`).
This is the long-address customer used later for the invoice PDF regression check:

```text
QA Project Finance Desk, Tower B, 14th Floor, Western Port Logistics Park, Saki Vihar Link Road, Andheri East, Mumbai, Maharashtra - 400072
```

Use this long trip remark:

```text
QA PDF remark block. Driver must report at the service gate, wait for client instruction, record every movement row cleanly, and retain all fuel, toll, parking, and food receipts for final reconciliation.
```

Use this long lead note:

```text
QA lead note for modal and follow-up testing. Customer wants a clean quotation, one standby vehicle, phone confirmation on the previous evening, and an early morning reporting buffer.
```

### 2.2 Entity Names

- Vehicle Category: `QA-LUXE`
- Owner Code: `QAOWN001`
- Owner Name: `QA Fleet Owner`
- Vehicle Number: `QA01AB1234`
- Driver Code: `QADRV001`
- Driver Name: `QA Driver One`
- Odisha Customer Code: `QA-CUST-OD`
- Odisha Customer Name: `QA Odisha Infra Pvt Ltd`
- Maharashtra Customer Code: `QA-CUST-MH`
- Maharashtra Customer Name: `QA Maharashtra Projects Ltd`
- Tax Component Code: `QAMODAL`
- Lead phone: `+91-9000011111`
- OD Rate Chart: `QA Odisha Local 2026`
- MH Rate Chart: `QA MH Threshold 2026`
- OD Package Code: `QA8H80`
- OD Package Label: `QA 8 HR / 80 KM`
- Temp Package Code: `QADEL`
- Temp Route Description: `Delete me`
- Open Trip: `QA-TRP-OPEN-01`
- Completed Trip: `QA-TRP-COMP-01`
- Parent Trip: `QA-TRP-PARENT-01`
- Manual Invoice For Edit/PDF: `QAINV-MH-01`
- Manual Invoice For Delete: `QAINV-DEL-01`
- Manual Invoice For Write-Off: `QAINV-WO-01`
- Receipt Number: `QARCPT-01`
- Refund Numbers: `QARFND-01`, `QARFND-02`
- Driver Settlement: `QADST-01`
- Owner Settlement: `QAOST-01`

## 3. Modal Refactor Baseline

For every create/edit modal below, also verify these shared behaviors:

- page opens list-first with no inline CRUD form
- `Add` opens a centered modal
- `Edit` opens the same modal prefilled
- `Cancel` closes the modal and discards unsaved values
- `X`, `Esc`, and backdrop click close the modal when the form is not saving
- delete actions use the branded confirmation modal, not the browser confirm dialog

If a module-specific case below already checks these, you do not need to repeat a full `Esc` and backdrop check again in that module.

## 4. Vehicle Categories

1. Open `Vehicle Categories`.
2. Confirm the page shows list-first mode.
3. Click `Add New`.
4. Press `Esc`. Confirm the modal closes.
5. Click `Add New` again.
6. Click outside the modal. Confirm the modal closes.
7. Click `Add New` again and create:
   `Name = QA-LUXE`
   `Description = QA category for modal regression`
8. Save.
9. Verify the row appears and the modal closes.
10. Click `Edit` on `QA-LUXE`.
11. Change the description to `QA category for modal regression v2`.
12. Click `Cancel`.
13. Re-open `Edit` and confirm the old saved value is still shown.
14. Save the updated description.
15. Keep this record for the vehicle and rate-chart tests.

Pass if:

- modal opens and closes correctly
- edit opens prefilled
- cancel does not persist changes
- save refreshes the list

Result: [ ] Pass [ ] Fail
Notes:

## 5. Vehicle Owners

1. Open `Vehicle Owners`.
2. Click `Add New`.
3. Create:
   `Code = QAOWN001`
   `Name = QA Fleet Owner`
   `Contact Person = QA Owner Contact`
   `Phone = +91-9000012222`
   `Bank Name = QA Bank`
   `Bank Account = 123456789012`
   `IFSC = QAIFSC0001`
4. Save.
5. Edit the same owner and change `Contact Person` to `QA Owner Contact Updated`.
6. Save.
7. Keep this record for the vehicle and owner settlement tests.

Pass if:

- the owner can be created and edited in a modal
- the list refreshes after save

Result: [ ] Pass [ ] Fail
Notes:

## 6. Vehicles

1. Open `Vehicles`.
2. Click `Add Vehicle`.
3. Create:
   `Vehicle Number = QA01AB1234`
   `Vehicle Type = car`
   `Make = Toyota`
   `Model = Innova Crysta QA`
   `Year = 2024`
   `Seating Capacity = 6`
   `Owner = QA Fleet Owner`
   `GT Category = QA-LUXE`
   `Registration Date = 2026-03-01`
   `Insurance Expiry = 2027-03-31`
   `Permit Expiry = 2027-03-31`
   `Fitness Expiry = 2027-03-31`
   `Pollution Expiry = 2026-12-31`
4. Save.
5. Edit the vehicle, change `Model` to `Innova Crysta QA Updated`, save, and confirm the row updates.
6. Keep this record for all trip tests.

Pass if:

- modal create/edit works
- the vehicle category mapping is saved

Result: [ ] Pass [ ] Fail
Notes:

## 7. Drivers

1. Open `Drivers`.
2. Click `Add Driver`.
3. Create:
   `Driver Code = QADRV001`
   `Name = QA Driver One`
   `Phone = +91-9000013333`
   `License Number = QA-DL-1234567890`
   `License Expiry = 2028-12-31`
   `Default Vehicle = QA01AB1234`
   `Night Halt Rate = 500`
   `OT Per Hour = 120`
4. Save.
5. Edit the driver and change `OT Per Hour` to `150`.
6. Save.
7. Keep this record for trip and driver settlement tests.

Pass if:

- create and edit work in the modal
- the default vehicle is saved and visible on re-open

Result: [ ] Pass [ ] Fail
Notes:

## 8. Customers

### 8.1 Intra-State Customer

1. Open `Customers`.
2. Click `Add Customer`.
3. Create:
   `Customer Code = QA-CUST-OD`
   `Name = QA Odisha Infra Pvt Ltd`
   `Contact Person = QA Accounts OD`
   `Phone = +91-9000014444`
   `Address =` use the Odisha long address block above
   `City = Bhubaneswar`
   `State = Odisha`
   `Pincode = 751022`
   `GSTIN = 21ABCDE1234F1Z5`
   `Credit Days = 30`
   `Default Duty Hours = 8`
   `Invoice PDF Mode = invoice_with_annexures`
4. Save.
5. Edit the same customer and change `Contact Person` to `QA Accounts OD Updated`.
6. Save.
7. Keep this record. This is the intra-state control customer for tax checks.

### 8.2 Inter-State Customer

1. Click `Add Customer` again.
2. Create:
   `Customer Code = QA-CUST-MH`
   `Name = QA Maharashtra Projects Ltd`
   `Contact Person = QA Accounts MH`
   `Phone = +91-9000015555`
   `Address =` use the Maharashtra long address block above
   `City = Mumbai`
   `State = Maharashtra`
   `Pincode = 400072`
   `GSTIN = 27ABCDE1234F1Z5`
   `Credit Days = 45`
   `Default Duty Hours = 10`
   `Invoice PDF Mode = invoice_with_annexures`
3. Save.
4. Keep this record. This is the inter-state and long-address customer for the invoice PDF check.

Pass if:

- both customers can be created in the modal
- re-opening edit shows the saved values
- the two GSTINs have different state codes (`21` and `27`)

Result: [ ] Pass [ ] Fail
Notes:

## 9. Tax Config

1. Open `Tax Config`.
2. Click `Add Tax Component`.
3. Create a dummy record:
   `Component Code = QAMODAL`
   `Name = QA Modal Tax`
   `Is Percentage = false`
   `Flat Amount = 111`
   `Applies To = all`
   `HSN Code =` leave blank
   `Sort Order = 999`
   `Is Active = false`
4. Save.
5. Edit it and rename it to `QA Modal Tax Updated`.
6. Save.
7. Delete it.
8. Confirm the custom delete modal appears and the row is removed.

Pass if:

- create/edit/delete all work via modal flows
- browser-native confirm is never shown

Result: [ ] Pass [ ] Fail
Notes:

## 10. Leads

1. Open `Leads`.
2. Click `Add Lead`.
3. Create:
   `Lead Source = phone`
   `Existing Customer = QA-CUST-OD - QA Odisha Infra Pvt Ltd`
   `Phone Number = +91-9000011111`
   `Trip Type = local office movement`
   `Travel Date = 2026-03-20`
   `From Location = QA Yard`
   `To Location = QA Head Office`
   `Passenger Count = 3`
   `Number Of Vehicles = 1`
   `Estimated Amount = 3500`
   `Assign To = GT Demo Admin (admin)`
   `Priority = high`
   `Special Requirements =` use the long lead note block above
4. Save.
5. Select the created lead from the list.
6. Verify the selected-lead detail stays on the page.
7. Click `Edit` on the same lead, change `Estimated Amount` to `4200`, then click `Cancel`.
8. Verify the selected detail remains stable and the amount does not change.
9. Re-open edit, change `Estimated Amount` to `4200`, save, and verify the list updates.
10. In the selected lead detail, add a follow-up:
    `Follow-up Date = 2026-03-20`
    `Next Follow-up = 2026-03-21`
    `Contact Mode = phone`
    `Summary = QA follow-up entry for confirm modal regression`
    `Quoted Amount = 4200`
11. Save the follow-up.
12. Delete that follow-up.
13. Confirm the delete uses the shared confirmation modal.
14. Keep the lead record for now. Delete it during cleanup.

Pass if:

- lead create/edit is modal-based
- follow-up entry remains embedded in selected-lead context
- selected lead detail does not disappear on cancel
- follow-up delete uses the shared confirmation modal

Result: [ ] Pass [ ] Fail
Notes:

## 11. Rate Charts

### 11.1 Create The Odisha Chart

1. Open `Rate Charts`.
2. Click `Add Rate Chart`.
3. Create:
   `Customer = QA Odisha Infra Pvt Ltd`
   `Chart Name = QA Odisha Local 2026`
   `Effective From = 2026-03-01`
   `Is Active = true`
   `Notes = QA OD chart for trip and modal testing`
4. Save.
5. Open the chart detail if it is not already selected.
6. In `Add Package`, create the primary package:
   `Vehicle Category = QA-LUXE`
   `Duty Type = local`
   `Package Code = QA8H80`
   `Package Label = QA 8 HR / 80 KM`
   `Sort Order = 1`
   `Default Package = true`
   `Base Hours = 8`
   `Base KM = 80`
   `Base Amount = 3000`
   `Extra KM Rate = 18`
   `Extra Hour Rate = 180`
   `Use higher of extra KM or extra hour charge = true`
7. Save the package.
8. Add a temporary package to test delete:
   `Package Code = QADEL`
   `Package Label = QA Delete Package`
   `Vehicle Category = QA-LUXE`
   `Duty Type = local`
   `Base Hours = 4`
   `Base KM = 40`
   `Base Amount = 1500`
9. Save it, then delete it from the package list.
10. Confirm the delete uses the shared confirmation modal.
11. In `Add Fixed Route`, create the primary route:
    `Vehicle Category = QA-LUXE`
    `Duty Type = local`
    `From Location = QA Yard`
    `To Location = QA Head Office`
    `Fixed Amount = 4000`
    `Description = QA fixed route keep`
12. Save it.
13. Add a temporary route:
    `From Location = QA Delete From`
    `To Location = QA Delete To`
    `Fixed Amount = 999`
    `Description = Delete me`
14. Save it, then delete it.

### 11.2 Duplicate And Delete A Copy

1. With `QA Odisha Local 2026` selected, click `Duplicate Chart`.
2. Create the duplicate:
   `Target Customer = QA Odisha Infra Pvt Ltd`
   `New Chart Name = QA Odisha Local 2026 Copy`
   `Effective From = 2026-04-01`
   `Make Duplicate Active = false`
3. Save.
4. Delete the duplicated chart from the list.
5. Confirm chart delete uses the shared confirmation modal.

### 11.3 Create The Maharashtra Chart

1. Click `Add Rate Chart`.
2. Create:
   `Customer = QA Maharashtra Projects Ltd`
   `Chart Name = QA MH Threshold 2026`
   `Effective From = 2026-03-01`
   `Is Active = true`
3. Save.
4. Add one package to the MH chart:
   `Vehicle Category = QA-LUXE`
   `Duty Type = local`
   `Package Code = QAMHLOC`
   `Package Label = QA MH Local`
   `Base Hours = 8`
   `Base KM = 80`
   `Base Amount = 2800`
   `Extra KM Rate = 16`
   `Extra Hour Rate = 160`
   `Long KM Threshold = 250`
5. Save.
6. Keep both primary charts.

Pass if:

- chart create/edit/duplicate flows are modal-based
- package and fixed-route delete use shared confirmation UI
- the duplicated chart can be deleted without affecting the original

Result: [ ] Pass [ ] Fail
Notes:

## 12. Trips

### 12.1 Open Trip Modal And Open External PDF

1. Open `Trips`.
2. Click `New GT Trip`.
3. Press `Esc`. Confirm the modal closes.
4. Re-open `New GT Trip`.
5. Create the open trip:
   `Trip Number = QA-TRP-OPEN-01`
   `Trip Date = 2026-03-20`
   `Status = in_progress`
   `Duty Type = local`
   `Customer = QA Odisha Infra Pvt Ltd`
   `Vehicle = QA01AB1234`
   `Driver = QA Driver One`
   `GT Category = QA-LUXE`
   `Package = QA 8 HR / 80 KM`
   `Booked By = QA Booker`
   `Report To = QA Front Gate`
   `From Location = QA Yard`
   `To Location = QA Head Office`
   `Purpose = Open duty slip test`
   `Trip Amount = 0`
   `Remarks =` use the long trip remark block
6. Save.
7. From the selected trip detail, click `Edit Trip`.
8. In the modal, add one complete metric row:
   `Seq = 1`
   `Start Date = 2026-03-20`
   `Start Time = 08:00`
   `Start KM = 1000`
   `End Date = 2026-03-20`
   `End Time = 10:00`
   `End KM = 1025`
9. Add one incomplete metric row:
   `Seq = 2`
   `Start Date = 2026-03-20`
   `Start Time = 10:15`
   `Start KM = 1025`
   `End Date =` blank
   `End Time =` blank
   `End KM =` blank
10. Close the modal with `Cancel`.
11. Verify the selected trip detail remains on the page.
12. Click `Duty Slip PDF`.
13. Confirm the downloaded file name ends with `duty-slip-external-open.pdf`.
14. Open the PDF and verify:
    the movement grid is blank
    at least 5 blank rows are shown
    internal billing/calculation fields are not shown
15. Click `Internal PDF`.
16. Confirm the internal PDF downloads and the remarks stay within their section.

Pass if:

- the trip form opens in a modal
- canceling edit does not wipe the selected trip detail
- default PDF for non-completed trips is the open external variant
- open external never pre-fills movement rows

Result: [ ] Pass [ ] Fail
Notes:

### 12.2 Completed Trip, Metric Confirm, Expense Flag, Closed External PDF, And GT Invoice Setup

1. Click `New GT Trip`.
2. Create the completed trip:
   `Trip Number = QA-TRP-COMP-01`
   `Trip Date = 2026-03-21`
   `Status = completed`
   `Duty Type = local`
   `Customer = QA Odisha Infra Pvt Ltd`
   `Vehicle = QA01AB1234`
   `Driver = QA Driver One`
   `GT Category = QA-LUXE`
   `Package = QA 8 HR / 80 KM`
   `Booked By = QA Booker`
   `Report To = QA Corporate Gate`
   `From Location = QA Yard`
   `To Location = QA Head Office`
   `Purpose = Completed duty slip and payment-hardening setup`
   `Trip Amount = 3000`
   `Remarks =` use the long trip remark block
3. Save.
4. Open `Edit Trip` for `QA-TRP-COMP-01`.
5. Add these complete metric rows:
   `Seq 1: 2026-03-21 08:00 / KM 2000 -> 2026-03-21 10:00 / KM 2040`
   `Seq 2: 2026-03-21 10:30 / KM 2040 -> 2026-03-21 13:00 / KM 2090`
   `Seq 3: 2026-03-21 14:00 / KM 2090 -> 2026-03-21 18:30 / KM 2135`
6. Add one temporary metric row `Seq 99`, then delete it.
7. Confirm metric delete uses the shared confirmation modal.
8. Run `Calculate`.
9. Verify a success notice appears and the trip shows a calculated amount.
10. Edit the trip again and intentionally change `Trip Amount` to `123456`.
11. Save. This is intentional to stress GT invoice amount-in-words and refund semantics later.
12. In the selected trip expense section, add expense 1:
    `Type = fuel`
    `Amount = 1500`
    `Receipt Reference = QA-FUEL-01`
    `Description = Billable fuel expense`
    `Billable To Hirer = checked`
13. Add expense 2:
    `Type = toll`
    `Amount = 250`
    `Receipt Reference = QA-TOLL-01`
    `Description = Non-billable toll expense`
    `Billable To Hirer = unchecked`
14. Edit expense 2 and change the description to `Non-billable toll expense updated`.
15. Verify the expense table shows `Yes` for the first row and `No` for the second.
16. Click `Duty Slip PDF`.
17. Confirm the downloaded file name ends with `duty-slip-external-closed.pdf`.
18. Open the PDF and verify:
    movement rows are populated in sequence order
    the sheet is not blank
    trip-expense rows are shown
    calculation/billing internals are not shown
19. Click `Internal PDF`.
20. Open the internal PDF and verify the long remarks remain inside their box.
21. Click `Bill Trip`.
22. Note the generated invoice number. You will use it later in the payment-hardening section.

Pass if:

- metric delete uses the shared confirmation modal
- billable flag persists end to end
- default PDF for completed trips is the closed external variant
- closed external shows movement rows and trip expenses

Result: [ ] Pass [ ] Fail
Notes:

### 12.3 Parent Trip For Annexure Testing

1. Click `New GT Trip`.
2. Create the parent trip:
   `Trip Number = QA-TRP-PARENT-01`
   `Trip Date = 2026-03-22`
   `Status = completed`
   `Duty Type = local`
   `Customer = QA Odisha Infra Pvt Ltd`
   `Vehicle = QA01AB1234`
   `Driver = QA Driver One`
   `GT Category = QA-LUXE`
   `Package = QA 8 HR / 80 KM`
   `From Location = QA Parent Yard`
   `To Location = QA Project Campus`
   `Purpose = Annexure create and bill`
   `Trip Amount = 9000`
3. Save.
4. Open `Edit Trip` and add these 6 complete metric rows:
   `Seq 1: 2026-03-22 08:00 / 3000 -> 2026-03-22 10:00 / 3040`
   `Seq 2: 2026-03-22 10:30 / 3040 -> 2026-03-22 13:00 / 3090`
   `Seq 3: 2026-03-23 08:00 / 3090 -> 2026-03-23 10:00 / 3130`
   `Seq 4: 2026-03-23 10:30 / 3130 -> 2026-03-23 13:00 / 3180`
   `Seq 5: 2026-03-24 08:00 / 3180 -> 2026-03-24 10:00 / 3220`
   `Seq 6: 2026-03-24 10:30 / 3220 -> 2026-03-24 13:00 / 3270`
5. Run `Calculate`.
6. Keep this parent trip selected for the annexure tests.

Pass if:

- the parent trip is saved and selected
- all 6 rows are visible and complete

Result: [ ] Pass [ ] Fail
Notes:

## 13. Annexures

### 13.1 Embedded Create Modal

1. Stay on `Trips` with `QA-TRP-PARENT-01` selected.
2. In the embedded annexure panel, click `Create Annexure`.
3. Confirm `Parent Trip` is prefilled and read-only.
4. Use:
   `Annexure Number = QA-ANX-01`
   `Selection Mode = metric_rows`
5. Select metric rows `Seq 1` and `Seq 2`.
6. Verify the selection preview updates.
7. Save.
8. Confirm the new annexure appears in the embedded list.

### 13.2 Standalone Create Modal With Date Range

1. Open the standalone `Annexures` sidebar page.
2. Select parent trip `QA-TRP-PARENT-01`.
3. Click `Create Annexure`.
4. Create:
   `Annexure Number = QA-ANX-02`
   `Selection Mode = date_range`
   `Start Date = 2026-03-23`
   `End Date = 2026-03-23`
5. Save.
6. Create a third annexure the same way:
   `Annexure Number = QA-ANX-03`
   `Selection Mode = date_range`
   `Start Date = 2026-03-24`
   `End Date = 2026-03-24`
7. Save.

### 13.3 PDF, Single Bill, Bulk Bill, And Delete Confirm

1. Download the PDF for `QA-ANX-01`.
2. Verify the annexure PDF renders and the header/info boxes do not overlap.
3. Click `Bill` on `QA-ANX-01`.
4. Confirm a new invoice is created.
5. Select `QA-ANX-02` and `QA-ANX-03` and click `Bill Selected (2)`.
6. Confirm a grouped invoice is created.
7. Any unbilled annexure row that remains can be deleted. If all 3 were billed, skip delete here and use the cleanup section for delete coverage with a temporary annexure.
8. If you create a temporary annexure for delete coverage, confirm the delete action uses the shared confirmation modal.

Pass if:

- embedded and standalone creation both work
- embedded mode keeps parent context fixed
- both `metric_rows` and `date_range` modes work
- annexure PDF downloads
- single bill and grouped bill both work

Result: [ ] Pass [ ] Fail
Notes:

## 14. Invoices

### 14.1 Manual Invoice Modal, Edit, Tax Preview, And Standard PDF

1. Open `Customer Invoices`.
2. Confirm the page says the manual form is only for legacy manual invoices.
3. Click `Add Manual Invoice`.
4. Create:
   `Invoice Number = QAINV-MH-01`
   `Invoice Date = 2026-03-25`
   `Customer = QA Maharashtra Projects Ltd` (the long-address customer created in section `8.2`)
   `Subtotal = 123456`
   `Due Date = 2026-04-09`
   `Payment Status = pending`
5. Verify tax preview shows inter-state behavior:
   `IGST` has a value
   `CGST` and `SGST` stay `0`
6. Save.
7. Edit `QAINV-MH-01`.
8. Change `Subtotal` to `125000`, then click `Cancel`.
9. Re-open edit and confirm the old saved values are still shown.
10. Edit again, change `Subtotal` to `125000`, and save.
11. Download the PDF for `QAINV-MH-01`.
12. Open the PDF.
13. In the customer/bill-to section, verify the PDF shows the full saved address for `QA Maharashtra Projects Ltd` from section `2.1`.
14. Confirm the address wraps across multiple lines cleanly and no part of the address is missing, clipped, or pushed outside the page.
15. Verify the invoice header/info boxes do not overlap.
16. Verify no text spills outside the page.

Pass if:

- manual invoice create/edit is modal-based
- tax preview responds correctly to `QA Maharashtra Projects Ltd` as the inter-state customer
- the full `QA Maharashtra Projects Ltd` long address is visible in the PDF and wraps cleanly
- the standard invoice PDF renders without layout overlap

Result: [ ] Pass [ ] Fail
Notes:

### 14.2 Manual Invoice Delete Confirm

1. Create another manual invoice:
   `Invoice Number = QAINV-DEL-01`
   `Invoice Date = 2026-03-25`
   `Customer = QA Odisha Infra Pvt Ltd`
   `Subtotal = 3000`
   `Due Date = 2026-03-30`
   `Payment Status = pending`
2. Save.
3. Delete `QAINV-DEL-01`.
4. Confirm the shared confirmation modal appears.
5. Confirm the row disappears after delete.

Pass if:

- delete is confirmation-modal based
- a manual invoice with no collections can be deleted

Result: [ ] Pass [ ] Fail
Notes:

### 14.3 Write-Off Flow

1. Create another manual invoice:
   `Invoice Number = QAINV-WO-01`
   `Invoice Date = 2026-03-25`
   `Customer = QA Odisha Infra Pvt Ltd`
   `Subtotal = 5000`
   `Due Date = 2026-03-27`
   `Payment Status = pending`
2. Save.
3. Click `Write Off` on `QAINV-WO-01`.
4. Enter reason: `QA write-off regression`.
5. Confirm.
6. Verify the row now shows `Written Off`.
7. Open `Financial History` on `QAINV-WO-01`.
8. Confirm a `Write Off` event exists.

Pass if:

- write-off dialog still works after the modal refactor
- financial history shows the correct event

Result: [ ] Pass [ ] Fail
Notes:

### 14.4 GT And Annexure Invoice UI Regression

1. Locate the trip-generated invoice created from `QA-TRP-COMP-01`.
2. Verify it is not editable as a manual invoice.
3. Locate the grouped annexure invoice from `QA-ANX-02` and `QA-ANX-03`.
4. Verify its PDF button opens a menu with:
   `Customer Default`
   `Invoice Only`
   `Invoice + Annexures`
5. Download `Invoice + Annexures`.
6. Open the PDF and verify:
   the GT invoice layout is intact
   annexure pages are appended
   long text stays inside its boxes

Pass if:

- source-linked GT invoices are not treated as manual-edit invoices
- annexure PDF mode menu still works after the modal refactor

Result: [ ] Pass [ ] Fail
Notes:

## 15. Collections, Credit Notes, Refunds, Financial History, Dashboard, And Reports

This section validates the payment-hardening commit.

### 15.1 Normal Receipt On The GT Trip Invoice

1. In `Customer Invoices`, find the trip-generated invoice from `QA-TRP-COMP-01`.
2. Note its invoice number.
3. Open `Payment Receipts`.
4. Click `Record Settlement`.
5. Select the normal invoice entry:
   it should display as `Invoice <number> - QA Odisha Infra Pvt Ltd`
6. Create a receipt:
   `Receipt Number = QARCPT-01`
   `Receipt Date = 2026-03-26`
   `Amount Received = 2000`
   `Payment Mode = bank_transfer`
   `Reference Number = QA-RCP-2000`
   `Bank Name = QA Bank`
7. Save.
8. Return to `Customer Invoices`.
9. Verify the original invoice shows partial normal-invoice wording:
   `collected`
   `due`
10. Open `Financial History` on the invoice.
11. Confirm a `Payment Received` event exists.

Pass if:

- collections against a normal invoice still behave as receipts
- invoice wording stays receipt-oriented for normal invoices

Result: [ ] Pass [ ] Fail
Notes:

### 15.2 Record Baseline Dashboard And Report Totals

1. Open `Dashboard`.
2. Note the collected total and outstanding widget values.
3. Open `Reports`.
4. Note the collected total shown in the summary.

Pass if:

- you have a baseline number written down before refund testing starts

Result: [ ] Pass [ ] Fail
Notes:

### 15.3 Void The Partially Paid Invoice

1. Return to `Customer Invoices`.
2. On the invoice from `QA-TRP-COMP-01`, click `Void`.
3. Enter reason: `QA void after partial receipt`.
4. Confirm.
5. Click `Show Voided`.
6. Verify the original invoice still shows its original total amount and now has lifecycle `Void`.
7. Find the new credit note `<original invoice number>-CN`.
8. Verify the credit note total equals `2000`, not the original invoice total.
9. Verify the credit note initially shows `No refund recorded`.
10. Open `Financial History` on the credit note and confirm `Credit Note Issued` exists.

Pass if:

- voiding does not rewrite the original invoice total
- the credit note amount equals the already received amount only
- the new credit note starts pending

Result: [ ] Pass [ ] Fail
Notes:

### 15.4 Record Refunds Against The Credit Note

1. Open `Payment Receipts`.
2. Click `Record Settlement`.
3. In the document selector, confirm the credit note is labeled:
   `Credit Note <number>-CN - QA Odisha Infra Pvt Ltd`
4. Create the first refund:
   `Refund Number = QARFND-01`
   `Refund Date = 2026-03-27`
   `Amount Refunded = 750`
   `Payment Mode = bank_transfer`
   `Reference Number = QA-RFND-750`
5. Save.
6. Verify the new row in `Payment Receipts` is tagged as `Refund`.
7. Return to `Customer Invoices`.
8. Verify the credit note now shows:
   `750 refunded`
   `1250 credit pending`
9. Open `Financial History` on the credit note.
10. Confirm a `Refund Paid` event exists and the direction copy is semantic, not raw AR language.
11. Record a second refund on the same credit note:
    `Refund Number = QARFND-02`
    `Refund Date = 2026-03-28`
    `Amount Refunded = 1250`
12. Save.
13. Verify the credit note now says `Fully refunded`.

Pass if:

- settlements on credit notes are allowed
- the UI switches from receipt language to refund language
- financial history uses `Refund Paid`

Result: [ ] Pass [ ] Fail
Notes:

### 15.5 Delete One Refund And Recheck Totals

1. In `Payment Receipts`, delete `QARFND-02`.
2. Confirm the shared confirmation modal appears.
3. Return to `Customer Invoices`.
4. Verify the credit note is back to partial refund wording:
   `750 refunded`
   `1250 credit pending`
5. Open `Financial History`.
6. Confirm `Refund Reversed` was appended.
7. Re-open `Dashboard` and `Reports`.
8. Compare them to the baseline numbers from section `15.2`.

Pass if:

- deleting a refund creates a `Refund Reversed` entry
- refund activity does not inflate receipt totals in Dashboard or Reports
- the outstanding widget does not jump by the credit-note amount

Result: [ ] Pass [ ] Fail
Notes:

## 16. Settlements

### 16.1 Driver Settlement

1. Open `Salary Slips`.
2. Click `Add Salary Slip`.
3. Create:
   `Salary Slip Number = QADST-01`
   `Driver = QA Driver One`
   `Period From = 2026-03-20`
   `Period To = 2026-03-31`
   `Total Trips = 3`
   `Total KM = 270`
   `Allowance = 7000`
   `Advances = 1000`
   `Deductions = 500`
   `Net Payable = 5500`
   `Payment Mode = upi`
   `Reference Number = QA-DRV-UPI`
   `Status = paid`
4. Save.
5. Edit the same settlement and change `Deductions` to `600`.
6. Save.
7. Download the PDF.
8. Verify the PDF renders without overlap.
9. Delete the settlement and confirm the shared confirmation modal is used.

Pass if:

- create/edit/delete are modal-based
- settlement PDF downloads and renders

Result: [ ] Pass [ ] Fail
Notes:

### 16.2 Owner Settlement

1. Open `Owner Invoices`.
2. Click `Add Owner Invoice`.
3. Create:
   `Invoice Number = QAOST-01`
   `Owner = QA Fleet Owner`
   `Vehicle = QA01AB1234`
   `Period From = 2026-03-20`
   `Period To = 2026-03-31`
   `Total Trips = 3`
   `Total KM = 270`
   `Total Amount = 22000`
   `TDS Amount = 2000`
   `Other Deductions = 500`
   `Net Amount = 19500`
   `Payment Mode = bank_transfer`
   `Reference Number = QA-OWN-BANK`
   `Status = approved`
4. Save.
5. Edit the same settlement and change `Other Deductions` to `750`.
6. Save.
7. Download the PDF.
8. Verify the PDF renders without overlap.
9. Delete the settlement and confirm the shared confirmation modal is used.

Pass if:

- create/edit/delete are modal-based
- owner settlement PDF downloads and renders

Result: [ ] Pass [ ] Fail
Notes:

## 17. Role Smoke

Use the seeded non-admin users for these quick permission checks.

### 17.1 Manager

1. Sign out.
2. Sign in as `manager.gt@travelerp.com` / `GTDemo@123`.
3. Open `Customer Invoices`.
4. Verify `Void` is available on active normal invoices.
5. Verify `Write Off` is not available.

Result: [ ] Pass [ ] Fail
Notes:

### 17.2 Accountant

1. Sign out.
2. Sign in as `accountant.gt@travelerp.com` / `GTDemo@123`.
3. Verify the sidebar shows `Customer Invoices`, `Payment Receipts`, `Salary Slips`, `Owner Invoices`, and `Tax Config`.
4. Verify the sidebar does not show `Trips`, `Leads`, `Drivers`, or `Vehicles`.

Result: [ ] Pass [ ] Fail
Notes:

### 17.3 Operator

1. Sign out.
2. Sign in as `operator.gt@travelerp.com` / `GTDemo@123`.
3. Verify the sidebar shows `Trips`, `Leads`, `Drivers`, `Vehicles`, `Vehicle Categories`, `Rate Charts`, and `Annexures`.
4. Verify the sidebar does not show `Customer Invoices`, `Payment Receipts`, `Salary Slips`, `Owner Invoices`, or `Tax Config`.

Result: [ ] Pass [ ] Fail
Notes:

### 17.4 Viewer

1. Sign out.
2. Sign in as `viewer.gt@travelerp.com` / `GTDemo@123`.
3. Open `Leads`, `Trips`, and `Rate Charts`.
4. Verify no create/edit/delete actions are available.

Result: [ ] Pass [ ] Fail
Notes:

### 17.5 Return To Admin

1. Sign out.
2. Sign back in as admin for any optional advanced checks or cleanup.

Result: [ ] Pass [ ] Fail
Notes:

## 18. Optional Advanced Edge Cases

These are worth running if you want deeper coverage. Two of them are not fully reachable from the current UI.

### 18.1 Closed External PDF Rejection On Non-Completed Trip

1. While logged in, open the browser devtools console.
2. Use the network tab to copy the auth token from an API request, or use a REST client with the same token.
3. Call:
   `GET /api/trips/<QA-TRP-OPEN-01 id>/duty-slip-pdf?variant=closed_external`
4. Verify the response is `400`.

Pass if:

- non-completed trips reject `closed_external`

Result: [ ] Pass [ ] Fail [ ] N/A
Notes:

### 18.2 Settlement Amendment Events

Current UI does not expose settlement edit in `Payment Receipts`, but the backend supports amendment ledger events.

1. Use API or Postman to update `QARCPT-01` amount and then save it back.
2. Re-open Financial History on the original invoice.
3. Verify `Payment Amended` entries appear.
4. Use API or Postman to update `QARFND-01`.
5. Re-open Financial History on the credit note.
6. Verify `Refund Amended` entries appear.

Pass if:

- amendment events are written with semantic labels

Result: [ ] Pass [ ] Fail [ ] N/A
Notes:

### 18.3 Standard Invoice Multi-Page Pagination

Current manual-invoice UI creates only one invoice line item, so true multi-page testing for the standard invoice table is not fully reachable through UI alone.

Use either:

- an existing DB fixture with a manual invoice containing many line items, or
- a one-off SQL helper in DBeaver to insert many `invoice_items` rows for `QAINV-MH-01`

Then:

1. Download the PDF again.
2. Verify table headers repeat on each page.
3. Verify no rows render below the page bottom.

Result: [ ] Pass [ ] Fail [ ] N/A
Notes:

## 19. Cleanup

Delete the remaining `QA-` records if you do not want them left in the DB.

Recommended order:

1. Delete leftover manual invoices that are still active.
2. Delete unbilled QA annexures, then QA parent trip child data if any remains.
3. Delete `QA-TRP-OPEN-01`, `QA-TRP-COMP-01`, and `QA-TRP-PARENT-01` if they are no longer linked.
4. Delete the lead `QA-*`.
5. Delete QA rate charts not linked to trips.
6. Delete `QADRV001`.
7. Delete `QA01AB1234`.
8. Delete `QAOWN001`.
9. Delete `QA-CUST-OD` and `QA-CUST-MH`.
10. Delete `QA-LUXE`.

Pass if:

- cleanup succeeds without leaving ambiguous QA records

Result: [ ] Pass [ ] Fail
Notes:
