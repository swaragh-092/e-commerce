import api from './api';

export const getCategoryTree = async () => {
    const response = await api.get('/categories');
    return response.data;
};

export const getCategoryWithProducts = async (slug) => {
    const response = await api.get(`/categories/${slug}`);
    return response.data;
};

export const createCategory = async (data) => {
    const response = await api.post('/categories', data);
    return response.data;
};

export const updateCategory = async (id, data) => {
    const response = await api.put(`/categories/${id}`, data);
    return response.data;
};

export const deleteCategory = async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
};

// Alias used by storefront components (returns flat/root categories)
export const getCategories = async () => {
    const response = await api.get('/categories');
    const data = response.data?.data;
    // Backend may return tree or flat array; return flat root-level categories
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.categories)) return data.categories;
    return [];
};
