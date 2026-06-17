import api from './api';

const ADMIN_PREFIX = import.meta.env.VITE_ADMIN_ROUTE_PREFIX || 'admin';

export const generateProductDraft = async (payload) => {
  const response = await api.post(`/${ADMIN_PREFIX}/product-assistant/generate`, payload);
  return response.data;
};

export const extractProductSpecs = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post(`/${ADMIN_PREFIX}/product-assistant/extract-specs`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};
