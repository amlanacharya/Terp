# TravelERP Lite - Beta Tester Onboarding Guide

**Version:** 1.0.0-beta.1
**Beta Period:** March 25 - April 22, 2026
**Welcome to the TravelERP Lite Beta Program!**

---

## Table of Contents

1. [Welcome & Overview](#welcome--overview)
2. [Getting Started](#getting-started)
3. [First Week Checklist](#first-week-checklist)
4. [Testing Focus Areas](#testing-focus-areas)
5. [How to Provide Feedback](#how-to-provide-feedback)
6. [Bug Reporting Guide](#bug-reporting-guide)
7. [Feature Requests](#feature-requests)
8. [Beta Community](#beta-community)
9. [Support Resources](#support-resources)
10. [Beta Completion](#beta-completion)

---

## Welcome & Overview

### Thank You for Joining!

You're part of an exclusive group testing TravelERP Lite, a **desktop ERP solution for travel agencies**. Your feedback will directly shape the final product.

### What is TravelERP Lite?

**TravelERP Lite** is a standalone desktop application that brings you:
- **Complete Travel Agency Management:** Leads, trips, invoices, collections, settlements
- **Offline Capability:** No internet required for daily operations
- **Multi-User Network Mode:** Share database across your team
- **Automatic Updates:** Stay current with latest features
- **Local Database:** Your data stays on your machine

### Beta Program Goals

We're testing for:
1. **Stability** - Crash-free operation
2. **Performance** - Speed with real data volumes
3. **Usability** - Intuitive workflows
4. **Network Mode** - Multi-user collaboration
5. **Import/Export** - Data portability
6. **Updates** - Smooth update experience

### What's Expected of You

- **Active Usage:** Use the app for real business operations when possible
- **Report Issues:** Bug reports with clear steps to reproduce
- **Share Feedback:** What works, what doesn't, what could be better
- **Try Features:** Test all major features, not just your daily workflow
- **Stay Updated:** Install updates promptly during beta period

### Time Commitment

- **Minimum:** 2-3 hours per week of active usage
- **Ideal:** 30 minutes daily usage + weekly feedback
- **Beta Duration:** 4 weeks (March 25 - April 22, 2026)

---

## Getting Started

### Step 1: Complete Installation

**Before proceeding:**
- Ensure you've completed installation (see INSTALL.md)
- Have your beta product key activated
- Application launches successfully

**If you haven't installed yet:**
1. Download from: https://beta.travelerp-lite.intelligrip.com
2. Follow INSTALL.md step-by-step
3. Complete first-run wizard
4. Return here when ready

### Step 2: Join Beta Community

**Beta Portal:**
- URL: https://beta.travelerp-lite.intelligrip.com
- Register your beta account
- Join the community forum
- Bookmark for quick access

**Community Forum:**
- URL: https://community.travelerp-lite.intelligrip.com
- Introduce yourself in "Introductions" section
- Share your travel agency background
- Connect with other testers

### Step 3: Set Up Feedback Channels

**Email (Primary):**
- Add to contacts: `beta@travelerp-lite.intelligrip.com`
- Use for bug reports, feature requests, questions

**In-App Feedback:**
- Go to: **Settings → Send Feedback** (coming soon)
- Quick feedback form without leaving app

**Slack/Discord (Optional):**
- Join real-time chat if available
- Quick questions and live discussions

### Step 4: Understand Beta Status

**This is BETA Software:**
- May contain bugs and issues
- Features may change
- Performance may vary
- **Always backup before critical operations**

**Production-Ready Areas:**
- Core ERP features (trips, invoices, collections)
- Database integrity
- Data import/export

**Being Tested:**
- Network mode stability
- Large dataset performance
- Update process
- Edge cases and error handling

---

## First Week Checklist

### Day 1: Installation & Basic Setup

- [ ] Install TravelERP Lite
- [ ] Activate beta license key
- [ ] Complete first-run wizard
- [ ] Join beta portal and community forum
- [ ] Post introduction in forum
- [ ] Create first backup

**Expected Outcome:** Application running, company info configured

---

### Day 2: Explore Core Features

- [ ] **Create a Customer:**
  - Go to Customers → Add Customer
  - Fill in all fields
  - Test validation (try invalid GSTIN, phone)

- [ ] **Create a Vehicle:**
  - Go to Vehicles → Add Vehicle
  - Link to owner (create owner first if needed)
  - Assign vehicle category

- [ ] **Create a Driver:**
  - Go to Drivers → Add Driver
  - Fill in license details
  - Upload photo (if applicable)

**Expected Outcome:** Basic master data created

---

### Day 3: Create a Complete Booking

- [ ] **Create a Lead:**
  - Go to Leads → Add Lead
  - Enter customer, trip details
  - Set lead status

- [ ] **Convert to Trip:**
  - From lead, create trip/duty slip
  - Enter trip details (dates, vehicle type)
  - Assign driver and vehicle

- [ ] **Generate Invoice:**
  - Go to Invoices → Create Invoice
  - Select trip to bill
  - Review invoice details
  - Generate PDF

**Expected Outcome:** Complete booking cycle tested

---

### Day 4: Test Reports & Settlements

- [ ] **Generate Reports:**
  - Try different report types
  - Apply filters (date range, customer, vehicle)
  - Export to Excel/PDF

- [ ] **Driver Settlement:**
  - Create driver settlement
  - Include trip details
  - Generate settlement PDF

- [ ] **Owner Settlement:**
  - Create owner settlement
  - Include trip earnings
  - Calculate deductions

**Expected Outcome:** Reports and settlements working

---

### Day 5: Data Import Test

- [ ] **Download Templates:**
  - Go to Settings → Data Import
  - Download all templates (customers, vehicles, etc.)

- [ ] **Prepare Test Data:**
  - Fill template with sample data
  - Include edge cases (special characters, missing fields)

- [ ] **Import Data:**
  - Run import wizard
  - Review validation results
  - Check for warnings/errors
  - Verify imported data

**Expected Outcome:** Import process tested and understood

---

### Day 6: Backup & Restore Test

- [ ] **Create Backup:**
  - Go to Settings → Backup & Restore
  - Create manual backup
  - Note backup file location

- [ ] **Add New Data:**
  - Create a test customer
  - Create a test trip

- [ ] **Restore Backup:**
  - Restore from backup
  - Verify new data is gone
  - Verify old data intact

**Expected Outcome:** Backup/restore process verified

---

### Day 7: Network Mode Test (Optional)

**If you have multiple computers:**

- [ ] **Server Setup:**
  - Computer 1: Settings → Network Settings
  - Select "Server" mode
  - Start server
  - Note IP address

- [ ] **Client Setup:**
  - Computer 2: Install TravelERP Lite
  - Settings → Network Settings
  - Select "Client" mode
  - Enter server IP
  - Connect

- [ ] **Test Collaboration:**
  - Create customer from client
  - View from server
  - Edit from server
  - Refresh on client

**Expected Outcome:** Network mode working (if tested)

---

## Testing Focus Areas

### Priority 1: Daily Workflow

**Test Your Real Business Processes:**

1. **Lead Management:**
   - Create leads from various sources (phone, email, walk-in)
   - Update lead statuses
   - Convert leads to trips
   - Search and filter leads

2. **Trip Operations:**
   - Create daily duty slips
   - Update trip status (in-progress, completed)
   - Handle trip modifications
   - Cancel trips if needed

3. **Invoicing:**
   - Generate different invoice types
   - Apply GST calculations
   - Handle credit notes
   - Bulk invoice generation

4. **Collections:**
   - Record payments
   - Track outstanding amounts
   - Payment follow-ups
   - Collection reports

### Priority 2: Data Import/Export

**Test Your Real Data:**

1. **Import Test:**
   - Export from your current system
   - Map to TravelERP Lite templates
   - Import actual business data
   - Verify accuracy

2. **Export Test:**
   - Export customers to Excel
   - Export trips to PDF
   - Verify formatting

### Priority 3: Performance

**Test With Real Data Volumes:**

1. **Large Dataset:**
   - Import 500+ customers
   - Create 100+ trips
   - Test list performance
   - Test search speed

2. **Concurrent Operations:**
   - Open multiple windows
   - Generate reports while editing
   - Test multi-user mode (if applicable)

### Priority 4: Network Mode

**If Applicable:**

1. **Server Stability:**
   - Run server continuously
   - Test multiple clients
   - Monitor performance

2. **Client Experience:**
   - Test all features from client
   - Measure latency
   - Test offline behavior (disconnect)

### Priority 5: Edge Cases

**Test Unusual Scenarios:**

1. **Data Edge Cases:**
   - Special characters in names
   - Very long descriptions
   - Missing optional fields
   - Invalid dates

2. **Operational Edge Cases:**
   - Cancel invoice after payment
   - Modify billed trip
   - Delete settled trip
   - Handle duplicate records

---

## How to Provide Feedback

### Feedback Categories

**1. Bug Reports**
- Issues that prevent normal operation
- Unexpected behavior
- Error messages
- Crashes or freezes

**2. Feature Requests**
- Missing functionality
- Enhancements to existing features
- Workflow improvements
- User interface suggestions

**3. General Feedback**
- User experience observations
- Performance issues
- Usability concerns
- Positive feedback too!

**4. Questions**
- How to do something
- Clarification on features
- Best practices
- Workarounds

### Feedback Format

**Good Feedback:**

```
Title: Invoice total doesn't match for multi-day trips

Severity: High

Steps to Reproduce:
1. Create a customer: "Test Customer"
2. Create a 3-day outstation trip
3. Generate invoice
4. Check total amount

Expected Behavior:
Invoice should show day-wise breakdown with total

Actual Behavior:
Total shows only first day amount

Environment:
- Windows 11
- 4 computers on network mode
- Database has 50 trips

Impact:
Cannot bill customers correctly for multi-day trips
Workaround: Calculate manually and create custom invoice
```

**Poor Feedback:**

```
Title: Invoice not working

It's broken. Please fix.
```

### Feedback Channels

**By Priority:**

1. **Critical Bugs (Blocking Business):**
   - Email: beta@travelerp-lite.intelligrip.com
   - Subject: [CRITICAL] Bug title
   - Response time: Within 4 hours

2. **Regular Bugs:**
   - Email: beta@travelerp-lite.intelligrip.com
   - Subject: [BUG] Bug title
   - Response time: Within 24 hours

3. **Feature Requests:**
   - Community Forum: Feature Requests category
   - Email: beta@travelerp-lite.intelligrip.com
   - Subject: [FEATURE] Feature title

4. **General Feedback:**
   - Community Forum: General category
   - In-App Feedback (when available)

5. **Questions:**
   - Community Forum: Questions category
   - Check documentation first

---

## Bug Reporting Guide

### What to Include

**Essential Information:**

1. **Title:** Clear, descriptive summary
2. **Severity:** Critical / High / Medium / Low
3. **Steps to Reproduce:** Numbered, detailed steps
4. **Expected Behavior:** What should happen
5. **Actual Behavior:** What actually happens
6. **Environment:** OS, data volume, network mode
7. **Impact:** How does this affect your work
8. **Frequency:** Always / Sometimes / Once

### Severity Levels

**Critical (Red):**
- Application crashes
- Data loss or corruption
- Security vulnerability
- Cannot perform core business function
- Network mode completely broken

**High (Orange):**
- Major feature broken
- Workaround exists but painful
- Significant performance degradation
- Data integrity issue (recoverable)

**Medium (Yellow):**
- Minor feature broken
- Inconvenient workaround exists
- UI/UX issue
- Performance slow but usable

**Low (Green):**
- Cosmetic issue
- Nice-to-have improvement
- Documentation error
- Rare edge case

### Screenshots & Logs

**When to Include:**

- **Always:** UI bugs, error messages
- **When helpful:** Complex workflows, unclear behavior
- **When requested:** Developer needs more info

**How to Capture:**

1. **Screenshot:**
   - Press `Win + Shift + S`
   - Select area
   - Paste in email/report

2. **Application Logs:**
   - Location: `%APPDATA%\TravelERP-Lite\logs\`
   - File: `travelerp-lite.log`
   - Attach to email

3. **System Information:**
   - Settings → System → About
   - Or Win + R → `msinfo32`

---

## Feature Requests

### How to Suggest Features

**Good Feature Request:**

```
Title: Add recurring trip scheduling

Problem:
I have daily trips for the same customer (airport transfers)
Currently I must create each trip manually

Proposed Solution:
Add "recurring trip" feature:
- Set frequency (daily, weekly, monthly)
- Set end date or occurrence count
- Auto-generate trips

Benefit:
Saves 30 minutes daily on manual entry
Would reduce errors from duplicate entry
Would help with capacity planning

Priority:
High - Daily time-saver
```

### Feature Request Categories

**1. Workflow Enhancements:**
- Faster ways to do common tasks
- Automation of repetitive work
- Better data entry workflows

**2. Reporting:**
- New report types
- Better filters
- Export improvements
- Dashboard widgets

**3. Integrations:**
- Accounting software (Tally, QuickBooks)
- Payment gateways
- SMS/WhatsApp notifications
- Email integration

**4. User Experience:**
- UI improvements
- Keyboard shortcuts
- Mobile responsiveness (if planning web version)

### What Happens to Your Request

1. **Review:** Development team reviews all requests
2. **Categorize:** Immediate / Future / Not planned
3. **Prioritize:** Based on demand, impact, feasibility
4. **Communicate:** Status update in community forum
5. **Implement:** If approved, added to roadmap

---

## Beta Community

### Forum Etiquette

**Be Respectful:**
- Everyone's learning together
- Constructive criticism only
- Appreciate others' contributions

**Be Helpful:**
- Answer questions if you know the answer
- Share workarounds you've discovered
- Support fellow testers

**Be Clear:**
- Use descriptive titles
- Provide context
- Include steps/screenshots

**Be Patient:**
- Developers are reading all feedback
- Not all suggestions can be implemented
- Beta is for learning

### Community Sections

**1. Announcements:**
- Official updates
- New beta releases
- Known issues
- Upcoming features

**2. Introductions:**
- Say hello!
- Your travel agency background
- What you hope to test

**3. Bug Reports:**
- Post bugs here
- Check duplicates first
- Discuss workarounds

**4. Feature Requests:**
- Suggest improvements
- Vote on ideas
- Discuss proposals

**5. General Discussion:**
- Tips and tricks
- Best practices
- Show and tell

**6. Questions:**
- Ask how to do something
- Help others
- Share knowledge

### Recognition Program

**Active Contributors:**
- Weekly shoutouts in forum
- Beta completion badge
- Case study opportunities
- Priority for future betas

**Top Testers:**
- Free 3-month license extension
- Featured in final release credits
- Discounted first-year subscription
- Direct developer access

---

## Support Resources

### Documentation

**Online Docs:**
- User Guide: https://docs.travelerp-lite.intelligrip.com
- API Docs: (for developers)
- FAQ: https://docs.travelerp-lite.intelligrip.com/faq

**Video Tutorials:**
- Getting Started: https://learn.travelerp-lite.intelligrip.com/start
- Features Playlist: https://learn.travelerp-lite.intelligrip.com/features
- Advanced Tips: https://learn.travelerp-lite.intelligrip.com/advanced

### Direct Support

**Email Support:**
- General: support@travelerp-lite.intelligrip.com
- Beta-specific: beta@travelerp-lite.intelligrip.com
- Response time: 24 hours (usually faster)

**Phone Support:**
- Number: +91-XXXXXXXXXX
- Hours: Mon-Fri, 9 AM - 6 PM IST
- For: Critical issues only

**WhatsApp:**
- Number: +91-XXXXXXXXXX
- For: Quick questions, clarifications
- Response time: Within 1 hour during business hours

### Getting Help Effectively

**Before Asking:**
1. Check documentation
2. Search community forum
3. Check known issues in RELEASE_NOTES.md
4. Try reproducing on your own

**When Asking:**
1. Describe what you're trying to do
2. What you've already tried
3. What happened (error messages, screenshots)
4. Your environment (OS, single/multi-user)

---

## Beta Completion

### Week 4: Final Feedback

**Final Tasks:**

1. **Complete Survey:**
   - Detailed feedback form
   - Overall experience rating
   - Feature usage statistics
   - Bug summary

2. **Data Migration Plan:**
   - Decide: migrate to final release or export data
   - Backup your beta database
   - Document any customizations

3. **Subscription Options:**
   - Beta tester discount: 50% off first year
   - Choose plan: Monthly/Quarterly/Annual
   - Payment setup

### Post-Beta Transition

**Timeline:**
- **April 22:** Beta ends
- **April 22-26:** Feedback review period
- **May 1:** Final release

**What Happens:**
1. Beta license expires
2. Final release available
3. Update notification sent
4. Migrate to final version

**Migration Process:**
1. Backup beta data
2. Install final release
3. Restore backup (if continuing)
4. Activate production license
5. Verify all data

### Beta Benefits

**For Active Testers:**
- Free 3-month license extension
- 50% discount on first year
- Priority support for 6 months
- Influence on product roadmap

**For All Testers:**
- Certificate of participation
- Final release credits
- Early access to new features
- Community membership

---

## Quick Reference

### Essential Links

- **Beta Portal:** https://beta.travelerp-lite.intelligrip.com
- **Community Forum:** https://community.travelerp-lite.intelligrip.com
- **Documentation:** https://docs.travelerp-lite.intelligrip.com
- **Video Tutorials:** https://learn.travelerp-lite.intelligrip.com

### Contact Information

- **Beta Email:** beta@travelerp-lite.intelligrip.com
- **Support Email:** support@travelerp-lite.intelligrip.com
- **Phone:** +91-XXXXXXXXXX (Mon-Fri 9 AM - 6 PM IST)
- **WhatsApp:** +91-XXXXXXXXXX

### Key Files

- **Installation:** INSTALL.md
- **Release Notes:** RELEASE_NOTES.md
- **This Guide:** BETA_ONBOARDING.md

### Important Locations

- **Backups:** `%APPDATA%\TravelERP-Lite\backups\`
- **Logs:** `%APPDATA%\TravelERP-Lite\logs\`
- **Database:** `%APPDATA%\TravelERP-Lite\postgres\data\`

---

## Congratulations!

You're now ready to begin testing TravelERP Lite. Remember:

- **Start slow:** Don't try to test everything at once
- **Report issues:** Early reports help us fix faster
- **Stay engaged:** Active feedback = better product
- **Have fun:** This is your chance to shape the product!

**Thank you for being part of the TravelERP Lite journey!**

---

*Beta Onboarding Guide v1.0.0*
*Last Updated: March 25, 2026*
*© 2026 Intelligrip. All Rights Reserved.*
