import api from './api';
import { withQueryString } from '../utils/query';

export const mediaService = {
  uploadMedia: async (file, signal) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
    });
    return response.data;
  },

  list: async (params = {}, signal) => {
    const response = await api.get(withQueryString('/media', params), { signal });
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/media/${id}`);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.patch(`/media/${id}`, data);
    return response.data;
  },
};
