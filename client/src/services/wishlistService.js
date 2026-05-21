import api from './api';
import { withQueryString } from '../utils/query';
import { getSessionId } from './cartService';

const buildVariantParams = (variantId) => (variantId ? { params: { variantId } } : undefined);
const withWishlistSession = (config = {}) => ({
  ...config,
  headers: {
    ...(config.headers || {}),
    'X-Session-Id': getSessionId(),
  },
});

export const wishlistService = {
  getWishlist: async (params = {}) => {
    const response = await api.get(withQueryString('/wishlist', params), withWishlistSession());
    return { data: response.data?.data || [], meta: response.data?.meta || {} };
  },

  addItem: async (productId, variantId = null) => {
    const response = await api.post('/wishlist/items', { productId, variantId }, withWishlistSession());
    return response.data.data;
  },

  removeItem: async (productId, variantId = null) => {
    const response = await api.delete(`/wishlist/items/${productId}`, withWishlistSession(buildVariantParams(variantId)));
    return response.data?.data;
  },

  moveToCart: async (productId, variantId = null) => {
    const response = await api.post(`/wishlist/items/${productId}/to-cart`, {}, withWishlistSession(buildVariantParams(variantId)));
    return response.data.data;
  },

  moveAllToCart: async () => {
    const response = await api.post('/wishlist/items/move-all-to-cart', {}, withWishlistSession());
    return response.data.data;
  },

  clearWishlist: async () => {
    const response = await api.delete('/wishlist/items', withWishlistSession());
    return response.data.data;
  },

  mergeGuestWishlist: async () => {
    const response = await api.post('/wishlist/merge', { sessionId: getSessionId() });
    return response.data.data;
  },
};
