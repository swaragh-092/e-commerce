import api from './api';

const BASE = (id) => `/products/${id}/combo-items`;

const validateProductId = (productId) => {
    if (!productId || (typeof productId === 'number' && isNaN(productId))) {
        throw new Error(`Invalid productId provided to productComboService: ${productId}`);
    }
};

const productComboService = {
    getItems: (productId) => {
        validateProductId(productId);
        return api.get(BASE(productId));
    },
    syncItems: (productId, items) => {
        validateProductId(productId);
        return api.put(BASE(productId), { items });
    },
    getVirtualStock: (productId) => {
        validateProductId(productId);
        return api.get(`${BASE(productId)}/stock`);
    },
    getSuggestedPrice: (productId) => {
        validateProductId(productId);
        return api.get(`${BASE(productId)}/suggested-price`);
    },
};

export default productComboService;
