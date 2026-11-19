# Inventory stock and availability

## Rules

- The saved product type is authoritative. Simple products use `quantity` and `reservedQty`, even if historical variant rows still exist. Variable products use each active variant's `stockQty` and `reservedQty`.
- Available units for each current inventory item are `max(on hand - reserved, 0)`. A healthy variant cannot compensate for a low-stock variant on a Variable product.
- Simple inventory can be edited without converting the product to Variable. Existing reservations still set the minimum allowed stock.
- Historical Simple variant rows are retained for orders, excluded from current alerts and public option selection, and cannot be edited through the variant editor. A new Simple purchase cannot supply an old variant ID.
- Shipping, returning, or releasing a historical variant order applies its stock/reservation delta to the Simple product pool. It does not recompute that pool from old variant rows or overwrite newer Simple stock. Inconsistent historical reservations stop the transaction for reconciliation.
- Variable editor totals are labelled as combined totals, with a per-SKU stock table beneath. Dashboard variant alerts preserve the variant ID in the link and select the matching row. An obsolete variant link on a Simple product explains that the product now uses standalone stock.
- Enabled and published are separate from stock. Disabled or unpublished items cannot be purchased or trigger replenishment alerts. Disabling retains stock and reservations.
- Zero available means out of stock; positive available at or below the configured threshold means low stock. A threshold of zero reports only stockouts.
- Type changes remain blocked while stock is reserved. Switching Simple to Variable requires confirmation even after standalone stock reaches zero when historical variant rows exist; it clears their stale on-hand quantities before they become purchasable again. Any outstanding historical variant reservations block the switch. Stock is not automatically distributed.
- Dashboard alert requests synchronize current inventory before listing alerts/counts. Old variant alerts for Simple products are resolved during synchronization.
- Unsaved Variable edits remain labelled as drafts and are preserved while saving parent product details.

For IGA marked Simple with product stock 50 and reserved 27, the current available stock is 23. A historical variant with stock 22 and reserved 19 must not produce a separate "3 available" warning. If the saved type is Variable, those same figures correctly produce a per-variant alert.

## Industry reference

Shopify separates on-hand, committed, and available inventory and tracks inventory per variant. Our existing system has on-hand and reserved quantities, without Shopify's additional location and unavailable-stock states:

- https://help.shopify.com/en/manual/inventory-and-locations/fundamentals/inventory-states
- https://help.shopify.com/en/manual/inventory-and-locations/setup

## Files changed for this follow-up

- `CHANGELOG.md`
- `VERSION`
- `client/src/components/admin/InventoryStockSummary.jsx`
- `client/src/components/admin/dashboard/InventoryAlertsWidget.jsx`
- `client/src/components/admin/dashboard/InventoryWarningsWidget.jsx`
- `client/src/pages/admin/ProductEditPage.jsx`
- `client/src/pages/storefront/ProductDetailPage.jsx`
- `client/src/test/components/InventoryAlertsWidget.test.jsx`
- `client/src/test/components/InventoryStockSummary.test.jsx`
- `client/src/test/components/InventoryWarningsWidget.test.jsx`
- `client/src/test/pages/admin/ProductEditPage.test.jsx`
- `client/src/utils/inventoryNavigation.js`
- `docs/inventory/stock-and-availability.md`
- `server/src/modules/attribute/attribute.service.js`
- `server/src/modules/cart/cart.service.js`
- `server/src/modules/inventory/inventory.service.js`
- `server/src/modules/inventory/inventoryAlert.service.js`
- `server/src/modules/inventory/inventoryHealth.service.js`
- `server/src/modules/order/order.service.js`
- `server/src/modules/product/product.pricing.js`
- `server/src/modules/product/product.service.js`
- `server/src/modules/product/productType.js`
- `server/tests/unit/admin.inventory.test.js`
- `server/tests/unit/attribute.service.test.js`
- `server/tests/unit/cart.inventoryAvailability.test.js`
- `server/tests/unit/inventory.availabilityRules.test.js`
- `server/tests/unit/inventory.simpleHistory.test.js`
- `server/tests/unit/product.pricing.test.js`
- `server/tests/unit/productType.test.js`

## Verification commands

Run from the repository root:

```bash
npm --prefix client test -- src/test/components/InventoryStockSummary.test.jsx src/test/components/InventoryWarningsWidget.test.jsx src/test/components/InventoryAlertsWidget.test.jsx src/test/pages/admin/ProductEditPage.test.jsx src/test/pages/admin/ProductEditPage.validation.test.jsx
(cd server && npm test -- run tests/unit/inventory*.test.js tests/unit/attribute*.test.js tests/unit/productType.test.js tests/unit/product.pricing.test.js tests/unit/cart.inventoryAvailability.test.js tests/unit/admin.inventory.test.js tests/unit/order.customerCancellation.test.js tests/unit/orderWorkflow.test.js tests/unit/order.service.test.js)
npm --prefix client run build
git diff --check
```

## Limits and follow-up checks

Tests use component rendering and mocked services; they do not verify production database records, live browser appearance, or simultaneous checkout/admin writes against PostgreSQL. Dashboard synchronization adds database reads/writes to its alert request. Dashboard widgets are separate requests and can briefly differ if stock changes between requests. Bundle/component allocation, multiple warehouses, damaged stock, and backorders are separate workflows and were not redesigned here. Existing parent aggregate persistence was not migrated or reconciled; the stored type now determines whether product or variant rows supply current stock. Existing historical reservation inconsistencies require explicit reconciliation rather than silently rewriting data.

No deployment or production inventory adjustment is performed by this change.
