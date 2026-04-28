import KpiCardsWidget from './KpiCardsWidget';
import LowStockWidget from './LowStockWidget';
import OperationsSummaryWidget from './OperationsSummaryWidget';
import RecentOrdersWidget from './RecentOrdersWidget';
import SalesChartWidget from './SalesChartWidget';
import InventoryWarningsWidget from './InventoryWarningsWidget';
import StoreHealthWidget from './StoreHealthWidget';
import { checkBool } from './dashboardUtils';
import { PERMISSIONS } from '../../../utils/permissions';

export const DASHBOARD_WIDGETS = {
  kpiCards: {
    label: 'KPI Cards',
    component: KpiCardsWidget,
    isEnabled: (settings) => checkBool(settings['dashboard.showStatCards']),
    permissions: [PERMISSIONS.DASHBOARD_VIEW],
    section: 'top',
    defaultOrder: 0,
  },
  salesChart: {
    label: 'Sales Overview',
    component: SalesChartWidget,
    isEnabled: (settings) => checkBool(settings['dashboard.showSalesChart']),
    permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.ORDERS_READ],
    section: 'main',
    defaultSize: 'large',
    defaultOrder: 1,
  },
  recentOrders: {
    label: 'Recent Orders',
    component: RecentOrdersWidget,
    isEnabled: (settings) => checkBool(settings['dashboard.showRecentOrders']),
    permissions: [PERMISSIONS.ORDERS_READ],
    section: 'main',
    defaultSize: 'medium',
    defaultOrder: 2,
  },
  operationsSummary: {
    label: 'Operations Summary',
    component: OperationsSummaryWidget,
    isEnabled: (settings) => checkBool(settings['dashboard.showOperationsSummary']),
    permissions: [PERMISSIONS.DASHBOARD_VIEW],
    section: 'main',
    defaultSize: 'medium',
    defaultOrder: 3,
  },
  inventoryWarnings: {
    label: 'Inventory Warnings',
    component: InventoryWarningsWidget,
    isEnabled: (settings) => checkBool(settings['dashboard.showInventoryWarnings']),
    permissions: [PERMISSIONS.PRODUCTS_READ],
    section: 'main',
    defaultSize: 'medium',
    defaultOrder: 4,
  },
  storeHealth: {
    label: 'Store Health',
    component: StoreHealthWidget,
    isEnabled: (settings) => checkBool(settings['dashboard.showStoreHealth']),
    permissions: [PERMISSIONS.DASHBOARD_VIEW],
    section: 'main',
    defaultSize: 'medium',
    defaultOrder: 5,
  },
  lowStock: {
    label: 'Low Stock Alerts',
    component: LowStockWidget,
    isEnabled: (settings) => checkBool(settings['dashboard.showLowStockAlerts']),
    permissions: [PERMISSIONS.PRODUCTS_READ],
    section: 'main',
    defaultSize: 'full',
    defaultOrder: 6,
  },
};

export const DASHBOARD_LAYOUT_WIDGET_IDS = ['salesChart', 'recentOrders', 'operationsSummary', 'inventoryWarnings', 'storeHealth', 'lowStock'];

export const DASHBOARD_PROFILES = {
  owner: {
    label: 'Owner',
    widgetOrder: 'salesChart,recentOrders,operationsSummary,storeHealth,inventoryWarnings,lowStock',
    widgetDefaults: {
      showStatCards: true,
      showRevenueCard: true,
      showOrdersCard: true,
      showCustomersCard: true,
      showProductsCard: true,
      showSalesChart: true,
      showRecentOrders: true,
      showOperationsSummary: true,
      showInventoryWarnings: true,
      showStoreHealth: true,
      showLowStockAlerts: true,
    },
  },
  operations: {
    label: 'Operations',
    widgetOrder: 'recentOrders,operationsSummary,inventoryWarnings,lowStock,salesChart,storeHealth',
    widgetDefaults: {
      showStatCards: true,
      showRevenueCard: false,
      showOrdersCard: true,
      showCustomersCard: true,
      showProductsCard: true,
      showSalesChart: true,
      showRecentOrders: true,
      showOperationsSummary: true,
      showInventoryWarnings: true,
      showStoreHealth: true,
      showLowStockAlerts: true,
    },
  },
  catalog: {
    label: 'Catalog',
    widgetOrder: 'inventoryWarnings,lowStock,operationsSummary,salesChart,recentOrders,storeHealth',
    widgetDefaults: {
      showStatCards: true,
      showRevenueCard: false,
      showOrdersCard: false,
      showCustomersCard: false,
      showProductsCard: true,
      showSalesChart: false,
      showRecentOrders: false,
      showOperationsSummary: true,
      showInventoryWarnings: true,
      showStoreHealth: true,
      showLowStockAlerts: true,
    },
  },
  support: {
    label: 'Support',
    widgetOrder: 'recentOrders,operationsSummary,salesChart,storeHealth,inventoryWarnings,lowStock',
    widgetDefaults: {
      showStatCards: true,
      showRevenueCard: false,
      showOrdersCard: true,
      showCustomersCard: true,
      showProductsCard: false,
      showSalesChart: false,
      showRecentOrders: true,
      showOperationsSummary: true,
      showInventoryWarnings: false,
      showStoreHealth: true,
      showLowStockAlerts: false,
    },
  },
};

const hasWidgetPermission = (widget, hasAnyPermission) => {
  if (!widget.permissions?.length) return true;
  if (typeof hasAnyPermission !== 'function') return true;
  return hasAnyPermission(widget.permissions);
};

export const parseWidgetOrder = (value) => {
  const savedOrder = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((id) => DASHBOARD_LAYOUT_WIDGET_IDS.includes(id));

  return [
    ...savedOrder,
    ...DASHBOARD_LAYOUT_WIDGET_IDS.filter((id) => !savedOrder.includes(id)),
  ];
};

export const getEnabledDashboardWidgets = (settings, section, hasAnyPermission) =>
  Object.entries(DASHBOARD_WIDGETS)
    .filter(([, widget]) => widget.section === section && widget.isEnabled(settings) && hasWidgetPermission(widget, hasAnyPermission))
    .map(([id, widget]) => ({ id, ...widget }))
    .sort((a, b) => a.defaultOrder - b.defaultOrder);

export const getOrderedDashboardWidgets = (settings, hasAnyPermission) => {
  const order = parseWidgetOrder(settings['dashboard.widgetOrder']);
  return order
    .map((id) => ({ id, ...DASHBOARD_WIDGETS[id] }))
    .filter((widget) => widget.component && widget.isEnabled(settings) && hasWidgetPermission(widget, hasAnyPermission));
};
