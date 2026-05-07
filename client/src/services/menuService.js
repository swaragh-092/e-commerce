import api from './api';

const MenuService = {
  getPublicMenu: async (location) => {
    const response = await api.get(`/menus/public/${location}`);
    return response.data;
  },

  adminGetMenus: async (params) => {
    const response = await api.get('/menus', { params });
    return response.data;
  },

  adminGetMenuById: async (id) => {
    const response = await api.get(`/menus/${id}`);
    return response.data;
  },

  adminCreateMenu: async (data) => {
    const response = await api.post('/menus', data);
    return response.data;
  },

  adminUpdateMenu: async (id, data) => {
    const response = await api.put(`/menus/${id}`, data);
    return response.data;
  },

  adminDeleteMenu: async (id) => {
    const response = await api.delete(`/menus/${id}`);
    return response.data;
  },

  adminCreateMenuItem: async (menuId, data) => {
    const response = await api.post(`/menus/${menuId}/items`, data);
    return response.data;
  },

  adminUpdateMenuItem: async (menuId, itemId, data) => {
    const response = await api.put(`/menus/${menuId}/items/${itemId}`, data);
    return response.data;
  },

  adminDeleteMenuItem: async (menuId, itemId) => {
    const response = await api.delete(`/menus/${menuId}/items/${itemId}`);
    return response.data;
  },

  adminReorderMenuItems: async (menuId, items) => {
    const response = await api.put(`/menus/${menuId}/items/reorder`, { items });
    return response.data;
  },
};

export default MenuService;
