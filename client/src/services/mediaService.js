import api from './api';

export const mediaService = {
  uploadMedia: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await api.get(`/media${query ? `?${query}` : ''}`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/media/${id}`);
    return response.data;
  },
};
