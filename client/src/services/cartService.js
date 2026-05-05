import { v4 as uuidv4 } from 'uuid';
import api from './api';

// Guest cart: sessionId stored in localStorage
const SESSION_KEY = 'cartSessionId';

export const getSessionId = () => {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

export const clearSessionId = () => localStorage.removeItem(SESSION_KEY);

const cartService = {
  getCart: () =>
    api.get('/cart', { headers: { 'X-Session-Id': getSessionId() } }),

  addItem: (productId, quantity = 1, variantId = null) =>
    api.post(
      '/cart/items',
      { productId, quantity, ...(variantId && { variantId }) },
      { headers: { 'X-Session-Id': getSessionId() } }
    ),

  updateItem: (cartItemId, quantity) =>
    api.put(
      `/cart/items/${cartItemId}`,
      { quantity },
      { headers: { 'X-Session-Id': getSessionId() } }
    ),

  removeItem: (cartItemId) =>
    api.delete(`/cart/items/${cartItemId}`, {
      headers: { 'X-Session-Id': getSessionId() },
    }),

  clearCart: () =>
    api.delete('/cart', { headers: { 'X-Session-Id': getSessionId() } }),

  mergeGuestCart: () =>
    api.post('/cart/merge', { sessionId: getSessionId() }),
};

export default cartService;
