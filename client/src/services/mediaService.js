import api from './api';
import { withQueryString } from '../utils/query';

export const mediaService = {
  uploadMedia: async (file, typeOrSignal, maybeSignal) => {
    let type = 'image';
    let signal = undefined;
    if (typeof typeOrSignal === 'string') {
      type = typeOrSignal;
      signal = maybeSignal;
    } else if (typeOrSignal && typeof typeOrSignal === 'object' && 'aborted' in typeOrSignal) {
      signal = typeOrSignal;
    }
    const formData = new FormData();
    formData.append('file', file);
    if (type) formData.append('type', type);
    const response = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
    });
    return response.data;
  },

  uploadIcon: async (file, signal) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'icon');
    const response = await api.post('/media/upload-icon', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
    });
    return response.data;
  },

  uploadFont: async (file, signal) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/media/upload-font', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
    });
    return response.data;
  },

  listIcons: async (params = {}, signal) => {
    return mediaService.list({ ...params, type: 'icon' }, signal);
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
