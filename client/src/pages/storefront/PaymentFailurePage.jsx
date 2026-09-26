import React, { useEffect, useState } from 'react';
import { Container, Typography, Button, Box, Alert, CircularProgress, Paper } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { orderService } from '../../services/orderService';
import { PAYMENT_SETTLED_STATUSES } from '../../utils/constants';

const DEFINITIVE_FAILURE_STATUSES = new Set([
    'failed',
    'payment_failed',
    'payment_expired',
    'expired',
]);

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const getPaymentRecord = (order) => {
    if (Array.isArray(order?.Payment)) return order.Payment[0] || null;
    return order?.Payment || order?.payment || null;
};

export const getPaymentFailureState = (order) => {
    if (!order) return 'unknown';

    const paymentStatus = normalizeStatus(getPaymentRecord(order)?.status || order.paymentStatus);
    if (PAYMENT_SETTLED_STATUSES.includes(paymentStatus)) return 'settled';
    if (DEFINITIVE_FAILURE_STATUSES.has(paymentStatus)) return 'failed';

    // A pending or missing provider record is intentionally not treated as a
    // failed payment: a webhook may still be processing or the provider may
    // have accepted the payment without returning a final result yet.
    return 'pending';
};

const PaymentFailurePage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search);
    const orderId = location.state?.orderId || query.get('orderId');
    const providerStatus = location.state?.status || query.get('status');
    const [verificationState, setVerificationState] = useState(orderId ? 'loading' : 'unknown');
    const [verificationError, setVerificationError] = useState('');
    const [order, setOrder] = useState(null);

    useEffect(() => {
        let active = true;

        if (!orderId) {
            setVerificationState('unknown');
            setOrder(null);
            return () => { active = false; };
        }

        setVerificationState('loading');
        setVerificationError('');
        orderService.getMyOrderById(orderId)
            .then((verifiedOrder) => {
                if (!active) return;
                setOrder(verifiedOrder || null);
                setVerificationState(getPaymentFailureState(verifiedOrder));
            })
            .catch(() => {
                if (!active) return;
                setOrder(null);
                setVerificationError('We could not verify the order from the server. Check your bank or payment provider before trying again.');
                setVerificationState('unknown');
            });

        return () => { active = false; };
    }, [orderId]);

    const isLoading = verificationState === 'loading';
    const isSettled = verificationState === 'settled';
    const isPending = verificationState === 'pending';
    const isFailed = verificationState === 'failed';
    const orderPath = orderId ? `/account/orders/${orderId}` : '/orders';

    const title = isLoading
        ? 'Checking payment status'
        : isSettled
            ? 'Payment received'
            : isFailed
                ? 'Payment failed'
                : isPending
                    ? 'Payment status is still pending'
                    : 'We could not confirm payment status';

    const message = isLoading
        ? 'We are checking the order and payment status with the server.'
        : isSettled
            ? 'The server confirmed your payment. Your order is available in your account.'
            : isFailed
                ? 'The server confirmed that this payment did not complete. You can retry this order.'
                : isPending
                    ? `The payment provider has not returned a final result yet${providerStatus ? ` (reported status: ${providerStatus})` : ''}. Check your order status before starting another payment.`
                    : verificationError || 'We could not verify whether the payment completed. Check your bank or payment provider before trying again.';

    return (
        <Container maxWidth="sm" sx={{ py: { xs: 5, md: 8 } }}>
            <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                {isLoading && <CircularProgress sx={{ mb: 2 }} />}
                {!isLoading && (isSettled ? (
                    <CheckCircleOutlineIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                ) : isPending ? (
                    <HourglassTopIcon sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
                ) : (
                    <ErrorOutlineIcon sx={{ fontSize: 80, color: isFailed ? 'error.main' : 'warning.main', mb: 2 }} />
                ))}
                <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>{title}</Typography>
                <Alert severity={isSettled ? 'success' : isFailed ? 'error' : isPending || isLoading ? 'info' : 'warning'} sx={{ mb: 4, textAlign: 'left' }}>
                    {message}
                </Alert>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {isFailed && orderId && (
                        <Button variant="contained" onClick={() => navigate(`/payment/${orderId}`)}>Try Again</Button>
                    )}
                    {(isSettled || isPending) && orderId && (
                        <Button variant="contained" component={Link} to={orderPath}>View Order Status</Button>
                    )}
                    {!isSettled && !isPending && !isFailed && orderId && (
                        <Button variant="outlined" component={Link} to={orderPath}>Check My Orders</Button>
                    )}
                    {!orderId && (
                        <Button variant="contained" onClick={() => navigate(-1)}>Return</Button>
                    )}
                    <Button variant="outlined" component={Link} to="/cart">Back to Cart</Button>
                </Box>
                {order?.orderNumber && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3 }}>
                        Order reference: {order.orderNumber}
                    </Typography>
                )}
            </Paper>
        </Container>
    );
};

export default PaymentFailurePage;
