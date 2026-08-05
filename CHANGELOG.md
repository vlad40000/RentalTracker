# v0.3.0 — Current Portfolio Demo

- Replaced the generic three-property seed with the approved 17-property current-portfolio roster and payment patterns.
- Added masked-by-default tenant names with controlled `DEMO_SHOW_REAL_TENANT_NAMES=true` opt-in.
- Added separate utility Charges for water/trash.
- Added a 16-item Import Review Queue for rent, identity, occupancy, date, and balance contradictions.
- Added review resolve/dismiss actions with audit entries.
- Added dashboard import-integrity warning and unapplied-credit visibility.
- Added a linked returned-check reversal and current demo Expenses.
- Added `import_review_items` to full CSV/JSON export and restore, including compatibility for v0.2 exports that predate the table.
- Prevented monthly generation from duplicating imported rent for the same Lease and month.
- Fixed the duplicate tenant query in ledger filter options.
- Expanded verification to 14 domain tests.
