import api from './api';
import { getSessionId, clearSessionId } from './session';

export { getSessionId, clearSessionId };

const withSessionHeader = (config = {}) => ({
  ...config,
  headers: {
    ...config.headers,
    'X-Session-Id': getSessionId(),
  },
});

const cartService = {
  getCart: () => api.get('/cart', withSessionHeader()),

  addItem: (productId, quantity = 1, variantId = null) =>
    api.post(
      '/cart/items',
      { productId, quantity, ...(variantId && { variantId }) },
      withSessionHeader()
    ),

  updateItem: (cartItemId, quantity) =>
    api.put(
      `/cart/items/${cartItemId}`,
      { quantity },
      withSessionHeader()
    ),

  removeItem: (cartItemId) => api.delete(`/cart/items/${cartItemId}`, withSessionHeader()),

  clearCart: () => api.delete('/cart', withSessionHeader()),

  mergeGuestCart: () =>
    api.post('/cart/merge', { sessionId: getSessionId() }),
};

export default cartService;
