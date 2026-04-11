import api from './api';

const PageService = {
    /**
     * Public: Fetch published pages for a specific link position (e.g., 'bottom')
     */
    getPublicPages: async (linkPosition) => {
        const response = await api.get('/pages/public', { params: { linkPosition } });
        return response.data;
    },

    /**
     * Public: Fetch a single public page by its slug
     */
    getPageBySlug: async (slug) => {
        const response = await api.get(`/pages/public/${slug}`);
        return response.data;
    },

    /**
     * Admin: Fetch all pages with optional filters
     */
    adminGetPages: async (params) => {
        const response = await api.get('/pages', { params });
        return response.data;
    },

    /**
     * Admin: Get a single page by ID
     */
    adminGetPageById: async (id) => {
        const response = await api.get(`/pages/${id}`);
        return response.data;
    },

    /**
     * Admin: Create a new page
     */
    adminCreatePage: async (data) => {
        const response = await api.post('/pages', data);
        return response.data;
    },

    /**
     * Admin: Update an existing page
     */
    adminUpdatePage: async (id, data) => {
        const response = await api.put(`/pages/${id}`, data);
        return response.data;
    },

    /**
     * Admin: Delete a page
     */
    adminDeletePage: async (id) => {
        const response = await api.delete(`/pages/${id}`);
        return response.data;
    }
};

export default PageService;
