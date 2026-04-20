import api from './api';

// Dashboard
const getStats = () => api.get('/admin/dashboard/stats');
const getSalesChart = ({ period = 'monthly', startDate, endDate } = {}) => {
  const params = new URLSearchParams({ period });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  return api.get(`/admin/dashboard/sales-chart?${params.toString()}`);
};
const getLowStock = (threshold = 10) => api.get(`/admin/dashboard/low-stock?threshold=${threshold}`);
const getRecentOrders = () => api.get('/admin/dashboard/recent-orders');
const getAccessRoles = () => api.get('/admin/access-control/roles');
const getAccessPermissions = () => api.get('/admin/access-control/permissions');
const getAccessUsers = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value != null && value !== ''))
  ).toString();
  return api.get(`/admin/access-control/users${query ? `?${query}` : ''}`);
};
const createAccessRole = (data) => api.post('/admin/access-control/roles', data);
const updateAccessRole = (id, data) => api.put(`/admin/access-control/roles/${id}`, data);
const updateAccessUserRole = (id, roleId) => api.put(`/admin/access-control/users/${id}/role`, { roleId });
const createAccessUser = (data) => api.post('/admin/access-control/users', data);

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
// ✅ Correct route: PUT /admin/reviews/:id/moderate
const updateReviewStatus = (id, status) => api.put(`/admin/reviews/${id}/moderate`, { status });
const deleteReview = (id) => api.delete(`/admin/reviews/${id}`);

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
const updateOrderStatus = (id, status) => api.put(`/orders/${id}/status`, { status });
const refundOrder = (id) => api.post(`/orders/${id}/refund`);
const createFulfillment = (orderId, data) => api.post(`/orders/${orderId}/fulfillments`, data);
const updateFulfillmentStatus = (orderId, fulfillmentId, status) => api.patch(`/orders/${orderId}/fulfillments/${fulfillmentId}/status`, { status });

// Settings bulk update
const updateSettings = (settings) => api.put('/settings/bulk', settings);

// Email / Notification templates
const getEmailTemplates = () => api.get('/notifications/templates');
const updateEmailTemplate = (name, data) => api.put(`/notifications/templates/${name}`, data);
const sendTestEmail = (templateName, recipientEmail) => api.post('/notifications/templates/test', { templateName, recipientEmail });

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

export {
  getStats, getSalesChart, getLowStock, getRecentOrders,
  getAccessRoles, getAccessPermissions, getAccessUsers, createAccessRole, updateAccessRole, updateAccessUserRole, createAccessUser,
  getAuditLogs,
  getUsers, getUserById, updateUserStatus,
  getAdminReviews, updateReviewStatus, deleteReview,
  getCoupons, createCoupon, updateCoupon, deleteCoupon,
  getAllOrders, getOrderById, updateOrderStatus, refundOrder, createFulfillment, updateFulfillmentStatus,
  updateSettings,
  getEmailTemplates, updateEmailTemplate, sendTestEmail,
  validateCoupon, getPublicCoupons, getEligibleCoupons,
  getMyOrders, getMyOrderById, cancelOrder, placeOrder,
  getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress,
};
