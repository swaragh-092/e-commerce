import api from './api';

const calculateShipping = (data) => api.post('/shipping/calculate', data);
const checkServiceability = (data) => api.post('/shipping/check-serviceability', data);

export {
  calculateShipping,
  checkServiceability,
};
