import api from './api';

/**
 * Search service — client-side API calls for global search.
 *
 * Response shape:
 * {
 *   products: { data: [...], currentPage, totalPages, totalItems },
 *   brands: [{ id, name, slug, image }],
 *   categories: [{ id, name, slug, image }]
 * }
 */

export const searchProducts = async (params) => {
  const response = await api.get('/search', { params });
  return response.data;
};
