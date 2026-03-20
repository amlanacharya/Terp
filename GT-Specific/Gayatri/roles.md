# TravelERP Role Permission Map

## Control Layers

TravelERP enforces permissions through two layers:

1. **Backend** — `roleCheck(['admin', 'manager', ...])` middleware on protected API routes in `server/src/middleware/auth.ts`
2. **Frontend** — Sidebar visibility, `ProtectedRoute` checks, and component-level action hiding

---

## Role Permission Matrix

| Action                              | Admin | Manager | Accountant | Operator | Viewer |
| ----------------------------------- | :---: | :-----: | :--------: | :------: | :----: |
| **Leads — create/edit**             |   ✅   |    ✅    |      ❌     |     ✅    |    ❌   |
| **Leads — delete**                  |   ✅   |    ✅    |      ❌     |     ❌    |    ❌   |
| **Trips — create/edit**             |   ✅   |    ✅    |      ❌     |     ✅    |    ❌   |
| **Trips — delete**                  |   ✅   |    ✅    |      ❌     |     ❌    |    ❌   |
| **Trips — bill/calculate**          |   ✅   |    ✅    |      ✅     |     ✅    |    ❌   |
| **Customers — create/edit**         |   ✅   |    ✅    |      ❌     |     ❌    |    ❌   |
| **Customers — delete**              |   ✅   |    ✅    |      ❌     |     ❌    |    ❌   |
| **Drivers/Vehicles — create/edit**  |   ✅   |    ✅    |      ❌     |     ✅    |    ❌   |
| **Drivers/Vehicles — delete**       |   ✅   |    ✅    |      ❌     |     ❌    |    ❌   |
| **Invoices — create/edit**          |   ✅   |    ✅    |      ✅     |     ❌    |    ❌   |
| **Invoices — void**                 |   ✅   |    ✅    |      ❌     |     ❌    |    ❌   |
| **Invoices — write-off**            |   ✅   |    ❌    |      ❌     |     ❌    |    ❌   |
| **Invoices — delete**               |   ✅   |    ✅    |      ❌     |     ❌    |    ❌   |
| **Collections — create/edit**       |   ✅   |    ✅    |      ✅     |     ❌    |    ❌   |
| **Collections — delete**            |   ✅   |    ✅    |      ❌     |     ❌    |    ❌   |
| **Settlements — create/edit**       |   ✅   |    ✅    |      ✅     |     ❌    |    ❌   |
| **Settlements — delete**            |   ✅   |    ✅    |      ❌     |     ❌    |    ❌   |
| **Tax Config — create/edit/delete** |   ✅   |    ❌    |      ✅     |     ❌    |    ❌   |
| **Rate Charts — create/edit**       |   ✅   |    ✅    |      ❌     |     ✅    |    ❌   |
| **Rate Charts — delete**            |   ✅   |    ✅    |      ❌     |     ❌    |    ❌   |
| **Settings page**                   |   ✅   |    ❌    |      ❌     |     ❌    |    ❌   |
| **All GETs / read-only views**      |   ✅   |    ✅    |      ✅     |     ✅    |    ✅   |

---

## Summary by Role

### Admin

* Full platform access
* Only role that can perform **invoice write-off**
* Only role with access to **Settings**

### Manager

* Broad operational and financial access
* Cannot perform **invoice write-off**
* Cannot manage **Tax Config**

### Accountant

* Finance-focused role
* Can manage **Invoices, Collections, Settlements, and Tax Config**
* No access to operational master data such as trips, leads, drivers, or vehicles

### Operator

* Operations-focused role
* Can manage **Leads, Trips, Drivers, Vehicles, and Rate Charts**
* No finance write access

### Viewer

* Read-only access across the platform
* No create, edit, delete, or approval actions

---

## Design Notes

* **Backend is the source of truth** for access control
* **Frontend improves UX** by hiding unauthorized navigation and actions
* This model supports a clean split between **operations**, **finance**, and **administration**
* The permission set is suitable for ERP-style deployments where accidental cross-functional access must be minimized

---

## Demo Login Credentials

| Role       | Email                         | Password       |
| ---------- | ----------------------------- | -------------- |
| Admin      | `admin@travelerp.com`         | `Admin@123456` |
| Manager    | `manager.gt@travelerp.com`    | `GTDemo@123`   |
| Accountant | `accountant.gt@travelerp.com` | `GTDemo@123`   |
| Operator   | `operator.gt@travelerp.com`   | `GTDemo@123`   |
| Viewer     | `viewer.gt@travelerp.com`     | `GTDemo@123`   |
