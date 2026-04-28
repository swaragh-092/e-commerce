# Admin Dashboard Customization Phases

This document tracks the plan for turning the admin dashboard into a configurable dashboard builder.

## Phase 1 - Configurable Dashboard Basics

Goal: give admins control over the current dashboard without changing the dashboard data model.

Status: implemented.

- Add dashboard layout setting: `balanced`, `analytics`, `compact`.
- Add dashboard density setting: `comfortable`, `compact`, `spacious`.
- Keep default chart period setting.
- Add show/hide controls for each KPI card:
  - Total Revenue
  - Total Orders
  - Customers
  - Published Products
- Add show/hide controls for larger dashboard widgets:
  - Sales Overview chart
  - Recent Orders
  - Low Stock Alerts
- Add basic widget size controls for large widgets:
  - medium
  - large
  - full
- Keep backward compatibility with existing settings:
  - `admin.dashboard.showStatCards`
  - `admin.dashboard.showRecentOrders`
  - `admin.dashboard.showLowStockAlerts`
  - `admin.dashboard.defaultChartPeriod`

Implemented files:

- `client/src/pages/admin/DashboardPage.jsx`
- `client/src/pages/admin/SettingsPage.jsx`
- `config/default.json`

## Phase 2 - Widget Registry

Goal: split the dashboard into reusable widgets.

Status: implemented.

- Create `client/src/components/admin/dashboard/`.
- Move KPI cards, sales chart wrapper, recent orders, and low-stock table into separate widget components.
- Add a `dashboardWidgets.js` registry.
- Render dashboard from widget IDs instead of hardcoded JSX sections.
- Add empty, loading, and error states per widget.

Implemented files:

- `client/src/components/admin/dashboard/dashboardUtils.js`
- `client/src/components/admin/dashboard/dashboardWidgets.js`
- `client/src/components/admin/dashboard/KpiCardsWidget.jsx`
- `client/src/components/admin/dashboard/SalesChartWidget.jsx`
- `client/src/components/admin/dashboard/RecentOrdersWidget.jsx`
- `client/src/components/admin/dashboard/LowStockWidget.jsx`
- `client/src/pages/admin/DashboardPage.jsx`

## Phase 3 - Ordering And Layout Builder

Goal: allow admins to arrange the dashboard visually.

Status: implemented for current main dashboard widgets.

- Add drag-and-drop ordering in Settings.
- Store widget order in admin settings.
- Support responsive widget spans.
- Add layout presets:
  - Operations
  - Sales
  - Catalog
  - Support
  - Executive

Implemented files:

- `client/src/components/admin/dashboard/dashboardWidgets.js`
- `client/src/pages/admin/DashboardPage.jsx`
- `client/src/pages/admin/SettingsPage.jsx`
- `config/default.json`

Current scope:

- Drag/drop order is available for Sales Overview, Recent Orders, and Low Stock Alerts.
- KPI cards remain grouped at the top. Moving individual KPI cards is planned for a later widget expansion.

## Phase 4 - Role-Based Dashboards

Goal: show the right dashboard per admin role.

Status: implemented as permission-aware widgets and admin-selectable dashboard profiles.

- Add role-based widget visibility.
- Reuse existing access-control permissions.
- Suggested role defaults:
  - Owner: revenue, chart, payments, orders
  - Product manager: products, low stock, catalog health
  - Support: recent orders, customers, refunds
  - Marketing: coupons, sales labels, campaign widgets

Implemented files:

- `client/src/components/admin/dashboard/dashboardWidgets.js`
- `client/src/components/admin/dashboard/KpiCardsWidget.jsx`
- `client/src/pages/admin/DashboardPage.jsx`
- `client/src/pages/admin/SettingsPage.jsx`
- `config/default.json`

Current scope:

- Widget visibility respects existing permissions:
  - Sales chart requires dashboard/orders access.
  - Recent orders requires orders access.
  - Low stock requires products access.
  - KPI cards hide individual cards if the admin lacks related permissions.
- Admin can apply profile presets:
  - Owner
  - Operations
  - Catalog
  - Support

## Phase 5 - Advanced Widgets

Goal: add deeper operational insight.

Status: partially implemented with frontend widgets powered by existing dashboard/settings data.

- Top products
- Pending orders
- Failed payments
- Refund requests
- New customers
- Inventory warnings
- Coupon usage
- Payment gateway status
- Store health checklist
- Conversion funnel when analytics data exists

Implemented files:

- `client/src/components/admin/dashboard/OperationsSummaryWidget.jsx`
- `client/src/components/admin/dashboard/InventoryWarningsWidget.jsx`
- `client/src/components/admin/dashboard/StoreHealthWidget.jsx`
- `client/src/components/admin/dashboard/dashboardWidgets.js`
- `client/src/pages/admin/DashboardPage.jsx`
- `client/src/pages/admin/SettingsPage.jsx`
- `config/default.json`

Current scope:

- Operations Summary widget
- Inventory Warnings widget
- Store Health widget
- Admin show/hide controls and size controls for the new widgets
- Drag/drop order support for the new widgets

Still planned:

- Top products
- Failed payments
- Refund requests
- Coupon usage
- Dedicated payment gateway status widget
- Conversion funnel

## Phase 6 - Saved Views And Personalization

Goal: make dashboards personal and reusable.

- Allow admins to save multiple dashboard views.
- Add per-user dashboard preference overrides.
- Add reset-to-default action.
- Add export/share dashboard configuration.
