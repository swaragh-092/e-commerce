import api from './api';

/** Creates a provider payment order/session. */
export const createPaymentOrder = (orderId) =>
  api.post('/payments/create-order', { orderId });

/** Verifies provider payment status/signature. */
export const verifyPayment = (orderId, paymentData = {}) =>
  api.post(`/payments/verify/${orderId}`, paymentData);

/** Reports an aborted/failed payment so the order leaves limbo. */
export const markPaymentFailed = (orderId, data = {}) =>
  api.post(`/payments/fail/${orderId}`, data);

/** Admin: fetch configured payment gateways. */
export const getPaymentGateways = () => api.get('/payments/gateways');

/** Admin: configure provider credentials. */
export const configurePaymentGateway = (gatewayId, payload) =>
  api.post(`/payments/gateways/${gatewayId}/configure`, payload);

const paymentService = {
  createOrder: createPaymentOrder,
  verifyPayment,
  markFailed: markPaymentFailed,
  getGateways: getPaymentGateways,
  configureGateway: configurePaymentGateway,
};

export default paymentService;
