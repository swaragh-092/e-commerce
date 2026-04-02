import api from './api';

export const userService = {
  getMe: async () => {
    const response = await api.get('/users/me');
    return response.data.data;
  },

  updateMe: async (profileData) => {
    const response = await api.put('/users/me', profileData);
    return response.data.data;
  },

  updateAvatar: async (mediaId) => {
    const response = await api.post('/users/me/avatar', { mediaId });
    return response.data.data;
  },

  changePassword: async (passwordData) => {
    const response = await api.put('/users/me/password', passwordData);
    return response.data;
  },
  
  createAddress: async (addressData) => {
    const response = await api.post('/users/me/addresses', addressData);
    return response.data.data;
  },

  updateAddress: async (id, addressData) => {
    const response = await api.put(`/users/me/addresses/${id}`, addressData);
    return response.data.data;
  },

  deleteAddress: async (id) => {
    const response = await api.delete(`/users/me/addresses/${id}`);
    return response.data;
  }
};
