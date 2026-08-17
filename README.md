# Dual-Shop Retail POS

Production-oriented offline-first retail POS for independent shop installations.

## Planned shops
- Shop A — Cosmetics & Provisions
- Shop B — Shisha

The two installations use the same application engine while maintaining completely separate local and synchronized online data.

## Architecture
- Electron + React + TypeScript
- SQLite local database
- Offline-first transaction processing
- Online synchronization when connectivity is available
- Barcode scanner support
- ESC/POS thermal receipt printing
- Cash and Mobile Money payments

## Status
Initial repository setup. Production implementation is being built incrementally with transaction safety, synchronization, security, testing, and deployment treated as first-class requirements.
