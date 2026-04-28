import api from './api';

// Admin route prefix — driven by VITE_ADMIN_ROUTE_PREFIX in .env.
// Must match the ADMIN_ROUTE_PREFIX set on the server (without the leading /api/).
// Example: if server has ADMIN_ROUTE_PREFIX=/api/mgmt-xK9mP2, set VITE_ADMIN_ROUTE_PREFIX=mgmt-xK9mP2
const A = import.meta.env.VITE_ADMIN_ROUTE_PREFIX || 'admin';

// Dashboard
const getStats = () => api.get(`/${A}/dashboard/stats`);
const getSalesChart = ({ period = 'monthly', startDate, endDate } = {}) => {
  const params = new URLSearchParams({ period });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  return api.get(`/${A}/dashboard/sales-chart?${params.toString()}`);
};
const getLowStock = (threshold = 10) => api.get(`/${A}/dashboard/low-stock?threshold=${threshold}`);
const getRecentOrders = () => api.get(`/${A}/dashboard/recent-orders`);
const getAccessRoles = () => api.get(`/${A}/access-control/roles`);
const getAccessPermissions = () => api.get(`/${A}/access-control/permissions`);
const getAccessUsers = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value != null && value !== ''))
  ).toString();
  return api.get(`/${A}/access-control/users${query ? `?${query}` : ''}`);
};
const createAccessRole = (data) => api.post(`/${A}/access-control/roles`, data);
const updateAccessRole = (id, data) => api.put(`/${A}/access-control/roles/${id}`, data);
const updateAccessUserRole = (id, roleId) => api.put(`/${A}/access-control/users/${id}/role`, { roleId });
const createAccessUser = (data) => api.post(`/${A}/access-control/users`, data);

// Audit Logs
const getAuditLogs = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return api.get(`/audit-logs${query ? `?${query}` : ''}`);
};

// Users (admin view)
const getUsers = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/users${query ? `?${query}` : ''}`);
};
const getUserById = (id) => api.get(`/users/${id}`);
const updateUserStatus = (id, status) => api.put(`/users/${id}/status`, { status });

// Reviews (admin moderation)
const getAdminReviews = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/reviews${query ? `?${query}` : ''}`);
};
// Route: PUT /{adminPrefix}/reviews/:id/moderate
const updateReviewStatus = (id, status) => api.put(`/${A}/reviews/${id}/moderate`, { status });
const deleteReview = (id) => api.delete(`/${A}/reviews/${id}`);

// Coupons
const getCoupons = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/coupons${query ? `?${query}` : ''}`);
};
const createCoupon = (data) => api.post('/coupons', data);
const updateCoupon = (id, data) => api.put(`/coupons/${id}`, data);
const deleteCoupon = (id) => api.delete(`/coupons/${id}`);

// Orders (admin)
const getAllOrders = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/orders${query ? `?${query}` : ''}`);
};
const getOrderById = (id) => api.get(`/orders/${id}`);
const getOrderTracking = (id) => api.get(`/orders/${id}/tracking`);
const updateOrderStatus = (id, status) => api.put(`/orders/${id}/status`, { status });
const refundOrder = (id) => api.post(`/orders/${id}/refund`);
const createFulfillment = (orderId, data) => api.post(`/orders/${orderId}/fulfillments`, data);
const updateFulfillmentStatus = (orderId, fulfillmentId, status) => api.patch(`/orders/${orderId}/fulfillments/${fulfillmentId}/status`, { status });
const confirmCodPayment = (orderId) => api.post(`/payments/cod/confirm/${orderId}`);

// Settings bulk update
const updateSettings = (settings) => api.put('/settings/bulk', settings);

// Email / Notification templates
const getEmailTemplates = () => api.get('/notifications/templates');
const updateEmailTemplate = (name, data) => api.put(`/notifications/templates/${name}`, data);
const sendTestEmail = (templateName, recipientEmail) => api.post('/notifications/templates/test', { templateName, recipientEmail });
const sendTestNotification = (templateName, recipient, channel) => api.post('/notifications/test', { templateName, recipient, channel });

// Coupon validation (storefront)
const validateCoupon = (codeOrPayload, subtotal) => {
  const payload = typeof codeOrPayload === 'object'
    ? codeOrPayload
    : { code: codeOrPayload, subtotal };
  return api.post('/coupons/validate', payload);
};
// Public coupon listing (storefront)
const getPublicCoupons = () => api.get('/coupons/public');
const getEligibleCoupons = (payload = {}) => api.post('/coupons/eligible', payload);

// Storefront orders
const getMyOrders = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/orders${query ? `?${query}` : ''}`);
};
const getMyOrderById = (id) => api.get(`/orders/${id}`);
const cancelOrder = (id) => api.post(`/orders/${id}/cancel`);
const placeOrder = (data) => api.post('/orders', data);

// Storefront addresses
const getAddresses = () => api.get('/users/me/addresses');
const createAddress = (data) => api.post('/users/me/addresses', data);
const updateAddress = (id, data) => api.put(`/users/me/addresses/${id}`, data);
const deleteAddress = (id) => api.delete(`/users/me/addresses/${id}`);
const setDefaultAddress = (id) => api.put(`/users/me/addresses/${id}/default`);

// Sale Labels
const getSaleLabels = () => api.get('/settings/sale-labels');
const createSaleLabel = (data) => api.post('/settings/sale-labels', data);
const updateSaleLabel = (id, data) => api.patch(`/settings/sale-labels/${id}`, data);
const deleteSaleLabel = (id) => api.delete(`/settings/sale-labels/${id}`);
const reorderSaleLabels = (labels) => api.put('/settings/sale-labels', { labels });

export {
  getStats, getSalesChart, getLowStock, getRecentOrders,
  getAccessRoles, getAccessPermissions, getAccessUsers, createAccessRole, updateAccessRole, updateAccessUserRole, createAccessUser,
  getAuditLogs,
  getUsers, getUserById, updateUserStatus,
  getAdminReviews, updateReviewStatus, deleteReview,
  getCoupons, createCoupon, updateCoupon, deleteCoupon,
  getAllOrders, getOrderById, getOrderTracking, updateOrderStatus, refundOrder, createFulfillment, updateFulfillmentStatus, confirmCodPayment,
  updateSettings,
  getEmailTemplates, updateEmailTemplate, sendTestEmail, sendTestNotification,
  validateCoupon, getPublicCoupons, getEligibleCoupons,
  getMyOrders, getMyOrderById, cancelOrder, placeOrder,
  getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress,
  getSaleLabels, createSaleLabel, updateSaleLabel, deleteSaleLabel, reorderSaleLabels,
};
