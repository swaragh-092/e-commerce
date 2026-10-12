import api from './api';

const newsletterService = {
  subscribe: async (email, source = 'register') => {
    const response = await api.post('/newsletter/subscribe', { email, source });
    return response.data.data;
  },
  getMyStatus: async () => {
    const response = await api.get('/newsletter/me');
    return response.data.data;
  },
  updateMyStatus: async (subscribed) => {
    const response = await api.put('/newsletter/me', { subscribed });
    return response.data.data;
  },
};

export default newsletterService;
