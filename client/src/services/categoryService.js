import api from './api';

export const getCategoryTree = async () => {
    const response = await api.get('/categories');
    return response.data;
};

export const getCategoryWithProducts = async (slug, pageOrOptions = 1, limit = 20, sort = 'newest', minPrice, maxPrice) => {
    let params = { page: 1, limit: 20, sort: 'newest' };
    if (typeof pageOrOptions === 'object' && pageOrOptions !== null) {
        params = { ...pageOrOptions };
    } else {
        params = { page: pageOrOptions, limit, sort, minPrice, maxPrice };
    }
    Object.keys(params).forEach((key) => {
        if (params[key] === undefined || params[key] === null || params[key] === '') {
            delete params[key];
        }
    });
    const response = await api.get(`/categories/${slug}`, { params });
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

// Alias used by storefront components (returns flat root-level categories or tree)
export const getCategories = async () => {
    const response = await api.get('/categories');
    return response.data?.data || [];
};

export const reorderCategory = async (id, direction) => {
    const response = await api.post(`/categories/${id}/reorder`, { direction });
    return response.data;
};

export const reorderCategoryProducts = async (id, productIds) => {
    const response = await api.post(`/categories/${id}/products/reorder`, { productIds });
    return response.data;
};
