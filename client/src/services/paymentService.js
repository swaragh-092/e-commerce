import api from './api';

const paymentService = {
  /** Creates a provider payment order/session. */
  createOrder: (orderId) =>
    api.post('/payments/create-order', { orderId }),

  /** Verifies provider payment status/signature. */
  verifyPayment: (orderId, paymentData) =>
    api.post(`/payments/verify/${orderId}`, paymentData),
};

export default paymentService;
