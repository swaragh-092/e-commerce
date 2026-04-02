import api from './api';

// Dashboard
const getStats = () => api.get('/admin/dashboard/stats');
const getSalesChart = (period = 'monthly') => api.get(`/admin/dashboard/sales-chart?period=${period}`);
const getLowStock = (threshold = 10) => api.get(`/admin/dashboard/low-stock?threshold=${threshold}`);
const getRecentOrders = () => api.get('/admin/dashboard/recent-orders');

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

// Reviews (admin moderation)
const getAdminReviews = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/reviews${query ? `?${query}` : ''}`);
};
const updateReviewStatus = (id, status) => api.put(`/reviews/${id}/status`, { status });
const deleteReview = (id) => api.delete(`/reviews/${id}`);

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
const refundOrder = (id) => api.post(`/payments/${id}/refund`);

// Settings bulk update
const updateSettings = (settings) => api.put('/settings/bulk', settings);

export {
  getStats, getSalesChart, getLowStock, getRecentOrders,
  getAuditLogs,
  getUsers, getUserById,
  getAdminReviews, updateReviewStatus, deleteReview,
  getCoupons, createCoupon, updateCoupon, deleteCoupon,
  getAllOrders, getOrderById, updateOrderStatus, refundOrder,
  updateSettings,
};
