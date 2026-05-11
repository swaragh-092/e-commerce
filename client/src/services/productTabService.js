import api from './api';

const BASE = (productId) => `/products/${productId}/tabs`;

const productTabService = {
    /** Fetch all tabs for a product (ordered by sort_order) */
    getTabs: (productId) => api.get(BASE(productId)),

    /** Create a single tab */
    createTab: (productId, data) => api.post(BASE(productId), data),

    /** Update a single tab */
    updateTab: (productId, tabId, data) => api.put(`${BASE(productId)}/${tabId}`, data),

    /** Delete a single tab */
    deleteTab: (productId, tabId) => api.delete(`${BASE(productId)}/${tabId}`),

    /** Reorder tabs — array of { id, sortOrder } */
    reorderTabs: (productId, order) => api.put(`${BASE(productId)}/reorder`, { order }),

    /**
     * Full sync: send the complete tabs array (create/update/delete in one call).
     * Each tab may or may not have an `id` field.
     */
    syncTabs: (productId, tabs) => api.put(BASE(productId), { tabs }),
};

export default productTabService;
