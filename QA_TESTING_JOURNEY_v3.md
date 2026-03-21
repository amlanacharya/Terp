# UI/UX Polish v3 — End-to-End QA Testing Journey

**Branch:** `GT-Dev` (testing branch)
**Features:** Pagination (all 8 list pages) + Duty Slip Navigation
**Estimated Duration:** 45-60 minutes
**Date:** [Today's Date]
**Tester Name:** [Your Name]

---

## 📋 Pre-Testing Checklist

### Environment Setup
- [ ] Git checkout `GT-Dev` branch: `git checkout GT-Dev && git pull origin GT-Dev`
- [ ] Install dependencies: `npm install`
- [ ] Start frontend dev server: `npm run dev` (runs on http://localhost:5173)
- [ ] In separate terminal, start backend: `cd server && npm run dev` (runs on http://localhost:3000)
- [ ] Verify no TypeScript errors: `npm run typecheck` → zero errors expected
- [ ] Verify backend builds: `cd server && npm run build` → zero errors expected

### Test Data Requirements
- [ ] Application has test data with multiple customers, leads, trips, collections
- [ ] At least 25+ records in Customers, Leads, Trips, Rate Charts, Vehicle Categories, Collections, Driver Settlements
- [ ] Some invoices have associated trips (for duty slip navigation test)
- [ ] Some invoices are manual (no trip_id) for edge case testing

### Browser & Tools
- [ ] Use Chrome/Firefox (modern browser with DevTools)
- [ ] Open DevTools Console to monitor for errors
- [ ] Have a note-taking tool ready (or this document to fill in results)

---

## 🧪 Test Suite 1: Pagination Feature (All List Pages)

### Test 1.1: Customers List — Pagination Display & Navigation

**Objective:** Verify pagination component appears and functions correctly.

**Steps:**
1. Login to application (if required)
2. Navigate to **Customers** page
3. Observe the table below customers list

**Expected Results:**
- [ ] Table displays first 10 customers (default page size)
- [ ] Pagination component visible at bottom: "Showing 1 to 10 of X customers"
- [ ] Previous button is **disabled** (grayed out) on page 1
- [ ] Next button is **enabled** on page 1 (if >10 customers exist)
- [ ] Page number buttons show current page highlighted

**Test Actions:**
4. Click **Next** button
5. Observe table and pagination component

**Expected After Click:**
- [ ] Table updates to show customers 11-20
- [ ] "Showing 11 to 20 of X customers" displays
- [ ] Previous button now **enabled**
- [ ] Page number changes to highlight page 2
- [ ] No console errors

**Test Actions:**
6. Click **Previous** button
7. Observe table and pagination

**Expected After Click:**
- [ ] Table returns to showing customers 1-10
- [ ] Previous button **disabled** again
- [ ] "Showing 1 to 10 of X customers"

**Test Actions:**
8. Click page number **3** (if 3+ pages exist)

**Expected After Click:**
- [ ] Table jumps to page 3 (customers 21-30)
- [ ] Pagination shows correct range
- [ ] Page number **3** is highlighted

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 1.2: Customers List — Page Size Selector

**Objective:** Verify page size dropdown changes number of items displayed and resets to page 1.

**Steps:**
1. Stay on **Customers** page
2. Locate page size dropdown (usually shows "10" or "10 items per page")
3. Locate dropdown near pagination controls

**Test Actions:**
4. Click dropdown → Select **25**

**Expected Results:**
- [ ] Table now displays 25 customers per page
- [ ] Pagination shows "Showing 1 to 25 of X customers"
- [ ] Page number resets to **1** (important!)
- [ ] Next button disabled if < 25 customers total

**Test Actions:**
5. Change dropdown again → Select **50**

**Expected Results:**
- [ ] Table displays 50 customers per page
- [ ] Still on page 1
- [ ] Pagination updates to "Showing 1 to 50 of X customers"

**Test Actions:**
6. Change dropdown back to **10**

**Expected Results:**
- [ ] Returns to 10 items per page
- [ ] Page resets to 1
- [ ] Pagination shows "Showing 1 to 10..."

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 1.3: Customers List — Filter Interaction with Pagination

**Objective:** Verify that applying a filter resets pagination to page 1.

**Steps:**
1. Stay on **Customers** page
2. Navigate to page 2 (if available)
3. Verify "Showing 11 to 20 of X customers"

**Test Actions:**
4. Enter a **filter value** in the filter field (e.g., customer name starts with "A")
5. Press Enter or wait for auto-filter

**Expected Results:**
- [ ] Table updates to show only matching customers
- [ ] Pagination resets to **page 1** (critical!)
- [ ] "Showing 1 to X of Y customers" (where X ≤ 10, Y is filtered count)
- [ ] Previous button is **disabled**

**Test Actions:**
6. Clear the filter
7. Observe pagination reset

**Expected Results:**
- [ ] All customers shown again
- [ ] Back to page 1
- [ ] Full customer count displays

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 1.4: Owners (Vehicle Owners) List — Pagination

**Objective:** Verify pagination works identically on OwnerList.

**Steps:**
1. Navigate to **Vehicle Owners** (or similar, depending on UI menu)
2. Observe table and pagination

**Expected Results:**
- [ ] Pagination component visible
- [ ] Shows "Showing X to Y of Z vehicle owners"
- [ ] Previous button disabled on page 1
- [ ] Next button enabled (if >10 owners)

**Test Actions:**
3. Click **Next**
4. Verify table updates and pagination shows page 2

**Expected Results:**
- [ ] Pagination reflects page 2
- [ ] Previous button enabled

**Test Actions:**
5. Apply filter (if available, e.g., city filter)

**Expected Results:**
- [ ] Pagination resets to page 1
- [ ] Shows filtered count

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 1.5: Leads List — Pagination with Date Range Filter

**Objective:** Test pagination on LeadList with date filters.

**Steps:**
1. Navigate to **Leads** page
2. Observe pagination at bottom

**Expected Results:**
- [ ] Pagination visible with "Showing 1 to 10 of X leads"
- [ ] Multiple filter options available (name, status, date range)

**Test Actions:**
3. Apply a **date range filter** (e.g., last 30 days)
4. Observe table and pagination update

**Expected Results:**
- [ ] Table shows only leads matching date range
- [ ] Pagination resets to page 1
- [ ] Shows filtered count

**Test Actions:**
5. Navigate to page 2

**Expected Results:**
- [ ] Page 2 loads with filtered leads 11-20
- [ ] Pagination updates correctly

**Test Actions:**
6. Clear date filter
7. Observe pagination reset to page 1, full count shown

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 1.6: Rate Charts List — Pagination

**Objective:** Verify pagination on RateChartList (customer-filtered).

**Steps:**
1. Navigate to **Rate Charts** page
2. Observe pagination component

**Expected Results:**
- [ ] Pagination shows "Showing 1 to 10 of X rate charts"
- [ ] Pagination controls functional

**Test Actions:**
3. Apply **customer filter** (if available)

**Expected Results:**
- [ ] Filtered rate charts display
- [ ] Pagination resets to page 1
- [ ] Shows filtered count

**Test Actions:**
4. Navigate pages (Next, Previous, specific page number)

**Expected Results:**
- [ ] All page navigation works correctly
- [ ] Table updates without lag
- [ ] No console errors

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 1.7: Trips (Duty Slips) List — Pagination

**Objective:** Test pagination on TripList with client/driver/date filters.

**Steps:**
1. Navigate to **Trips** or **Duty Slips** page
2. Observe pagination

**Expected Results:**
- [ ] Pagination visible "Showing 1 to 10 of X trips"

**Test Actions:**
3. Apply a filter (customer, driver, or date range)
4. Observe pagination response

**Expected Results:**
- [ ] Pagination resets to page 1
- [ ] Shows filtered trip count
- [ ] Table updates with filtered data

**IMPORTANT TEST:**
5. Navigate to page 2
6. Apply a **different filter** (e.g., change customer filter)

**Expected Results:**
- [ ] Pagination resets to page 1 (not page 2!)
- [ ] New filtered data displays
- [ ] **Critical:** Verify page does NOT stay on page 2 (this was a spec requirement)

**Test Actions:**
7. Change **page size** to 25

**Expected Results:**
- [ ] Pagination resets to page 1
- [ ] Shows 25 trips per page

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 1.8: Vehicle Categories List — Pagination

**Objective:** Test pagination on VehicleCategoryList.

**Steps:**
1. Navigate to **Vehicle Categories** page
2. Observe pagination

**Expected Results:**
- [ ] Pagination visible "Showing 1 to 10 of X vehicle categories"

**Test Actions:**
3. Apply **name filter** (if available)

**Expected Results:**
- [ ] Pagination resets to page 1
- [ ] Filtered count displays

**Test Actions:**
4. Navigate pages

**Expected Results:**
- [ ] Page navigation works smoothly
- [ ] No console errors

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 1.9: Collections List — Pagination (No Filters)

**Objective:** Test pagination on CollectionList (simplified, no filters).

**Steps:**
1. Navigate to **Collections** page
2. Observe pagination

**Expected Results:**
- [ ] Pagination visible "Showing 1 to 10 of X collections"
- [ ] No filter controls (this is expected)

**Test Actions:**
3. Click **Next**

**Expected Results:**
- [ ] Table shows collections 11-20
- [ ] Pagination updates

**Test Actions:**
4. Change page size to **25**

**Expected Results:**
- [ ] Resets to page 1
- [ ] Shows 25 collections per page

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 1.10: Driver Settlements List — Pagination (No Filters)

**Objective:** Test pagination on DriverSettlements (simplified, no filters).

**Steps:**
1. Navigate to **Driver Settlements** page
2. Observe pagination

**Expected Results:**
- [ ] Pagination visible "Showing 1 to 10 of X settlements"
- [ ] No filter controls (expected)

**Test Actions:**
3. Navigate pages (Next, Previous, page numbers)

**Expected Results:**
- [ ] All navigation works correctly
- [ ] Table updates per page
- [ ] No console errors

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

## 🔗 Test Suite 2: Duty Slip Navigation Feature

### Test 2.1: Invoices List — Duty Slip Link Display (With Trip)

**Objective:** Verify that invoices with trip_id show clickable duty slip links.

**Steps:**
1. Navigate to **Invoices** page
2. Scroll through invoices table to find one with a **Duty Slip Number** (DS: XXXXX format)
3. Verify this invoice has an associated trip (manually check data or ask)

**Expected Results:**
- [ ] Duty slip number is visible in invoice row
- [ ] DS: XXXXX appears **blue** and **underlined** (clickable link style)
- [ ] Hovering over it shows cursor changes to pointer
- [ ] Has a small arrow icon: **↗** (right-arrow indicating navigation)

**Test Actions:**
4. Click on the **DS: XXXXX** link

**Expected Results:**
- [ ] Page navigates to **Trips** page
- [ ] Page does NOT reload (smooth SPA navigation)
- [ ] **Detail panel opens automatically** on the right showing trip details
- [ ] The trip ID in the detail panel matches the DS number from invoice
- [ ] No console errors

**Test Actions:**
5. In the detail panel, verify displayed information:
   - Trip date, customer name, driver name, vehicle, route, amounts

**Expected Results:**
- [ ] All trip details display correctly
- [ ] Panel shows all expected fields

**Test Actions:**
6. Close the detail panel (click X or outside)

**Expected Results:**
- [ ] Panel closes smoothly
- [ ] Still on Trips page

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 2.2: Invoices List — Duty Slip Link (Manual Invoice - No Trip)

**Objective:** Verify that invoices without trip_id show plain text (not clickable).

**Steps:**
1. Stay on **Invoices** page
2. Find an invoice with a **Duty Slip Number** but **without an associated trip** (manual invoice)
3. Observe the DS: XXXXX text

**Expected Results:**
- [ ] DS: XXXXX appears in **plain text** (not blue, not underlined)
- [ ] No arrow icon visible
- [ ] Hovering does NOT change cursor to pointer
- [ ] Clicking does nothing (or shows a disabled state)

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 2.3: Invoices List — No Duty Slip Number

**Objective:** Verify invoices without duty slip show dash or blank.

**Steps:**
1. Stay on **Invoices** page
2. Find an invoice **without a Duty Slip Number**
3. Observe the invoice number cell

**Expected Results:**
- [ ] Shows a dash **—** or blank space (not an error)
- [ ] No link or button visible
- [ ] Clean, readable table layout

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 2.4: Navigation Round-Trip (Invoice → Trip → Back)

**Objective:** Test the complete navigation flow and ability to return.

**Steps:**
1. Navigate to **Invoices** page
2. Find invoice with valid DS: link
3. Click DS: link

**Expected Results:**
- [ ] Navigates to Trips page
- [ ] Detail panel opens with trip info

**Test Actions:**
4. In detail panel, click **Edit** or **View** button (if available)

**Expected Results:**
- [ ] Can interact with trip details
- [ ] No navigation errors

**Test Actions:**
5. Navigate back using browser **back button** or close panel

**Expected Results:**
- [ ] Returns to Invoices page smoothly
- [ ] Invoice list still visible
- [ ] Pagination state preserved (if on page 2, still shows page 2)

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

## 🔍 Edge Cases & Performance Tests

### Test 3.1: Pagination Performance — Large Dataset

**Objective:** Verify pagination handles large lists smoothly.

**Steps:**
1. Navigate to a list page with 100+ records (Trips, Leads, or Collections)
2. Change page size to **1000** (if available)

**Expected Results:**
- [ ] Table loads all 1000 records
- [ ] No UI freeze or lag
- [ ] Pagination displays correctly
- [ ] No console errors or warnings

**Test Actions:**
3. Scroll through the large list

**Expected Results:**
- [ ] Scrolling is smooth (no stutter)
- [ ] Browser DevTools shows reasonable memory usage

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 3.2: Empty Results with Filters

**Objective:** Verify pagination handles zero-results gracefully.

**Steps:**
1. Navigate to a filtered list (e.g., Leads with a specific date range)
2. Apply a filter that returns zero results

**Expected Results:**
- [ ] Empty state message displays (e.g., "No leads found")
- [ ] Pagination hidden or disabled (not showing "0 to 0 of 0")
- [ ] Table body is empty but clean (no errors)

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 3.3: Concurrent Filter & Page Changes

**Objective:** Test rapid interactions (changing filters while navigating pages).

**Steps:**
1. Navigate to **Leads** page
2. Go to page 2
3. Quickly apply a filter (before page 2 fully loads)

**Expected Results:**
- [ ] Filter is applied immediately
- [ ] Pagination resets to page 1 (no race condition)
- [ ] No console errors
- [ ] UI is responsive (no hanging state)

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 3.4: Browser Refresh — Pagination State Persistence

**Objective:** Verify page size preference persists after refresh.

**Steps:**
1. Navigate to **Customers** page
2. Change page size from 10 to **25**
3. Press **F5** or **Ctrl+R** to refresh page

**Expected Results:**
- [ ] Page refreshes
- [ ] Pagination still shows **25 items per page** (persisted via localStorage)
- [ ] Data loads normally
- [ ] No errors

**Test Actions:**
4. Refresh again

**Expected Results:**
- [ ] Page size preference still **25** (localStorage working correctly)

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 3.5: Mobile Responsiveness (If Applicable)

**Objective:** Verify pagination UI works on mobile/tablet.

**Steps:**
1. Open browser DevTools (F12)
2. Toggle Device Toolbar (Ctrl+Shift+M) to mobile view
3. Navigate to **Customers** page
4. Observe pagination layout

**Expected Results:**
- [ ] Pagination controls are visible and accessible
- [ ] Buttons are appropriately sized for touch
- [ ] No overlapping or truncated text
- [ ] Page navigation works on mobile

**Test Actions:**
5. Change page size on mobile

**Expected Results:**
- [ ] Dropdown works smoothly
- [ ] Layout adjusts properly

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

## 🐛 Console & Error Monitoring

### Test 4.1: Console Errors During Session

**Objective:** Ensure no JavaScript errors occur during testing.

**Steps:**
1. Open browser **DevTools Console** (F12 → Console tab)
2. Clear console (right-click → Clear)
3. Proceed through all tests (Tests 1-3)
4. Periodically check console

**Expected Results:**
- [ ] **No red error messages** throughout session
- [ ] No warnings about deprecated code
- [ ] No React/Vue warnings (if using frameworks)
- [ ] Network tab shows successful API calls (200/201 status codes)

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

### Test 4.2: Network Performance

**Objective:** Verify API calls are efficient.

**Steps:**
1. Open DevTools **Network** tab
2. Filter by **XHR/Fetch** requests
3. Navigate to **Leads** page
4. Click pagination (Next, page number, change page size)

**Expected Results:**
- [ ] Each pagination action makes **one API call** (not multiple)
- [ ] Response time < 500ms
- [ ] Payload size is reasonable (not huge lists)
- [ ] Status codes are 200 (successful)

**Result:** ✅ PASS / ❌ FAIL
**Notes:** _________________________________

---

## 📊 Summary & Sign-Off

### Test Results Tally

| Test Suite | Passed | Failed | Partial |
|---|---|---|---|
| **Suite 1: Pagination (1.1-1.10)** | __/10 | __/10 | __/10 |
| **Suite 2: Duty Slip Nav (2.1-2.4)** | __/4 | __/4 | __/4 |
| **Suite 3: Edge Cases (3.1-3.5)** | __/5 | __/5 | __/5 |
| **Suite 4: Console/Performance (4.1-4.2)** | __/2 | __/2 | __/2 |
| **TOTALS** | **__/21** | **__/21** | **__/21** |

---

### Overall Status

- [ ] **✅ PASS** — All tests passed. Ready to merge to GT (production).
- [ ] **⚠️ PARTIAL PASS** — Most tests pass. Issues listed below. Recommend fix before prod merge.
- [ ] **❌ FAIL** — Critical failures found. Do NOT merge. See issues below.

---

### Critical Issues Found

*(List any blocking issues that must be fixed before production)*

1. **Issue:** ________________
   **Severity:** (Critical / High / Medium / Low)
   **Description:** ________________
   **Steps to Reproduce:** ________________
   **Workaround:** ________________

2. **Issue:** ________________
   **Severity:** (Critical / High / Medium / Low)
   **Description:** ________________
   **Steps to Reproduce:** ________________
   **Workaround:** ________________

---

### Minor Issues / Nice-to-Have Improvements

*(Non-blocking issues for future improvements)*

1. ________________
2. ________________
3. ________________

---

### Test Completion Summary

**Tester Name:** _________________________
**Date Tested:** _________________________
**Time Started:** ________  **Time Ended:** ________
**Total Duration:** _________
**Branch Tested:** `GT-Dev`
**Build/Commit:** (last commit hash: 6a8b2a7)

**Recommendation:**
- [ ] **APPROVE** — Merge to GT (production)
- [ ] **APPROVE WITH NOTES** — Merge to GT with follow-up fixes
- [ ] **REJECT** — Do not merge. Fix issues first.

---

### Sign-Off

**Tester:** _________________________
**Date:** _________________________
**Signature/Approval:** _________________________

---

## 🔄 Rollback Plan (If Needed)

If critical issues are found and rollback is needed:

```bash
# Go to GT branch
git checkout GT

# Revert to previous commit (before the merge)
git reset --hard HEAD~1

# Or, if merge has already been committed
git revert <merge-commit-hash>

# Push changes
git push origin GT
```

---

## 📞 Support

For questions during testing:
- Check console errors (F12 → Console)
- Verify backend is running (`http://localhost:3000` should be accessible)
- Check network tab for failed API calls
- Contact: [Dev Team Contact]

---

**End of QA Testing Journey Document**
