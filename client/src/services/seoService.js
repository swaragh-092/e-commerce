import api from './api';

export const getMetadata = async (path, { includeGeneratedSchema, signal } = {}) => {
    try {
        const response = await api.get(`/seo/metadata`, { params: { path, includeGeneratedSchema }, signal });
        return response.data.data;
    } catch (error) {
        if (!signal?.aborted) console.error('Error fetching SEO metadata:', error);
        return null;
    }
};

export const getSeoOverrides = () => api.get('/seo/overrides');
export const createSeoOverride = (data) => api.post('/seo/overrides', data);
export const updateSeoOverride = (id, data) => api.put(`/seo/overrides/${id}`, data);
export const deleteSeoOverride = (id) => api.delete(`/seo/overrides/${id}`);

export const seoService = {
    getMetadata,
    getSeoOverrides,
    createSeoOverride,
    updateSeoOverride,
    deleteSeoOverride,
};
