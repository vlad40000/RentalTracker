# Rental Tracker Sales Demo

A single-owner rental ledger built with Next.js App Router, Neon Postgres, and Vercel. The sales demo combines a dense, realistic portfolio interface with an append-only financial model designed to prevent accidental data loss.

## Current-portfolio demo dataset

`npm run db:seed` creates a date-relative demonstration based on the approved current tenant roster and three months of payment patterns supplied with the project:

- 17 single-family properties and 17 active leases
- Three months of rent, water/trash charges, and payments
- Partial payments, unpaid charges, overpayments, and unapplied tenant credits
- $4,006.94 in gross open charges, $454.38 in unapplied credit, and a $3,552.56 net position in the imported source pattern
- A linked returned-check payment reversal
- Current expenses and a completed scheduled-export record
- One committed workbook import and one failed batch
- 16 source contradictions preserved in an interactive Import Review Queue instead of being silently corrected

The source has legitimate disagreements between standing lease rent and amounts actually billed. The app preserves both facts: lease terms remain the standing agreement, while Charges record the imported billing history.

### Tenant-name privacy

Tenant names are masked by default. Set this only for a controlled presentation where the owner has approved displaying the names:

```env
DEMO_SHOW_REAL_TENANT_NAMES=true
```

Run `npm run db:seed` again after changing the value. Property postal code is masked in the sales dataset.

When `DEMO_MODE=true`, **Settings → Reset current portfolio demo** reconstructs the original 17-property state. Reset requires typing `RESET SAMPLE PORTFOLIO`.

## What is implemented

- Open demo access with no sign-in requirement while demo mode is enabled
- One-screen adaptive setup for property count, unit type, phone access, and history depth
- Navigation and layout capabilities derived from setup answers and actual portfolio size
- Sales-oriented dashboard with the immediate paid-status verdict, overdue tenants, collections, expenses, YTD cash, credits held, occupancy, recent activity, backup status, and import-integrity warning
- Property and unit creation
- Tenant, lease, initial rent term, and dated rent-change creation
- Idempotent monthly rent generation
- Separate rent and utility Charges
- Tenant-scoped payments allocated oldest-first across only that tenant's charges
- Partial payments, spanning payments, and unapplied payment balances
- Zelle, Venmo, ACH, check, cash, card, money order, and other payment methods
- One-off charges and expenses
- Append-only corrections through linked reversal entries
- Soft-delete and one-click restore for Properties
- Chronological ledger with property, tenant, and date filters
- CSV import with transaction rollback on failure and whole-batch reversal
- Import Review Queue with resolved/dismissed audit status
- Full JSON export and ZIP containing one CSV per table
- Nightly versioned JSON and CSV exports to private Vercel Blob storage
- Restore into an empty migrated database only

## Data-safety design

### Financial records

PostgreSQL triggers reject `UPDATE` and `DELETE` on:

- `charges`
- `payments`
- `payment_allocations`
- `expenses`

Corrections append signed reversal rows linked to the original record. Originals remain visible in the ledger.

### Non-financial records

Properties, Units, Tenants, Leases, and rent terms use archive/soft-delete fields. Every foreign key uses `ON DELETE RESTRICT`; there are no cascade deletes.

Import Review Items are workflow metadata, not money records. They may be marked resolved or dismissed without changing the imported ledger.

### Balances

No balance column exists. Open balances are derived from effective Charges minus signed Payment Allocations. Unapplied credits are derived independently from Payment amounts minus allocations.

### Restore

Restore is accepted only when every application table is empty:

1. Create a fresh Neon branch or database.
2. Point a temporary deployment or local checkout at it.
3. Run migrations.
4. Open **Settings → Data safety**.
5. Select the canonical JSON export.
6. Type `RESTORE INTO EMPTY DATABASE`.
7. Verify the dashboard and ledger before switching the production connection string.

## Where data physically lives

- Structured application data: Neon Postgres through `DATABASE_URL`
- Nightly backups: private Vercel Blob objects under `rental-tracker/nightly/`
- Manually downloaded backups: the storage location selected by the owner
- Receipt images and PDFs: private Vercel Blob objects referenced by Expense rows

## Local setup

Requirements: Node.js 22+, a Neon Postgres database, and npm access.

```bash
cp .env.example .env.local
npm install
npm run demo
```

`npm run demo` applies migrations, restores the current portfolio demo, and starts Next.js at `http://localhost:3000`.

Default credentials:

- Email: `owner@example.com`
- Password: `demo-only-change-me`

The **Explore the Sample Portfolio** button creates the same signed, HttpOnly demo session without credential entry.

## Environment variables

- `DATABASE_URL`: Neon pooled Postgres connection string
- `DEMO_MODE`: open demo access is the current default; set exactly `false` to enable the temporary credential gate
- `DEMO_SHOW_REAL_TENANT_NAMES`: defaults false; exactly `true` opts into approved real names on the next seed/reset
- `DEMO_AUTH_SECRET`: used only when `DEMO_MODE=false`; then it must contain at least 32 random characters
- `DEMO_OWNER_EMAIL`, `DEMO_OWNER_PASSWORD`: temporary credentials used only when `DEMO_MODE=false`
- `CRON_SECRET`: protects the nightly export route
- `BLOB_READ_WRITE_TOKEN`: provided when Vercel Blob is connected

## Deploy to Vercel

1. Create or link a Vercel project.
2. Add Neon through Vercel Marketplace or provide `DATABASE_URL`.
3. Add Vercel Blob.
4. Configure the environment variables.
5. Run `npm run db:migrate` against the demo database.
6. Run `npm run db:seed` once.
7. Deploy.

`vercel.json` invokes `/api/cron/nightly-export` daily at 05:15 UTC. The route verifies `Authorization: Bearer $CRON_SECRET`.

## Import format

Download `/import-template.csv`. Required columns:

- `type`: `payment`, `charge`, or `expense`
- `property_address`: exact active street address
- `date`: ISO date (`YYYY-MM-DD`)
- `amount`: positive dollar amount

The importer rejects ambiguous property matches and unsupported row types rather than guessing.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The tests cover capability derivation, rent-generation idempotency, partial and spanning payments, reversal behavior, export/restore, current-portfolio seed totals, name masking, and future-date prevention.

## Before real use

- Replace dummy authentication.
- Disable `DEMO_MODE` and reset access.
- Decide whether real tenant names should ever appear outside a controlled owner demonstration.
- Run a deployed restore acceptance test against a disposable Neon branch.
- Decide whether public CSV uploads should remain enabled.
- Add production monitoring, rate limiting, and stronger authorization controls.
