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
    const response = await api.get(`/orders/${id}`);
    return response.data.data;
  },

  /**
   * Fetch tracking information for an order.
   */
  getMyOrderTracking: async (id) => {
    const response = await api.get(`/orders/${id}/tracking`);
    return response.data.data;
  },

  /**
   * Cancel an order.
   */
  cancelOrder: async (id) => {
    const response = await api.post(`/orders/${id}/cancel`);
    return response.data;
  },

  /**
   * Create a new order (Checkout).
   */
  placeOrder: async (data) => {
    const response = await api.post('/orders', data);
    return response.data.data;
  }
};
