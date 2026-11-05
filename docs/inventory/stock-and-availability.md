# Inventory stock and availability

## Rules

- Simple products without variants use their own on-hand and reserved quantities.
- Products with any non-deleted variants use variant inventory, including legacy products marked Simple. Never fall back to the parent quantity because every variant is inactive.
- Available units for each SKU are `max(on hand - reserved, 0)`. Calculate each active variant independently. A healthy variant cannot compensate for a low-stock variant.
- Active variant totals are a summary, not another inventory pool. Disabled variant stock and reservations are shown separately.
- Enabled and published are separate from stock. Zero stock blocks purchase without changing the enabled setting. An unpublished or disabled product cannot be purchased even if it has stock.
- Disabling a variant retains its on-hand stock and reservations for existing orders, excludes it from replenishment alerts, and prevents new purchases. Re-enabling it makes its current stock eligible for alerts again.
- Low stock means positive available stock at or below the configured threshold; zero available means out of stock. A threshold of zero reports only stockouts.
- Existing backend safeguards reject reductions below reserved stock, reject deletion of reserved variants, and protect type changes while variants exist.
- Dashboard alert requests now synchronize current inventory before listing alerts/counts. Disabled and restocked items no longer wait for the scheduled alert cycle to disappear from that table.
- Variant edits displayed in the parent summary can be drafts. The editor explicitly labels unsaved variant changes.

For example: IGA variant stock 22, reserved 19, available 3. A parent quantity of 50 is not the quantity for that SKU.

## Industry reference

Shopify separates on-hand, committed, and available inventory and tracks inventory per variant. Our existing system has on-hand and reserved quantities, without Shopify's additional location and unavailable-stock states:

- https://help.shopify.com/en/manual/inventory-and-locations/fundamentals/inventory-states
- https://help.shopify.com/en/manual/inventory-and-locations/setup

## Files changed for this work

- `client/src/components/admin/InventoryStockSummary.jsx`
- `client/src/components/admin/ProductVariantsPanel.jsx`
- `client/src/components/admin/dashboard/InventoryAlertsWidget.jsx`
- `client/src/components/admin/dashboard/InventoryWarningsWidget.jsx`
- `client/src/pages/admin/ProductEditPage.jsx`
- `client/src/test/components/InventoryStockSummary.test.jsx`
- `client/src/test/components/InventoryWarningsWidget.test.jsx`
- `client/src/test/pages/admin/ProductEditPage.test.jsx`
- `server/src/modules/cart/cart.service.js`
- `server/src/modules/order/order.service.js`
- `server/src/modules/inventory/inventoryAlert.service.js`
- `server/tests/unit/cart.inventoryAvailability.test.js`
- `server/tests/unit/inventory.availabilityRules.test.js`
- `server/tests/unit/inventory.dashboardRefresh.test.js`
- `docs/inventory/stock-and-availability.md`

## Verification commands

Run from the repository root:

```bash
npm --prefix client test -- src/test/pages/admin/ProductEditPage.test.jsx src/test/pages/admin/ProductEditPage.validation.test.jsx src/test/components/ProductVariantsPanel.test.jsx src/test/components/InventoryStockSummary.test.jsx src/test/components/InventoryWarningsWidget.test.jsx
npm --prefix server test -- run tests/unit/inventory.dashboardRefresh.test.js tests/unit/inventory.availabilityRules.test.js tests/unit/cart.inventoryAvailability.test.js tests/unit/admin.inventory.test.js tests/unit/inventory.variant.stock.test.js tests/unit/inventory.alert.cycle.test.js tests/unit/inventory.shipmentCancellation.test.js tests/unit/attribute.service.test.js tests/unit/order.service.test.js
npm --prefix client run build
git diff --check
```

## Limits and follow-up checks

Tests use component rendering and mocked services; they do not verify production database records, live browser appearance, or simultaneous checkout/admin writes against PostgreSQL. Dashboard synchronization adds database reads/writes to its alert request. Dashboard widgets are separate requests and can briefly differ if stock changes between requests. Bundle/component allocation, multiple warehouses, damaged stock, and backorders are separate workflows and were not redesigned here. Existing parent aggregate persistence was not migrated or reconciled; the editor and alerts use variant rows for the correct per-SKU figures.

No deployment or production inventory adjustment is performed by this change.
