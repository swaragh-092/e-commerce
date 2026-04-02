import api from './api';

export const reviewService = {
  list: async (slug, params) => {
    const response = await api.get(`/products/${slug}/reviews`, { params });
    return response.data;
  },

  create: async (slug, reviewData) => {
    const response = await api.post(`/products/${slug}/reviews`, reviewData);
    return response.data.data;
  },

  moderate: async (id, status) => {
    const response = await api.put(`/admin/reviews/${id}/moderate`, { status });
    return response.data.data;
  },

  remove: async (id) => {
    const response = await api.delete(`/admin/reviews/${id}`);
    return response.data;
  }
};
