import api from './api';

export const getBrands = (params) => api.get('/brands', { params });
export const getBrandBySlug = (slug) => api.get(`/brands/${slug}`);
export const createBrand = (data) => api.post('/brands', data);
export const updateBrand = (id, data) => api.patch(`/brands/${id}`, data);
export const deleteBrand = (id) => api.delete(`/brands/${id}`);

const brandService = {
    getBrands,
    getBrandBySlug,
    createBrand,
    updateBrand,
    deleteBrand,
};

export default brandService;
