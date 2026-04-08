import api from './api';

const paymentService = {
  /** Creates a Razorpay Order. Returns { id, amount, currency } */
  createOrder: (orderId) =>
    api.post('/payments/create-order', { orderId }),

  /** Verifies Razorpay payment signature */
  verifyPayment: (orderId, paymentData) =>
    api.post(`/payments/verify/${orderId}`, paymentData),
};

export default paymentService;
