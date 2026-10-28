import api from './api';

export const getTags = async (params) => (await api.get('/tags', { params })).data;
export const createTag = async (name, description) => (await api.post('/tags', { name, ...(description !== undefined && { description }) })).data;
export const renameTag = async (id, name, description) => (await api.patch(`/tags/${id}`, { name, ...(description !== undefined && { description }) })).data;
export const deleteTag = async (id) => (await api.delete(`/tags/${id}`)).data;
export const bulkUpdateProductTags = async (data) => (await api.patch('/tags/products', data)).data;
export const getPublicTag = async (slug) => (await api.get(`/tags/public/${encodeURIComponent(slug)}`)).data;
