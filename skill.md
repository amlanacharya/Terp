# TravelERP Project Guide

## Overview

TravelERP is a local-first travel and fleet ERP for Indian operators. It manages trips, drivers, vehicles, customers, invoices, collections, settlements, reporting, and system settings.

This version is migrated away from Supabase cloud services. The frontend now calls a local Express API, and the API talks to a local PostgreSQL database.

## Tech Stack

- Frontend: React 18, TypeScript, Vite, Tailwind utility classes
- Backend: Express, TypeScript, `pg`
- Database: PostgreSQL 15+
- Auth: JWT access tokens + bcrypt password hashing

## Architecture

```text
Browser (5173)
  -> Vite dev server / static build
  -> /api proxy
Express API (3001)
  -> JWT auth middleware
  -> SQL queries via pg Pool
PostgreSQL (5432)
  -> Local schema + seed data
```

## Database Summary

The schema lives in [server/db/schema.sql](/C:/travelerp/server/db/schema.sql). Core tables:

- `profiles`: local users with password hashes and roles
- `customers`: billing customers
- `owners_vendors`: vehicle owners and vendor records
- `drivers`: driver master data
- `routes`: route definitions
- `vehicles`: owned and vendor vehicle master
- `gst_rates`: GST reference rates
- `trips`: operational trip records
- `trip_expenses`: trip expense lines
- `invoices`: customer invoices
- `invoice_items`: invoice line items
- `collections`: invoice collections
- `driver_settlements`: payouts to drivers
- `owner_settlements`: payouts to owners and vendors
- `audit_log`: audit storage
- `system_settings`: app configuration

## Auth Model

- Roles: `admin`, `manager`, `accountant`, `operator`, `viewer`
- Passwords are hashed with bcrypt before storage
- API tokens are JWTs stored in browser `localStorage`
- Protected frontend views depend on the profile role from [src/contexts/AuthContext.tsx](/C:/travelerp/src/contexts/AuthContext.tsx)

## Feature Map

- App shell: [src/App.tsx](/C:/travelerp/src/App.tsx)
- Auth: [src/components/Auth/Login.tsx](/C:/travelerp/src/components/Auth/Login.tsx), [src/components/Auth/ProtectedRoute.tsx](/C:/travelerp/src/components/Auth/ProtectedRoute.tsx)
- Layout: [src/components/Layout/Header.tsx](/C:/travelerp/src/components/Layout/Header.tsx), [src/components/Layout/Sidebar.tsx](/C:/travelerp/src/components/Layout/Sidebar.tsx)
- Dashboard: [src/components/Dashboard/Dashboard.tsx](/C:/travelerp/src/components/Dashboard/Dashboard.tsx)
- Trips: [src/components/Trips/TripList.tsx](/C:/travelerp/src/components/Trips/TripList.tsx)
- Drivers: [src/components/Drivers/DriverList.tsx](/C:/travelerp/src/components/Drivers/DriverList.tsx)
- Vehicles: [src/components/Vehicles/VehicleList.tsx](/C:/travelerp/src/components/Vehicles/VehicleList.tsx)
- Customers: [src/components/Customers/CustomerList.tsx](/C:/travelerp/src/components/Customers/CustomerList.tsx)
- Owners: [src/components/Owners/OwnerList.tsx](/C:/travelerp/src/components/Owners/OwnerList.tsx)
- Invoices: [src/components/Invoices/InvoiceList.tsx](/C:/travelerp/src/components/Invoices/InvoiceList.tsx)
- Collections: [src/components/Collections/CollectionList.tsx](/C:/travelerp/src/components/Collections/CollectionList.tsx)
- Driver settlements: [src/components/Settlements/DriverSettlements.tsx](/C:/travelerp/src/components/Settlements/DriverSettlements.tsx)
- Owner settlements: [src/components/Settlements/OwnerSettlements.tsx](/C:/travelerp/src/components/Settlements/OwnerSettlements.tsx)
- Reports: [src/components/Reports/Reports.tsx](/C:/travelerp/src/components/Reports/Reports.tsx)
- Settings: [src/components/Settings/Settings.tsx](/C:/travelerp/src/components/Settings/Settings.tsx)

## API Endpoints

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/auth/me`
- `GET /api/dashboard/stats`
- `GET|POST|PUT|DELETE /api/trips`
- `GET|POST|PUT|DELETE /api/drivers`
- `GET|POST|PUT|DELETE /api/vehicles`
- `GET|POST|PUT|DELETE /api/customers`
- `GET|POST|PUT|DELETE /api/owners`
- `GET|POST|PUT|DELETE /api/invoices`
- `GET|POST|PUT|DELETE /api/collections`
- `GET /api/settlements/drivers`
- `GET /api/settlements/owners`
- `GET /api/reports`
- `GET /api/settings`
- `PUT /api/settings/:key`

## Coding Conventions

- Keep backend SQL explicit. No ORM layer is used.
- Keep response shapes stable so frontend JSX does not need remapping.
- Use `apply_patch` for source edits.
- Prefer strict TypeScript types in both frontend and backend.
- Keep auth decisions centralized in middleware and `AuthContext`.

## Default Seed Credentials

- Email: `admin@travelerp.com`
- Password: `Admin@123456`
