import api from './api';

export const getApiDefinitions = async (params = {}) => {
  const response = await api.get('/api-builder', { params });
  return response.data;
};

export const getApiDefinition = async (id) => {
  const response = await api.get(`/api-builder/${id}`);
  return response.data;
};

export const createApiDefinition = async (data) => {
  const response = await api.post('/api-builder', data);
  return response.data;
};

export const updateApiDefinition = async (id, data) => {
  const response = await api.put(`/api-builder/${id}`, data);
  return response.data;
};

export const deleteApiDefinition = async (id) => {
  const response = await api.delete(`/api-builder/${id}`);
  return response.data;
};

export const previewApiDefinition = async (config, query = {}) => {
  const response = await api.post('/api-builder/preview', { config, query });
  return response.data;
};

export const buildPublicApiUrl = (slug) => {
  const base = api.defaults.baseURL || '';
  return `${base.replace(/\/$/, '')}/api-builder/public/${slug}`;
};
