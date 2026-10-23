import api from './api';
import { withQueryString } from '../utils/query';

export const galleryService = {
  list: async (params = {}) => (await api.get(withQueryString('/galleries', params))).data,
  create: async (data) => (await api.post('/galleries', data)).data,
  update: async (id, data) => (await api.patch(`/galleries/${id}`, data)).data,
  remove: async (id) => (await api.delete(`/galleries/${id}`)).data,
  addImages: async (id, mediaIds) => (await api.post(`/galleries/${id}/items`, { mediaIds })).data,
  removeImage: async (id, itemId) => (await api.delete(`/galleries/${id}/items/${itemId}`)).data,
  reorder: async (id, itemIds) => (await api.patch(`/galleries/${id}/reorder`, { itemIds })).data,
};
