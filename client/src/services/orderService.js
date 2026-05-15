import api from './api';

/**
 * Service for managing customer-facing order operations.
 */
export const orderService = {
  /**
   * Fetch paginated list of current user's orders.
   */
  getMyOrders: async (params = {}) => {
    const response = await api.get('/orders', { params });
    return response.data;
  },

  /**
   * Fetch details for a specific order.
   */
  getMyOrderById: async (id) => {
    if (!id) throw new TypeError('orderService.getMyOrderById: Invalid id');
    const response = await api.get(`/orders/${id}`);
    return response.data.data;
  },

  /**
   * Fetch tracking information for an order.
   */
  getMyOrderTracking: async (id) => {
    if (!id) throw new TypeError('orderService.getMyOrderTracking: Invalid id');
    const response = await api.get(`/orders/${id}/tracking`);
    return response.data.data;
  },

  /**
   * Cancel an order.
   */
  cancelOrder: async (id) => {
    if (!id) throw new TypeError('orderService.cancelOrder: Invalid id');
    const response = await api.post(`/orders/${id}/cancel`);
    return response.data;
  },

  createReturnRequest: async (id, data) => {
    if (!id) throw new TypeError('orderService.createReturnRequest: Invalid id');
    const response = await api.post(`/orders/${id}/returns`, data);
    return response.data.data;
  },

  createReplacementRequest: async (id, data) => {
    if (!id) throw new TypeError('orderService.createReplacementRequest: Invalid id');
    const response = await api.post(`/orders/${id}/replacements`, data);
    return response.data.data;
  },

  /**
   * Create a new order (Checkout).
   */
  placeOrder: async (data) => {
    if (!data) throw new Error('orderService.placeOrder: missing order data');
    const response = await api.post('/orders', data);
    return response.data.data;
  }
};
