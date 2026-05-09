import api from './api';

const getAttributes = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return api.get(`/attributes${query ? `?${query}` : ''}`);
};

const getAttributeById = (id) => api.get(`/attributes/${id}`);
const createAttribute = (data) => api.post('/attributes', data);
const updateAttribute = (id, data) => api.put(`/attributes/${id}`, data);
const deleteAttribute = (id) => api.delete(`/attributes/${id}`);

const addAttributeValue = (attributeId, data) =>
  api.post(`/attributes/${attributeId}/values`, data);

const removeAttributeValue = (attributeId, valueId) =>
  api.delete(`/attributes/${attributeId}/values/${valueId}`);

const getCategoryAttributes = (categoryId, inherit = false) => {
  if (!categoryId || (Array.isArray(categoryId) && categoryId.length === 0)) {
    return Promise.resolve({ data: { data: [] } });
  }
  const ids = Array.isArray(categoryId) ? categoryId.join(',') : categoryId;
  return api.get(`/categories/${ids}/attributes${inherit ? '?inherit=true' : ''}`);
};

const linkAttributeToCategory = (categoryId, data) =>
  api.post(`/categories/${categoryId}/attributes`, data);

const unlinkAttributeFromCategory = (categoryId, attributeId) =>
  api.delete(`/categories/${categoryId}/attributes/${attributeId}`);

const getProductAttributes = (productId) =>
  api.get(`/products/${productId}/attributes`);

const addProductAttribute = (productId, data) =>
  api.post(`/products/${productId}/attributes`, data);

const updateProductAttribute = (productId, attributeRowId, data) =>
  api.put(`/products/${productId}/attributes/${attributeRowId}`, data);

const deleteProductAttribute = (productId, attributeRowId) =>
  api.delete(`/products/${productId}/attributes/${attributeRowId}`);

const bulkGenerateVariants = (productId, data) =>
  api.post(`/products/${productId}/variants/generate`, data);

const cloneVariants = (productId, data) =>
  api.post(`/products/${productId}/variants/clone`, data);

const getProductVariants = (productId) =>
  api.get(`/products/${productId}/variants`);

const addProductVariant = (productId, data) =>
  api.post(`/products/${productId}/variants`, data);

const updateProductVariant = (productId, variantId, data) =>
  api.put(`/products/${productId}/variants/${variantId}`, data);

const deleteProductVariant = (productId, variantId) =>
  api.delete(`/products/${productId}/variants/${variantId}`);

const reorderAttributeValues = (attributeId, valueIds) =>
  api.put(`/attributes/${attributeId}/values/reorder`, { valueIds });

const attributeService = {
  getAttributes,
  getAttributeById,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  addAttributeValue,
  removeAttributeValue,
  reorderAttributeValues,
  getCategoryAttributes,
  linkAttributeToCategory,
  unlinkAttributeFromCategory,
  getProductAttributes,
  addProductAttribute,
  updateProductAttribute,
  deleteProductAttribute,
  bulkGenerateVariants,
  cloneVariants,
  getProductVariants,
  addProductVariant,
  updateProductVariant,
  deleteProductVariant,
};

export default attributeService;
