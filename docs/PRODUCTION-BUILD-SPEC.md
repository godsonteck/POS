# Production POS Completion Contract

This document is the implementation contract for the Dual-Shop Retail POS. A release is not considered production-ready until every item below is implemented and tested.

## Product
- Independent Shop A (Cosmetics & Provisions) and Shop B (Shisha) configurations from one codebase.
- No cross-shop inventory, sales, cashier, or dashboard data.
- GHS currency represented internally as integer pesewas.

## Cashier workflow
1. Secure username/PIN authentication.
2. Open shift with opening cash.
3. Fast product search and barcode scanner input.
4. Cart quantity editing and removal.
5. Cash payment with tendered amount and change.
6. Mobile Money payment with reference capture.
7. Atomic checkout: sale, items, payment, stock movement, audit event, and sync event commit together.
8. Receipt preview and thermal printing.
9. Void before finalization.
10. Close shift and reconcile expected vs counted cash.

## Owner workflow
- Product CRUD, category CRUD, barcode/SKU uniqueness.
- Stock adjustment with mandatory reason and audit trail.
- Low-stock dashboard.
- Sales history and sale detail.
- Cash vs Mobile Money totals by day/date range.
- Staff creation, activation/deactivation, and PIN reset.
- Shift/reconciliation review.
- Backup/export and restore with validation.
- Sync configuration and health.
- Audit log.

## Offline-first guarantees
- Checkout never requires network access.
- SQLite WAL + FULL synchronous durability.
- Every financial operation is transactionally persisted before UI success.
- Outbox survives restart and power loss.
- Exponential retry with jitter.
- Network/auth/server errors are distinguishable.
- Sync never blocks checkout.

## Sync contract
- Versioned event envelope with event ID, shop ID, sequence, entity, operation, timestamp and payload.
- Idempotent server ingestion.
- Cursor-based pull.
- Transactional local apply.
- Applied-event deduplication.
- Product/catalog synchronization.
- Immutable sale synchronization using a complete sale envelope; sales are never overwritten by product updates.
- Stock synchronization uses immutable movements rather than last-write-wins stock quantities.
- Deterministic conflict rules for catalog/settings.
- No synchronization loops.

## Hardware
- USB/Bluetooth scanners treated as keyboard input.
- ESC/POS thermal printer support.
- Network printer support.
- Configurable paper width.
- Printer failure must not lose a completed sale; receipt can be reprinted from sale history.

## Security
- Password/PIN hashes only; never store plaintext PINs.
- Renderer has no Node.js or database access.
- Electron IPC validates arguments.
- Owner-only administrative actions enforced in the main process/service layer, not merely hidden in UI.
- Audit sensitive mutations.
- Secrets/tokens stored outside source control.

## UI direction
The UI must not resemble a generic Bootstrap/admin dashboard or an AI-generated template.

Visual direction: premium Ghanaian retail operations console — warm off-white/graphite surfaces, strong typographic hierarchy, restrained accent color derived from shop branding, compact data density, large cashier targets, subtle depth, and clear financial emphasis.

### Cashier POS
- Full-height workspace.
- Product/search area on the left/center.
- Persistent cart and payment panel on the right.
- Barcode input always focusable.
- Keyboard-first shortcuts alongside touch targets.
- Stock and price visible without opening dialogs.
- Payment confirmation is a focused, distraction-free step.

### Owner workspace
- Overview cards for today's sales, cash, Mobile Money, low stock, open shifts, and sync health.
- Dense but readable tables.
- Inline status chips and contextual actions.
- Avoid excessive cards, gradients, glassmorphism, oversized empty areas, and decorative charts with no operational value.

### Accessibility and usability
- Keyboard navigation.
- Visible focus states.
- Minimum 44px interactive targets.
- High contrast.
- Clear destructive-action confirmation.
- Responsive layout for 1366x768 low-end desktop screens and touch displays.

## Release gates
A build cannot be called production-ready until:
- TypeScript/build passes.
- Unit tests pass.
- Database migration tests pass against a pre-existing database.
- Checkout crash/rollback tests pass.
- Duplicate sync tests pass.
- Offline/reconnect sync tests pass.
- Printer failure/reprint tests pass.
- Authentication and authorization tests pass.
- Backup/restore tests pass.
- Shop isolation tests pass.
- Windows packaged installer is generated and smoke-tested.
