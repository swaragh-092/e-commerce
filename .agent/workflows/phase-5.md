---
description: How to build Phase 5 — Admin Dashboard and Audit Log
---

# Phase 5 — Admin Dashboard + Audit Log

// turbo-all

## Prerequisites
Phase 4 must be complete (all backend modules working).

## Step 1: Build Audit Log module

Follow `/new-module` workflow for `audit`:
- Model: `audit_logs` (userId, action, entity, entityId, changes JSONB, ipAddress, userAgent)
- Middleware: `auditLog(entity)` — captures before/after state on mutations
- Apply to all admin mutation routes (POST, PUT, DELETE on products, orders, users, settings, coupons)
- GET /api/audit-logs (admin only, paginated, filterable by entity/action/userId/date range)

## Step 2: Build Admin Dashboard (Frontend)

Install:
```bash
cd /home/sr-user91/Videos/e-commerce/client
npm install @mui/x-data-grid recharts
```

Create:
- `pages/admin/DashboardPage.jsx` — Overview cards (revenue, orders, customers, low stock) + sales chart (Recharts)
- `pages/admin/ProductsManagePage.jsx` — MUI DataGrid, create/edit modal, status toggle, soft delete
- `pages/admin/OrdersManagePage.jsx` — DataGrid, status update dropdown, order detail modal
- `pages/admin/CustomersPage.jsx` — DataGrid, customer detail + order history
- `pages/admin/CouponsPage.jsx` — CRUD, usage stats, activate/deactivate
- `pages/admin/SettingsPage.jsx` — Theme editor (color pickers), feature toggles, SEO config, shipping/tax settings
- `pages/admin/AuditLogPage.jsx` — Filterable DataGrid with entity/action/user/date filters
- `layouts/AdminLayout.jsx` — Sidebar navigation + TopBar with user menu

## Step 3: Dashboard API endpoints

Create backend endpoints for dashboard cards:
```
GET /api/admin/dashboard/stats — revenue, order count, customer count
GET /api/admin/dashboard/sales-chart — daily/weekly/monthly sales data
GET /api/admin/dashboard/low-stock — products with available stock < threshold
```

## Step 4: Test Phase 5

1. Admin dashboard loads with correct stats
2. CRUD products via DataGrid
3. Update order statuses
4. Change theme settings → frontend reflects changes
5. Toggle features on/off
6. Audit log captures all admin actions with before/after diffs
