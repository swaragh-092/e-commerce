import api from './api';

// ─── Attribute Templates ──────────────────────────────────────────────────────

/** List all attribute templates (paginated) */
const getAttributes = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return api.get(`/attributes${query ? `?${query}` : ''}`);
};

/** Get a single attribute template by ID */
const getAttributeById = (id) => api.get(`/attributes/${id}`);

/** Create a new attribute template (admin only) */
const createAttribute = (data) => api.post('/attributes', data);

/** Update an attribute template (admin only) */
const updateAttribute = (id, data) => api.put(`/attributes/${id}`, data);

/** Delete an attribute template (admin only) */
const deleteAttribute = (id) => api.delete(`/attributes/${id}`);

// ─── Attribute Values ─────────────────────────────────────────────────────────

/** Add a value to an existing attribute (admin only) */
const addAttributeValue = (attributeId, data) =>
  api.post(`/attributes/${attributeId}/values`, data);

/** Remove a value from an attribute (admin only) */
const removeAttributeValue = (attributeId, valueId) =>
  api.delete(`/attributes/${attributeId}/values/${valueId}`);

// ─── Category ↔ Attribute Linking ────────────────────────────────────────────

/** List attributes linked to a category */
const getCategoryAttributes = (categoryId) =>
  api.get(`/categories/${categoryId}/attributes`);

/** Link an attribute template to a category (admin only) */
const linkAttributeToCategory = (categoryId, data) =>
  api.post(`/categories/${categoryId}/attributes`, data);

/** Unlink an attribute from a category (admin only) */
const unlinkAttributeFromCategory = (categoryId, attributeId) =>
  api.delete(`/categories/${categoryId}/attributes/${attributeId}`);

// ─── Product Variant Generation ───────────────────────────────────────────────

/** Bulk-generate variant combinations for a product (admin only) */
const bulkGenerateVariants = (productId, data) =>
  api.post(`/products/${productId}/variants/bulk-generate`, data);

/** Clone variants from one product to another (admin only) */
const cloneVariants = (productId, data) =>
  api.post(`/products/${productId}/variants/clone`, data);

// ─── Per-product Variant CRUD ────────────────────────────────────────────────

/** List all variants for a product (admin only) */
const getProductVariants = (productId) =>
  api.get(`/products/${productId}/variants`);

/** Add a single variant row to a product (admin only) */
const addProductVariant = (productId, data) =>
  api.post(`/products/${productId}/variants`, data);

/** Update a single variant row (admin only) */
const updateProductVariant = (productId, variantId, data) =>
  api.put(`/products/${productId}/variants/${variantId}`, data);

/** Delete a single variant row (admin only) */
const deleteProductVariant = (productId, variantId) =>
  api.delete(`/products/${productId}/variants/${variantId}`);

// ─── Exports ─────────────────────────────────────────────────────────────────

const attributeService = {
  getAttributes,
  getAttributeById,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  addAttributeValue,
  removeAttributeValue,
  getCategoryAttributes,
  linkAttributeToCategory,
  unlinkAttributeFromCategory,
  bulkGenerateVariants,
  cloneVariants,
  getProductVariants,
  addProductVariant,
  updateProductVariant,
  deleteProductVariant,
};

export default attributeService;
