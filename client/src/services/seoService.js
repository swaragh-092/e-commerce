import api from './api';

export const getMetadata = async (path) => {
    try {
        const response = await api.get(`/seo/metadata`, { params: { path } });
        return response.data.data;
    } catch (error) {
        console.error('Error fetching SEO metadata:', error);
        return null;
    }
};

export const seoService = {
    getMetadata,
};
