import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, CircularProgress, Alert, Button, Paper, Divider } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import paymentService from '../../services/paymentService';
import PageSEO from '../../components/common/PageSEO';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

/* Inner form - must be inside <Elements> */
const CheckoutForm = ({ orderId }) => {
    const stripe = useStripe();
    const elements = useElements();
    const navigate = useNavigate();
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setProcessing(true);
        setError(null);

        const { error: stripeError } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/payment/success`,
            },
            redirect: 'if_required',
        });

        if (stripeError) {
            setError(stripeError.message);
            setProcessing(false);
        } else {
            navigate('/payment/success', { state: { orderId } });
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <PaymentElement />
            <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={!stripe || processing}
                sx={{ mt: 3, py: 1.5 }}
            >
                {processing ? <CircularProgress size={22} color="inherit" /> : 'Confirm Payment'}
            </Button>
            <Button fullWidth sx={{ mt: 1 }} onClick={() => navigate('/cart')} disabled={processing}>
                Back to Cart
            </Button>
        </Box>
    );
};

const PaymentPage = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [clientSecret, setClientSecret] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!orderId) { navigate('/cart'); return; }
        paymentService.createIntent(orderId)
            .then((res) => {
                setClientSecret(res.data?.data?.clientSecret || res.data?.clientSecret);
            })
            .catch((err) => {
                setError(err?.response?.data?.message || 'Failed to initialize payment. Please contact support.');
            })
            .finally(() => setLoading(false));
    }, [orderId, navigate]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !clientSecret) {
        return (
            <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
                <Alert severity="error" sx={{ mb: 3 }}>{error || 'Could not load payment details.'}</Alert>
                <Button variant="outlined" onClick={() => navigate('/cart')}>Return to Cart</Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <PageSEO title="Payment" type="noindex" />
            <Typography variant="h4" fontWeight={700} mb={3}>Complete Payment</Typography>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                <Typography variant="body2" color="text.secondary" mb={2}>
                    Order #{orderId} — Enter your payment details below.
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <CheckoutForm orderId={orderId} />
                </Elements>
            </Paper>
        </Container>
    );
};

export default PaymentPage;
