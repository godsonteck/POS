# Dual-Shop Retail POS — Engineering Plan

## V1 objective
Build one maintainable POS engine that can be installed independently for Shop A (Cosmetics & Provisions) and Shop B (Shisha). Each installation has isolated local data and an isolated online synchronization identity.

## Core invariants
1. Selling must never require internet connectivity.
2. Money is stored as integer pesewas; no floating-point arithmetic for financial values.
3. Completing a sale atomically records the sale, items, payment, stock deduction, stock movement, audit event and synchronization outbox event.
4. Every synchronized operation is idempotent; retries must not duplicate sales or stock changes.
5. A cashier cannot manipulate products, users or protected stock operations without permission.
6. Power loss or process termination must not leave a partially committed sale.
7. Shop A and Shop B must never share operational data.

## Delivery order
- Local database and migrations
- Authentication and first-run shop setup
- Product/category CRUD and inventory ledger
- Cashier POS and barcode workflow
- Cash/MoMo payment and receipt printing
- Sales history and daily totals
- Cashier shifts and reconciliation
- Owner controls and audit log
- Backup/restore
- Online sync service and retry/conflict handling
- Shop-specific configuration
- Automated tests and hardware/deployment verification

## Explicit V1 exclusions
Supplier management, purchase orders, accounting/P&L, online storefront, combined multi-shop dashboard and payroll are outside the current scope.

## Production gate
The system is not considered production-ready until critical checkout, stock, authentication, backup/recovery, synchronization and receipt-printing paths have automated tests and a documented hardware verification pass.
