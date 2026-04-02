import api from './api';

export const wishlistService = {
  getWishlist: async () => {
    const response = await api.get('/wishlist');
    return response.data.data;
  },

  addItem: async (productId) => {
    const response = await api.post('/wishlist/items', { productId });
    return response.data.data;
  },

  removeItem: async (productId) => {
    const response = await api.delete(`/wishlist/items/${productId}`);
    return response.data;
  },

  moveToCart: async (productId) => {
    const response = await api.post(`/wishlist/items/${productId}/to-cart`);
    return response.data.data;
  }
};
