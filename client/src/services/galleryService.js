import api from './api';

export const galleryService = {
  listAdmin: async (params = {}) => (await api.get(`/galleries?${new URLSearchParams(params).toString()}`)).data,
  create: async (data) => (await api.post('/galleries', data)).data,
  update: async (id, data) => (await api.patch(`/galleries/${id}`, data)).data,
  delete: async (id) => (await api.delete(`/galleries/${id}`)).data,
  addItems: async (id, mediaIds) => (await api.post(`/galleries/${id}/items`, { mediaIds })).data,
  deleteItem: async (id, itemId) => (await api.delete(`/galleries/${id}/items/${itemId}`)).data,
  reorder: async (id, itemIds) => (await api.patch(`/galleries/${id}/reorder`, { itemIds })).data,
  publicList: async (slug, params = {}) => (await api.get(`/galleries/public/${slug}?${new URLSearchParams(params).toString()}`)).data,
};
