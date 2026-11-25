import api from './api';

export const getBrands = (params) => api.get('/brands', { params });
export const getEligibleBrands = async () => {
    const brands = [];
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page += 1) {
        const { data: response } = await getBrands({ isActive: true, withPublishedProducts: true, page, limit: 1000 });
        brands.push(...(response?.data || []));
        totalPages = response?.meta?.totalPages ?? 1;
    }
    return brands;
};
export const getBrandBySlug = (slug, params) => api.get(`/brands/${slug}`, { params });
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
