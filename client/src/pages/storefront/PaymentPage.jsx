import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, CircularProgress, Alert, Button, Paper, Divider } from '@mui/material';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import paymentService from '../../services/paymentService';
import { getOrderById } from '../../services/adminService';
import PageSEO from '../../components/common/PageSEO';
import CenteredLoader from '../../components/common/CenteredLoader';
import { getApiErrorMessage } from '../../utils/apiErrors';

const loadScript = (src, globalName) => new Promise((resolve, reject) => {
    if (globalName && window[globalName]) {
        resolve(window[globalName]);
        return;
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
        if (globalName && window[globalName]) {
            resolve(window[globalName]);
            return;
        }
        if (existing.dataset.loaded === 'true') {
            resolve(globalName ? window[globalName] : true);
            return;
        }
        existing.addEventListener('load', () => resolve(globalName ? window[globalName] : true), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
        script.dataset.loaded = 'true';
        resolve(globalName ? window[globalName] : true);
    };
    script.onerror = reject;
    document.body.appendChild(script);
});

const PaymentPage = () => {
    const { orderId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [orderData, setOrderData] = useState(null);
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!orderId) { navigate('/cart'); return; }
        const query = new URLSearchParams(location.search);
        const returnedProvider = query.get('provider');

        if (returnedProvider === 'cashfree') {
            paymentService.verifyPayment(orderId, { provider: 'cashfree' })
                .then((res) => {
                    const result = res.data?.data || res.data;
                    if (result?.success) {
                        navigate('/payment/success', { replace: true, state: { orderId } });
                    } else {
                        navigate('/payment/failure', { replace: true, state: { orderId, status: result?.status } });
                    }
                })
                .catch((err) => setError(getApiErrorMessage(err, 'Payment verification failed.')))
                .finally(() => setLoading(false));
            return;
        }

        // First fetch the order to detect COD orders before touching Razorpay
        getOrderById(orderId)
            .then((res) => {
                const order = res.data?.data || res.data;
                setOrder(order);

                // Guard: COD orders should never reach this page — redirect to success
                if (order?.paymentMethod === 'cod') {
                    navigate('/payment/success', { replace: true, state: { orderId, isCod: true } });
                    return;
                }

                return paymentService.createOrder(orderId)
                    .then((r) => setOrderData(r.data?.data || r.data));
            })
            .catch((err) => {
                setError(getApiErrorMessage(err, 'Failed to initialize payment. Please contact support.'));
            })
            .finally(() => setLoading(false));
    }, [orderId, location.search, navigate]);

    const handleRazorpayPayment = () => {
        if (!orderData || !window.Razorpay) {
            setError('Payment system is not ready. Please try again.');
            return;
        }

        setProcessing(true);

        const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount: orderData.amount,
            currency: orderData.currency,
            name: "My Store",
            description: `Order #${orderId}`,
            order_id: orderData.id,
            handler: async (response) => {
                try {
                    await paymentService.verifyPayment(orderId, {
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature
                    });
                    navigate('/payment/success', { state: { orderId } });
                } catch (err) {
                    setError(getApiErrorMessage(err, 'Payment verification failed.'));
                    setProcessing(false);
                }
            },
            prefill: {
                name: "",
                email: "",
                contact: ""
            },
            theme: {
                color: "#6C63FF"
            },
            modal: {
                ondismiss: () => {
                    setProcessing(false);
                }
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
    };

    const handleCashfreePayment = async () => {
        if (!orderData?.paymentSessionId) {
            setError('Cashfree payment session is not ready. Please try again.');
            return;
        }

        setProcessing(true);
        try {
            await loadScript('https://sdk.cashfree.com/js/v3/cashfree.js', 'Cashfree');
            const cashfree = window.Cashfree({
                mode: orderData.mode || 'sandbox',
            });

            await cashfree.checkout({
                paymentSessionId: orderData.paymentSessionId,
                redirectTarget: '_modal',
            });

            const res = await paymentService.verifyPayment(orderId, { provider: 'cashfree' });
            const result = res.data?.data || res.data;
            if (result?.success) {
                navigate('/payment/success', { state: { orderId } });
            } else {
                setError(`Payment is not completed yet. Current status: ${result?.status || 'pending'}.`);
                setProcessing(false);
            }
        } catch (err) {
            setError(getApiErrorMessage(err, 'Cashfree payment failed. Please try again.'));
            setProcessing(false);
        }
    };

    const handlePayment = () => {
        if (orderData?.provider === 'cashfree' || order?.paymentMethod === 'cashfree') {
            handleCashfreePayment();
            return;
        }

        handleRazorpayPayment();
    };

    if (loading) {
        return <CenteredLoader message="Loading payment details..." minHeight="50vh" />;
    }

    if (error || !orderData) {
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
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>Confirm your order</Typography>
                <Typography variant="body2" color="text.secondary" mb={4}>
                    Order #{orderId} — {orderData.provider === 'cashfree' ? 'Cashfree' : 'Razorpay'} — Total: {orderData.currency} {(orderData.amount / 100).toFixed(2)}
                </Typography>
                <Divider sx={{ mb: 4 }} />

                <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={processing}
                    onClick={handlePayment}
                    sx={{ py: 1.5, mb: 2 }}
                >
                    {processing ? <CircularProgress size={24} color="inherit" /> : 'Pay Now'}
                </Button>

                <Button
                    fullWidth
                    variant="text"
                    onClick={() => navigate('/cart')}
                    disabled={processing}
                >
                    Cancel and Return to Cart
                </Button>
            </Paper>
        </Container>
    );
};

export default PaymentPage;
