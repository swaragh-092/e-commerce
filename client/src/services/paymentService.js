import api from './api';

const paymentService = {
  /** Creates a Stripe PaymentIntent for an order. Returns { clientSecret, paymentIntentId } */
  createIntent: (orderId) =>
    api.post('/payments/create-intent', { orderId }),
};

export default paymentService;
