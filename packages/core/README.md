# POS Core

The core package owns business-domain types and the SQLite schema.

## Data invariants

- Money is stored as integer pesewas, never floating-point values.
- Checkout must be a single database transaction: sale, sale items, payment, stock deductions, stock movements, audit event, and sync outbox entry succeed or fail together.
- The local SQLite database is the operational source for offline checkout.
- Sync is asynchronous and must be idempotent; the shop must never wait for the network to complete a sale.
- Product barcode values are unique per shop installation.
- Every completed sale has a unique receipt number.
- Stock can never become negative.
