import api from './api';

export const getPromotions = async (params) => {
  const response = await api.get('/promotions', { params });
  return response.data;
};

export const getPromotion = async (id) => {
  const response = await api.get(`/promotions/${id}`);
  return response.data;
};

export const createPromotion = async (data) => {
  const response = await api.post('/promotions', data);
  return response.data;
};

export const updatePromotion = async (id, data) => {
  const response = await api.put(`/promotions/${id}`, data);
  return response.data;
};

export const deletePromotion = async (id) => {
  const response = await api.delete(`/promotions/${id}`);
  return response.data;
};

export const assignProducts = async (id, productIds) => {
  const response = await api.post(`/promotions/${id}/products`, { productIds });
  return response.data;
};

export const removeProducts = async (id, productIds) => {
  const response = await api.delete(`/promotions/${id}/products`, { data: { productIds } });
  return response.data;
};
