# Cosmetics & Provisions POS — Product Scope

This deployment is exclusively for the Cosmetics & Provisions retail shop.

## Included
- Owner and cashier accounts
- Cashier shifts and reconciliation
- Barcode/product search
- Product and category management
- Inventory and low-stock monitoring
- Cash and Mobile Money sales
- Receipts and reprints
- Sales history and operational reporting
- Offline-first SQLite persistence
- Online synchronization and durable outbox
- Backup and restore
- Audit trail
- Windows desktop deployment

## Explicitly excluded from this deployment
- Shisha shop workflows
- Shisha catalog/branding
- Cross-shop dashboards
- Cross-shop inventory
- Shared sales data
- Multi-branch reporting

The application may be architected as a reusable POS engine so a separate Shisha deployment can be created later, but Shisha functionality must not appear in this product's navigation, catalog, seed data, reports, or operational workflows.

## UI direction
The product should feel like a premium, purpose-built Ghanaian retail operations tool: fast, tactile, information-dense without being cluttered, and unmistakably designed for cosmetics/provisions retail. Avoid generic admin templates, decorative dashboards, excessive cards, stock illustrations, and AI-looking visual patterns.
