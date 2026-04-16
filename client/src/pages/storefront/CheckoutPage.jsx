import React, { useState, useEffect, useContext } from 'react';
import {
    Box, Container, Typography, Button, Divider, Paper, TextField,
    CircularProgress, Alert, Stepper, Step, StepLabel, Radio, RadioGroup,
    FormControlLabel, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    Grid, IconButton, Checkbox,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { useSettings, useCurrency, useFeature } from '../../hooks/useSettings';
import { useCart } from '../../hooks/useCart';
import { userService } from '../../services/userService';
import { validateCoupon, getEligibleCoupons } from '../../services/adminService';
import PageSEO from '../../components/common/PageSEO';
import { getCartItemUnitPrice } from '../../utils/variantPricing';
import CenteredLoader from '../../components/common/CenteredLoader';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { getVariantOptionLabel } from '../../utils/variantOptions';

const EMPTY_ADDR = {
    label: '', fullName: '', phone: '',
    addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', country: '',
    isDefault: false,
};

const normalizeBuyNowQuantity = (value) => {
    const parsedQuantity = Number(value);

    if (!Number.isFinite(parsedQuantity)) {
        return 1;
    }

    return Math.max(1, Math.floor(parsedQuantity));
};

const normalizeBuyNowItem = (item) => {
    if (!item?.productId) {
        return null;
    }

    const product = item.product && typeof item.product === 'object' ? item.product : null;
    const variant = item.variant && typeof item.variant === 'object' ? item.variant : null;
    const hasProductIdentity = Boolean(product?.id || product?.name);
    const hasPriceData = Boolean(
        product && (
            product.effectivePrice != null ||
            product.price != null ||
            product.salePrice != null ||
            variant?.unitPrice != null ||
            variant?.priceModifier != null
        )
    );

    if (!hasProductIdentity || !hasPriceData) {
        return null;
    }

    return {
        id: item.id || `${item.productId}-${item.variantId || variant?.id || 'base'}`,
        productId: item.productId,
        variantId: item.variantId ?? variant?.id ?? null,
        quantity: normalizeBuyNowQuantity(item.quantity),
        product: {
            ...product,
            id: product.id || item.productId,
            name: product.name || 'Product',
        },
        variant: variant
            ? {
                ...variant,
                id: variant.id || item.variantId || null,
            }
            : null,
    };
};

const CheckoutPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useContext(AuthContext);
    const { settings } = useSettings();
    const { formatPrice } = useCurrency();
    const { cart, clearCart } = useCart();
    const buyNowItem = location.state?.fromBuyNow ? normalizeBuyNowItem(location.state?.buyNowItem) : null;
    const isBuyNowFlow = Boolean(buyNowItem);
    const couponsEnabled = settings?.features?.coupons !== false;
    const showAvailableCoupons = useFeature('showAvailableCoupons');
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
    const [couponResult, setCouponResult] = useState(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [publicCoupons, setPublicCoupons] = useState([]);
    const [publicCouponsLoading, setPublicCouponsLoading] = useState(false);
    const [eligibleCouponSummary, setEligibleCouponSummary] = useState(null);

    // Notes
    const [notes, setNotes] = useState('');

    // Address add / edit dialog
    const [addrDialog, setAddrDialog] = useState({ open: false, mode: 'add', addrId: null, form: EMPTY_ADDR, saving: false, errors: {} });
    const openAddAddrDialog = () =>
        setAddrDialog({ open: true, mode: 'add', addrId: null, form: { ...EMPTY_ADDR }, saving: false, errors: {} });
    const openEditAddrDialog = (addr) =>
        setAddrDialog({
            open: true, mode: 'edit', addrId: addr.id, saving: false,
            form: {
                label: addr.label || '', fullName: addr.fullName || '', phone: addr.phone || '',
                addressLine1: addr.addressLine1 || '', addressLine2: addr.addressLine2 || '',
                city: addr.city || '', state: addr.state || '',
                postalCode: addr.postalCode || '', country: addr.country || '',
                isDefault: !!addr.isDefault,
            },
            errors: {},
        });
    const setAddrField = (field, val) =>
        setAddrDialog((s) => ({ ...s, form: { ...s.form, [field]: val } }));
    const handleAddrSave = async () => {
        const { mode, addrId, form } = addrDialog;
        setAddrDialog((s) => ({ ...s, saving: true, errors: {} }));
        try {
            let saved;
            if (mode === 'add') {
                saved = await userService.createAddress(form);
            } else {
                saved = await userService.updateAddress(addrId, form);
            }
            const list = await userService.getAddresses();
            const addrList = Array.isArray(list) ? list : list?.rows || [];
            setAddresses(addrList);
            if (mode === 'add' && saved?.id) setSelectedAddressId(saved.id);
            setAddrDialog((s) => ({ ...s, open: false }));
        } catch (err) {
            const errData = err?.response?.data?.error;
            if (errData?.code === 'VALIDATION_ERROR' && errData?.details) {
                const validationErrors = {};
                errData.details.forEach(d => { validationErrors[d.field] = d.message; });
                setAddrDialog((s) => ({ ...s, saving: false, errors: validationErrors }));
            } else {
                setAddrDialog((s) => ({ ...s, saving: false }));
                setError(getApiErrorMessage(err, 'Failed to save address.'));
            }
        }
    };

    // Placing order
    const [placing, setPlacing] = useState(false);
    const [error, setError] = useState(null);

    const items = isBuyNowFlow ? [buyNowItem] : (cart?.items || []);
    const subtotal = items.reduce((sum, item) => {
        const quantity = normalizeBuyNowQuantity(item?.quantity);
        const itemPrice = item?.product ? getCartItemUnitPrice(item) : 0;
        return sum + itemPrice * quantity;
    }, 0);
    const orderDiscount = couponResult?.orderDiscount || 0;
    const appliedCoupons = couponResult?.appliedCoupons || [];

    // Shipping calculation (mirrors server logic)
    const shippingMethod = settings?.shipping?.method || 'flat_rate';
    const flatRate = parseFloat(settings?.shipping?.flatRate ?? 0);
    const freeThreshold = parseFloat(settings?.shipping?.freeThreshold ?? 0);
    let shippingCost = 0;
    if (shippingMethod === 'flat_rate') {
        shippingCost = flatRate;
    } else if (shippingMethod === 'free_above_threshold') {
        shippingCost = subtotal >= freeThreshold ? 0 : flatRate;
    } // 'free' => 0
    const shippingDiscount = couponResult?.shippingDiscount || (couponResult?.freeShipping ? shippingCost : 0);
    const effectiveShippingCost = Math.max(0, shippingCost - shippingDiscount);

    // Tax calculation (supports CGST / SGST / IGST breakdown)
    // GST components override the inclusive flag when enabled
    const enableCGST = settings?.tax?.enableCGST === true;
    const enableSGST = settings?.tax?.enableSGST === true;
    const enableIGST = settings?.tax?.enableIGST === true;
    const useGST = enableCGST || enableSGST || enableIGST;
    const taxInclusive = !useGST && settings?.tax?.inclusive === true;
    const cgstAmount = enableCGST ? subtotal * parseFloat(settings?.tax?.cgstRate ?? 0) : 0;
    const sgstAmount = enableSGST ? subtotal * parseFloat(settings?.tax?.sgstRate ?? 0) : 0;
    const igstAmount = enableIGST ? subtotal * parseFloat(settings?.tax?.igstRate ?? 0) : 0;
    const taxRate = parseFloat(settings?.tax?.rate ?? 0);
    const flatTaxAmount = (!taxInclusive && !useGST && taxRate > 0) ? subtotal * taxRate : 0;
    const taxAmount = useGST ? cgstAmount + sgstAmount + igstAmount : flatTaxAmount;

    const total = Math.max(0, subtotal + effectiveShippingCost + taxAmount - orderDiscount);

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

    useEffect(() => {
        if (activeStep === 1 && couponsEnabled && showAvailableCoupons) {
            setPublicCouponsLoading(true);
            getEligibleCoupons({ subtotal, shippingCost })
                .then((res) => {
                    const data = res.data?.data || {};
                    setPublicCoupons(data.eligibleCoupons || []);
                    setEligibleCouponSummary(data);

                    if (!couponResult && !couponCode && data.bestCombination?.appliedCoupons?.length) {
                        const manualCoupon = data.bestCombination.appliedCoupons.find((coupon) => coupon.applicationMode !== 'auto');
                        setCouponCode(manualCoupon?.code || data.bestCombination.appliedCoupons[0]?.code || '');
                        setCouponResult(data.bestCombination);
                    }
                })
                .catch(() => {})
                .finally(() => setPublicCouponsLoading(false));
        }
    }, [activeStep, couponsEnabled, showAvailableCoupons, subtotal, shippingCost]);

    const handleApplyCoupon = async (codeOverride) => {
        const code = codeOverride || couponCode;
        if (!code) return;
        if (codeOverride) setCouponCode(codeOverride);
        setCouponLoading(true);
        setCouponResult(null);
        try {
            const res = await validateCoupon({ code, subtotal, shippingCost });
            setCouponResult(res.data?.data || null);
        } catch (err) {
            setCouponResult({ orderDiscount: 0, totalDiscount: 0, message: getApiErrorMessage(err, 'Invalid coupon code.'), error: true });
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
                ...(appliedCoupons.length > 0 && { couponCodes: appliedCoupons.map((coupon) => coupon.code) }),
                ...(notes && { notes }),
                ...(isBuyNowFlow && {
                    buyNowItem: {
                        productId: buyNowItem.productId,
                        variantId: buyNowItem.variantId || null,
                        quantity: buyNowItem.quantity,
                    },
                }),
            });
            const orderId = res.data?.data?.order?.id;
            if (!isBuyNowFlow) {
                await clearCart();
            }
            navigate(`/payment/${orderId}`);
        } catch (err) {
            setError(getApiErrorMessage(err, 'Failed to place order. Please try again.'));
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
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" fontWeight={600}>Select Shipping Address</Typography>
                                <Button size="small" startIcon={<AddIcon />} onClick={openAddAddrDialog}>
                                    Add New
                                </Button>
                            </Box>
                            {loadingAddresses ? (
                                <CenteredLoader message="Loading your saved addresses..." minHeight="160px" />
                            ) : addresses.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 3 }}>
                                    <Typography color="text.secondary" mb={2}>No saved addresses yet.</Typography>
                                    <Button variant="outlined" startIcon={<AddIcon />} onClick={openAddAddrDialog}>
                                        Add Your First Address
                                    </Button>
                                </Box>
                            ) : (
                                <RadioGroup value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)}>
                                    {addresses.map((addr) => (
                                        <Paper key={addr.id} variant="outlined" sx={{ p: 2, mb: 1.5, borderColor: selectedAddressId === addr.id ? 'primary.main' : 'divider' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                                <FormControlLabel
                                                    value={addr.id}
                                                    control={<Radio />}
                                                    label={
                                                        <Box>
                                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                                <Typography variant="body2" fontWeight={600}>{addr.label || 'Address'}</Typography>
                                                                {addr.isDefault && <Chip label="Default" size="small" color="primary" />}
                                                            </Box>
                                                            <Typography variant="body2">
                                                                {addr.fullName}{addr.phone ? ` · ${addr.phone}` : ''}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''},{' '}
                                                                {addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.postalCode}, {addr.country}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    sx={{ alignItems: 'flex-start', m: 0, flexGrow: 1 }}
                                                />
                                                <IconButton size="small" sx={{ ml: 1, mt: 0.25 }} onClick={() => openEditAddrDialog(addr)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
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

                            {/* Available coupons */}
                            {showAvailableCoupons && (
                                <Box sx={{ mb: 2.5 }}>
                                    <Typography variant="body2" fontWeight={600} mb={1} color="text.secondary">
                                        Available Coupons
                                    </Typography>
                                    {publicCouponsLoading ? (
                                        <CircularProgress size={18} />
                                    ) : publicCoupons.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {publicCoupons.map((offer) => {
                                                const c = offer.coupon || offer;
                                                const label = c.type === 'percentage'
                                                    ? `${Number(c.value)}% off`
                                                    : c.type === 'free_shipping'
                                                        ? 'Free shipping'
                                                        : `${formatPrice(Number(c.value))} off`;
                                                const minNote = Number(c.minOrderAmount) > 0
                                                    ? ` · min ${formatPrice(Number(c.minOrderAmount))}`
                                                    : '';
                                                const applied = couponCode === c.code && couponResult && !couponResult.error;
                                                return (
                                                    <Chip
                                                        key={c.code}
                                                        icon={<LocalOfferIcon />}
                                                        label={`${c.code} — ${c.name || label}${minNote}`}
                                                        onClick={() => handleApplyCoupon(c.code)}
                                                        color={applied ? 'success' : 'default'}
                                                        variant={applied ? 'filled' : 'outlined'}
                                                        clickable
                                                        disabled={couponLoading}
                                                        size="small"
                                                    />
                                                );
                                            })}
                                        </Box>
                                    ) : (
                                        <Typography variant="caption" color="text.secondary">No coupons available right now.</Typography>
                                    )}
                                    {eligibleCouponSummary?.bestCoupon && !couponResult?.error && (
                                        <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1 }}>
                                            Best available offer saves {formatPrice(eligibleCouponSummary.bestCoupon.totalDiscount || 0)}.
                                        </Typography>
                                    )}
                                </Box>
                            )}

                            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                <TextField
                                    size="small"
                                    label="Enter coupon code"
                                    value={couponCode}
                                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                                    sx={{ flexGrow: 1 }}
                                />
                                <Button variant="outlined" onClick={() => handleApplyCoupon()} disabled={!couponCode || couponLoading}>
                                    {couponLoading ? <CircularProgress size={20} /> : 'Apply'}
                                </Button>
                            </Box>
                            {couponResult && (
                                <Alert severity={couponResult.error ? 'error' : 'success'} sx={{ mb: 1 }}>
                                    {couponResult.message}
                                    {!couponResult.error && ` — Saving ${formatPrice(couponResult.totalDiscount || couponResult.orderDiscount || 0)}`}
                                </Alert>
                            )}
                            {!couponResult?.error && appliedCoupons.length > 1 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                                    {appliedCoupons.map((coupon) => (
                                        <Chip
                                            key={coupon.code}
                                            size="small"
                                            color={coupon.applicationMode === 'auto' ? 'info' : 'success'}
                                            variant="outlined"
                                            label={`${coupon.code} · ${formatPrice(coupon.totalDiscount || 0)}`}
                                        />
                                    ))}
                                </Box>
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
                                const itemPrice = item?.product ? getCartItemUnitPrice(item) : 0;
                                const quantity = normalizeBuyNowQuantity(item?.quantity);
                                const itemName = item?.product?.name || 'Product';
                                return (
                                    <Box key={item.id || `${item.productId}-${item.variantId || 'base'}`} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2">
                                            {itemName} {item.variant ? `(${getVariantOptionLabel(item.variant)})` : ''} � {quantity}
                                        </Typography>
                                        <Typography variant="body2" fontWeight={600}>
                                            {formatPrice(itemPrice * quantity)}
                                        </Typography>
                                    </Box>
                                );
                            })}
                            <Divider sx={{ my: 2 }} />
                            {couponResult && !couponResult.error && (
                                <Alert severity="success" sx={{ mb: 2 }}>
                                    {appliedCoupons.length > 1
                                        ? `${appliedCoupons.length} promotions applied.`
                                        : `${couponResult.coupon?.name || couponCode} applied.`}
                                    {couponResult.coupon?.summary ? ` ${couponResult.coupon.summary}.` : ''}
                                </Alert>
                            )}
                            {couponResult && !couponResult.error && appliedCoupons.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    {appliedCoupons.map((coupon) => (
                                        <Box key={coupon.code} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                {coupon.code}{coupon.applicationMode === 'auto' ? ' (auto)' : ''}
                                            </Typography>
                                            <Typography variant="body2" color="success.main">
                                                -{formatPrice(coupon.totalDiscount || 0)}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            )}
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

                    {/* Items */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography color="text.secondary">Subtotal</Typography>
                        <Typography>{formatPrice(subtotal)}</Typography>
                    </Box>

                    {/* Shipping */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocalShippingIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography color="text.secondary">Shipping</Typography>
                        </Box>
                        {shippingCost === 0 ? (
                            <Chip label="Free" size="small" color="success" />
                        ) : shippingDiscount > 0 ? (
                            <Typography>{formatPrice(effectiveShippingCost)}</Typography>
                        ) : (
                            <Typography>{formatPrice(shippingCost)}</Typography>
                        )}
                    </Box>
                    {shippingDiscount > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography color="success.main">Shipping discount</Typography>
                            <Typography color="success.main">-{formatPrice(shippingDiscount)}</Typography>
                        </Box>
                    )}
                    {shippingMethod === 'free_above_threshold' && shippingCost > 0 && (
                        <Typography variant="caption" color="success.main" display="block" mb={1} textAlign="right">
                            Add {formatPrice(freeThreshold - subtotal)} more for free shipping
                        </Typography>
                    )}

                    {/* GST breakdown */}
                    {enableCGST && cgstAmount > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography color="text.secondary" variant="body2">CGST ({(parseFloat(settings?.tax?.cgstRate ?? 0) * 100).toFixed(1)}%)</Typography>
                            <Typography variant="body2">{formatPrice(cgstAmount)}</Typography>
                        </Box>
                    )}
                    {enableSGST && sgstAmount > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography color="text.secondary" variant="body2">SGST ({(parseFloat(settings?.tax?.sgstRate ?? 0) * 100).toFixed(1)}%)</Typography>
                            <Typography variant="body2">{formatPrice(sgstAmount)}</Typography>
                        </Box>
                    )}
                    {enableIGST && igstAmount > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography color="text.secondary" variant="body2">IGST ({(parseFloat(settings?.tax?.igstRate ?? 0) * 100).toFixed(1)}%)</Typography>
                            <Typography variant="body2">{formatPrice(igstAmount)}</Typography>
                        </Box>
                    )}
                    {/* fallback flat tax */}
                    {!useGST && flatTaxAmount > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography color="text.secondary" variant="body2">Tax ({(taxRate * 100).toFixed(0)}%)</Typography>
                            <Typography variant="body2">{formatPrice(flatTaxAmount)}</Typography>
                        </Box>
                    )}
                    {/* inclusive note */}
                    {taxInclusive && (
                        <Typography variant="caption" color="text.secondary" display="block" mb={1} textAlign="right">
                            Tax included in price
                        </Typography>
                    )}

                    {/* Discount */}
                    {orderDiscount > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography color="success.main">Discount</Typography>
                            <Typography color="success.main">-{formatPrice(orderDiscount)}</Typography>
                        </Box>
                    )}
                    {appliedCoupons.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                            {appliedCoupons.map((coupon) => (
                                <Box key={coupon.code} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography color="text.secondary" variant="body2">
                                        {coupon.code}{coupon.applicationMode === 'auto' ? ' (auto)' : ''}
                                    </Typography>
                                    <Typography color="success.main" variant="body2">
                                        -{formatPrice(coupon.totalDiscount || 0)}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    )}

                    <Divider sx={{ my: 1.5 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography fontWeight={700}>Total</Typography>
                        <Typography fontWeight={700} color="primary.main">{formatPrice(total)}</Typography>
                    </Box>
                </Paper>
            </Box>

            {/* ── Add / Edit Address Dialog ── */}
            <Dialog
                open={addrDialog.open}
                onClose={() => !addrDialog.saving && setAddrDialog((s) => ({ ...s, open: false }))}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle fontWeight={700}>
                    {addrDialog.mode === 'add' ? 'Add New Address' : 'Edit Address'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Label (e.g. Home, Work)"
                                size="small" fullWidth
                                value={addrDialog.form.label}
                                onChange={(e) => setAddrField('label', e.target.value)}
                                error={!!addrDialog.errors?.label}
                                helperText={addrDialog.errors?.label}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Full Name *"
                                size="small" fullWidth required
                                value={addrDialog.form.fullName}
                                onChange={(e) => setAddrField('fullName', e.target.value)}
                                error={!!addrDialog.errors?.fullName}
                                helperText={addrDialog.errors?.fullName}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Phone"
                                size="small" fullWidth
                                value={addrDialog.form.phone}
                                onChange={(e) => setAddrField('phone', e.target.value)}
                                error={!!addrDialog.errors?.phone}
                                helperText={addrDialog.errors?.phone}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Address Line 1 *"
                                size="small" fullWidth required
                                value={addrDialog.form.addressLine1}
                                onChange={(e) => setAddrField('addressLine1', e.target.value)}
                                error={!!addrDialog.errors?.addressLine1}
                                helperText={addrDialog.errors?.addressLine1}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Address Line 2"
                                size="small" fullWidth
                                value={addrDialog.form.addressLine2}
                                onChange={(e) => setAddrField('addressLine2', e.target.value)}
                                error={!!addrDialog.errors?.addressLine2}
                                helperText={addrDialog.errors?.addressLine2}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="City *"
                                size="small" fullWidth required
                                value={addrDialog.form.city}
                                onChange={(e) => setAddrField('city', e.target.value)}
                                error={!!addrDialog.errors?.city}
                                helperText={addrDialog.errors?.city}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="State / Province"
                                size="small" fullWidth
                                value={addrDialog.form.state}
                                onChange={(e) => setAddrField('state', e.target.value)}
                                error={!!addrDialog.errors?.state}
                                helperText={addrDialog.errors?.state}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Postal Code *"
                                size="small" fullWidth required
                                value={addrDialog.form.postalCode}
                                onChange={(e) => setAddrField('postalCode', e.target.value)}
                                error={!!addrDialog.errors?.postalCode}
                                helperText={addrDialog.errors?.postalCode}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Country *"
                                size="small" fullWidth required
                                value={addrDialog.form.country}
                                onChange={(e) => setAddrField('country', e.target.value)}
                                error={!!addrDialog.errors?.country}
                                helperText={addrDialog.errors?.country}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!addrDialog.form.isDefault}
                                        onChange={(e) => setAddrField('isDefault', e.target.checked)}
                                    />
                                }
                                label="Set as default address"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => setAddrDialog((s) => ({ ...s, open: false }))}
                        disabled={addrDialog.saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleAddrSave}
                        disabled={
                            addrDialog.saving ||
                            !addrDialog.form.fullName ||
                            !addrDialog.form.addressLine1 ||
                            !addrDialog.form.city ||
                            !addrDialog.form.postalCode ||
                            !addrDialog.form.country
                        }
                    >
                        {addrDialog.saving
                            ? <CircularProgress size={20} color="inherit" />
                            : addrDialog.mode === 'add' ? 'Add Address' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default CheckoutPage;



