import api from './api';

const buildVariantParams = (variantId) => (variantId ? { params: { variantId } } : undefined);

export const wishlistService = {
  getWishlist: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await api.get(`/wishlist${query ? `?${query}` : ''}`);
    return { data: response.data?.data || [], meta: response.data?.meta || {} };
  },

  addItem: async (productId, variantId = null) => {
    const response = await api.post('/wishlist/items', { productId, variantId });
    return response.data.data;
  },

  removeItem: async (productId, variantId = null) => {
    const response = await api.delete(`/wishlist/items/${productId}`, buildVariantParams(variantId));
    return response.data?.data;
  },

  moveToCart: async (productId, variantId = null) => {
    const response = await api.post(`/wishlist/items/${productId}/to-cart`, {}, buildVariantParams(variantId));
    return response.data.data;
  },

  moveAllToCart: async () => {
    const response = await api.post('/wishlist/items/move-all-to-cart');
    return response.data.data;
  },

  clearWishlist: async () => {
    const response = await api.delete('/wishlist/items');
    return response.data.data;
  },
};
