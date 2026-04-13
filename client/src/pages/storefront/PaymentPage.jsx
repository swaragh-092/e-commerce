import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, CircularProgress, Alert, Button, Paper, Divider } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import paymentService from '../../services/paymentService';
import PageSEO from '../../components/common/PageSEO';
import CenteredLoader from '../../components/common/CenteredLoader';
import { getApiErrorMessage } from '../../utils/apiErrors';

const PaymentPage = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [orderData, setOrderData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!orderId) { navigate('/cart'); return; }
        
        // Initialize Razorpay Order on mount/checkout
        paymentService.createOrder(orderId)
            .then((res) => {
                setOrderData(res.data?.data || res.data);
            })
            .catch((err) => {
                setError(getApiErrorMessage(err, 'Failed to initialize payment. Please contact support.'));
            })
            .finally(() => setLoading(false));
    }, [orderId, navigate]);

    const handlePayment = () => {
        if (!orderData || !window.Razorpay) {
            setError('Payment system is not ready. Please try again.');
            return;
        }

        setProcessing(true);

        const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
            amount: orderData.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
            currency: orderData.currency,
            name: "My Store",
            description: `Order #${orderId}`,
            order_id: orderData.id, // This is a sample Order ID. Pass the `id` obtained in the response of Step 1
            handler: async (response) => {
                try {
                    // Send verification data to backend
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
                // You can optionally prefill customer details
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
                    Order #{orderId} — Total: {orderData.currency} {(orderData.amount / 100).toFixed(2)}
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
