import React, { useState, useEffect, useContext } from 'react';
import {
    Box, Container, Typography, Button, Divider, Paper, TextField,
    CircularProgress, Alert, Stepper, Step, StepLabel, Radio, RadioGroup,
    FormControlLabel, Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { useCart } from '../../hooks/useCart';
import { userService } from '../../services/userService';
import { validateCoupon } from '../../services/adminService';
import PageSEO from '../../components/common/PageSEO';

const CheckoutPage = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { settings } = useSettings();
    const { cart, clearCart } = useCart();
    const couponsEnabled = settings?.features?.coupons !== false;
    const STEPS = couponsEnabled
        ? ['Shipping', 'Coupon', 'Review & Place Order']
        : ['Shipping', 'Review & Place Order'];
    const reviewStep = couponsEnabled ? 2 : 1;
    const [activeStep, setActiveStep] = useState(0);

    // Addresses
    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState('');
    const [loadingAddresses, setLoadingAddresses] = useState(true);

    // Coupon
    const [couponCode, setCouponCode] = useState('');
    const [couponResult, setCouponResult] = useState(null); // { discount, message }
    const [couponLoading, setCouponLoading] = useState(false);

    // Notes
    const [notes, setNotes] = useState('');

    // Placing order
    const [placing, setPlacing] = useState(false);
    const [error, setError] = useState(null);

    const items = cart?.items || [];
    const subtotal = items.reduce((sum, item) => {
        const price = parseFloat(item.product?.salePrice || item.product?.price || 0);
        const modifier = parseFloat(item.variant?.priceModifier ?? 0);
        return sum + (price + modifier) * item.quantity;
    }, 0);
    const discount = couponResult?.discount || 0;
    const total = Math.max(0, subtotal - discount);

    useEffect(() => {
        userService.getAddresses()
            .then((data) => {
                const list = Array.isArray(data) ? data : data?.rows || [];
                setAddresses(list);
                const def = list.find((a) => a.isDefault);
                if (def) setSelectedAddressId(def.id);
                else if (list.length > 0) setSelectedAddressId(list[0].id);
            })
            .catch(() => {})
            .finally(() => setLoadingAddresses(false));
    }, []);

    const handleApplyCoupon = async () => {
        setCouponLoading(true);
        setCouponResult(null);
        try {
            const res = await validateCoupon(couponCode, subtotal);
            setCouponResult({ discount: res.data?.data?.discountAmount || 0, message: res.data?.data?.message || 'Coupon applied!' });
        } catch (err) {
            setCouponResult({ discount: 0, message: err?.response?.data?.message || 'Invalid coupon code.', error: true });
        } finally {
            setCouponLoading(false);
        }
    };

    const handlePlaceOrder = async () => {
        if (!selectedAddressId) { setError('Please select a shipping address.'); return; }
        setPlacing(true);
        setError(null);
        try {
            const { placeOrder } = await import('../../services/adminService');
            const res = await placeOrder({
                shippingAddressId: selectedAddressId,
                ...(couponCode && couponResult && !couponResult.error && { couponCode }),
                ...(notes && { notes }),
            });
            const orderId = res.data?.data?.id;
            await clearCart();
            navigate(`/payment/${orderId}`);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to place order. Please try again.');
            setPlacing(false);
        }
    };

    if (items.length === 0) {
        return (
            <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h5">Your cart is empty</Typography>
                <Button variant="contained" href="/products" sx={{ mt: 2 }}>Browse Products</Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <PageSEO title="Checkout" type="noindex" />
            <Typography variant="h4" fontWeight={700} mb={3}>Checkout</Typography>

            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {STEPS.map((label) => (
                    <Step key={label}><StepLabel>{label}</StepLabel></Step>
                ))}
            </Stepper>

            {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 320px' }, gap: 3 }}>
                {/* Left panel */}
                <Box>
                    {/* Step 0: Shipping */}
                    {activeStep === 0 && (
                        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                            <Typography variant="h6" fontWeight={600} mb={2}>Select Shipping Address</Typography>
                            {loadingAddresses ? (
                                <CircularProgress size={24} />
                            ) : addresses.length === 0 ? (
                                <Box>
                                    <Alert severity="warning" sx={{ mb: 2 }}>No saved addresses. Please add one in your account settings.</Alert>
                                    <Button variant="outlined" href="/account">Go to Account</Button>
                                </Box>
                            ) : (
                                <RadioGroup value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)}>
                                    {addresses.map((addr) => (
                                        <Paper key={addr.id} variant="outlined" sx={{ p: 2, mb: 1.5, borderColor: selectedAddressId === addr.id ? 'primary.main' : 'divider' }}>
                                            <FormControlLabel
                                                value={addr.id}
                                                control={<Radio />}
                                                label={
                                                    <Box>
                                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                            <Typography variant="body2" fontWeight={600}>{addr.label || 'Address'}</Typography>
                                                            {addr.isDefault && <Chip label="Default" size="small" color="primary" />}
                                                        </Box>
                                                        <Typography variant="body2">{addr.fullName}</Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {addr.addressLine1}, {addr.city}, {addr.state} {addr.postalCode}, {addr.country}
                                                        </Typography>
                                                    </Box>
                                                }
                                                sx={{ alignItems: 'flex-start', m: 0 }}
                                            />
                                        </Paper>
                                    ))}
                                </RadioGroup>
                            )}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                                <Button variant="contained" disabled={!selectedAddressId} onClick={() => setActiveStep(1)}>Continue</Button>
                            </Box>
                        </Paper>
                    )}

                    {/* Step 1: Coupon */}
                    {activeStep === 1 && couponsEnabled && (
                        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                            <Typography variant="h6" fontWeight={600} mb={2}>Coupon Code (optional)</Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                <TextField
                                    size="small"
                                    label="Enter coupon code"
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                    sx={{ flexGrow: 1 }}
                                />
                                <Button variant="outlined" onClick={handleApplyCoupon} disabled={!couponCode || couponLoading}>
                                    {couponLoading ? <CircularProgress size={20} /> : 'Apply'}
                                </Button>
                            </Box>
                            {couponResult && (
                                <Alert severity={couponResult.error ? 'error' : 'success'} sx={{ mb: 1 }}>
                                    {couponResult.message}
                                    {!couponResult.error && ` — Saving $${Number(couponResult.discount).toFixed(2)}`}
                                </Alert>
                            )}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                                <Button onClick={() => setActiveStep(0)}>Back</Button>
                                <Button variant="contained" onClick={() => setActiveStep(reviewStep)}>Continue</Button>
                            </Box>
                        </Paper>
                    )}

                    {/* Step 2: Review & Place */}
                    {activeStep === reviewStep && (
                        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                            <Typography variant="h6" fontWeight={600} mb={2}>Review Your Order</Typography>
                            {items.map((item) => {
                                const price = parseFloat(item.product?.salePrice || item.product?.price || 0);
                                const modifier = parseFloat(item.variant?.priceModifier ?? 0);
                                return (
                                    <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2">
                                            {item.product?.name} {item.variant ? `(${item.variant.name}: ${item.variant.value})` : ''} × {item.quantity}
                                        </Typography>
                                        <Typography variant="body2" fontWeight={600}>
                                            ${((price + modifier) * item.quantity).toFixed(2)}
                                        </Typography>
                                    </Box>
                                );
                            })}
                            <Divider sx={{ my: 2 }} />
                            <TextField
                                fullWidth
                                size="small"
                                label="Order notes (optional)"
                                multiline
                                rows={2}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                sx={{ mb: 2 }}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                                <Button onClick={() => setActiveStep(reviewStep - 1)}>Back</Button>
                                <Button
                                    variant="contained"
                                    size="large"
                                    onClick={handlePlaceOrder}
                                    disabled={placing}
                                >
                                    {placing ? <CircularProgress size={22} color="inherit" /> : 'Place Order & Pay'}
                                </Button>
                            </Box>
                        </Paper>
                    )}
                </Box>

                {/* Right: order summary */}
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, alignSelf: 'start', position: 'sticky', top: 80 }}>
                    <Typography variant="h6" fontWeight={700} mb={2}>Summary</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography color="text.secondary">Subtotal</Typography>
                        <Typography>${subtotal.toFixed(2)}</Typography>
                    </Box>
                    {discount > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography color="success.main">Discount</Typography>
                            <Typography color="success.main">-${discount.toFixed(2)}</Typography>
                        </Box>
                    )}
                    <Divider sx={{ my: 1.5 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography fontWeight={700}>Total</Typography>
                        <Typography fontWeight={700} color="primary.main">${total.toFixed(2)}</Typography>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default CheckoutPage;
