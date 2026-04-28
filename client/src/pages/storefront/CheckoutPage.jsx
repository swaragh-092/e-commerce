import React, { useState, useEffect, useContext } from 'react';
import {
    Box, Container, Typography, Button, Divider, Paper, TextField,
    CircularProgress, Alert, Radio, RadioGroup,
    FormControlLabel, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    Grid, IconButton, Checkbox, Collapse,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LockIcon from '@mui/icons-material/Lock';
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
import {calculateTax} from '../../../../shared/calculations.js';

const EMPTY_ADDR = {
    label: '', fullName: '', phone: '',
    addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', country: '',
    isDefault: false,
};

const normalizeBuyNowQuantity = (value) => {
    const parsedQuantity = Number(value);
    if (!Number.isFinite(parsedQuantity)) return 1;
    return Math.max(1, Math.floor(parsedQuantity));
};

const normalizeBuyNowItem = (item) => {
    if (!item?.productId) return null;
    const product = item.product && typeof item.product === 'object' ? item.product : null;
    const variant = item.variant && typeof item.variant === 'object' ? item.variant : null;
    const hasProductIdentity = Boolean(product?.id || product?.name);
    const hasPriceData = Boolean(
        product && (
            product.effectivePrice != null || product.price != null || product.salePrice != null ||
            variant?.unitPrice != null || variant?.priceModifier != null
        )
    );
    if (!hasProductIdentity || !hasPriceData) return null;
    return {
        id: item.id || `${item.productId}-${item.variantId || variant?.id || 'base'}`,
        productId: item.productId,
        variantId: item.variantId ?? variant?.id ?? null,
        quantity: normalizeBuyNowQuantity(item.quantity),
        product: { ...product, id: product.id || item.productId, name: product.name || 'Product' },
        variant: variant ? { ...variant, id: variant.id || item.variantId || null } : null,
    };
};

// Section wrapper — shows locked/completed state when not active
const Section = ({ step, activeSection, completedSections, title, icon, summary, onEdit, children }) => {
    const isActive = activeSection === step;
    const isCompleted = completedSections.includes(step);
    const isLocked = !isActive && !isCompleted;

    return (
        <Paper
            elevation={0}
            sx={{
                border: '1px solid',
                borderColor: isActive ? 'primary.main' : 'divider',
                borderRadius: 2,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
                mb: 1.5,
                opacity: isLocked ? 0.55 : 1,
            }}
        >
            {/* Header */}
            <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 3, py: 2,
                bgcolor: 'background.paper',
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {isCompleted && !isActive ? (
                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 22 }} />
                    ) : (
                        <Box sx={{
                            width: 22, height: 22, borderRadius: '50%',
                            bgcolor: isActive ? 'primary.main' : 'text.disabled',
                            color: 'background.paper', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 12, fontWeight: 700,
                        }}>
                            {step}
                        </Box>
                    )}
                    <Typography variant="subtitle1" fontWeight={isActive ? 700 : 600} color={isLocked ? 'text.disabled' : 'text.primary'}>
                        {title}
                    </Typography>
                </Box>
                {isCompleted && !isActive && onEdit && (
                    <Button size="small" variant="text" onClick={onEdit} sx={{ fontSize: 13, fontWeight: 600 }}>
                        Change
                    </Button>
                )}
            </Box>

            {/* Completed summary (collapsed) */}
            {isCompleted && !isActive && summary && (
                <Box sx={{ px: 3, pb: 2, pt: 0 }}>
                    {summary}
                </Box>
            )}

            {/* Active content */}
            <Collapse in={isActive} unmountOnExit={false}>
                <Box sx={{ px: 3, pb: 3, pt: 1 }}>
                    {children}
                </Box>
            </Collapse>
        </Paper>
    );
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

    // Sections: 1=address, 2=coupon (optional), 3=payment
    const SECTIONS = couponsEnabled ? [1, 2, 3] : [1, 3];
    const [activeSection, setActiveSection] = useState(1);
    const [completedSections, setCompletedSections] = useState([]);

    const completeSection = (section, nextSection) => {
        setCompletedSections((prev) => [...new Set([...prev, section])]);
        setActiveSection(nextSection);
    };

    const editSection = (section) => {
        setCompletedSections((prev) => prev.filter((s) => s !== section));
        setActiveSection(section);
    };

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

    // Notes & Payment
    const [notes, setNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('razorpay');

    // Address dialog
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
            if (mode === 'add') saved = await userService.createAddress(form);
            else saved = await userService.updateAddress(addrId, form);
            const list = await userService.getAddresses();
            const addrList = Array.isArray(list) ? list : list?.rows || [];
            setAddresses(addrList);
            if (mode === 'add' && saved?.id) setSelectedAddressId(saved.id);
            setAddrDialog((s) => ({ ...s, open: false }));
        } catch (err) {
            const errData = err?.response?.data?.error;
            if (errData?.code === 'VALIDATION_ERROR' && errData?.details) {
                const validationErrors = {};
                errData.details.forEach((d) => { validationErrors[d.field] = d.message; });
                setAddrDialog((s) => ({ ...s, saving: false, errors: validationErrors }));
            } else {
                setAddrDialog((s) => ({ ...s, saving: false }));
                setError(getApiErrorMessage(err, 'Failed to save address.'));
            }
        }
    };

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

    const shippingMethod = settings?.shipping?.method || 'flat_rate';
    const flatRate = parseFloat(settings?.shipping?.flatRate ?? 0);
    const freeThreshold = parseFloat(settings?.shipping?.freeThreshold ?? 0);
    let shippingCost = 0;
    if (shippingMethod === 'flat_rate') shippingCost = flatRate;
    else if (shippingMethod === 'free_above_threshold') shippingCost = subtotal >= freeThreshold ? 0 : flatRate;

    const shippingDiscount = couponResult?.shippingDiscount || (couponResult?.freeShipping ? shippingCost : 0);
    const effectiveShippingCost = Math.max(0, shippingCost - shippingDiscount);

    const enableCGST = settings?.tax?.enableCGST === true;
    const enableSGST = settings?.tax?.enableSGST === true;
    const enableIGST = settings?.tax?.enableIGST === true;
    const useGST = enableCGST || enableSGST || enableIGST;
    const taxInclusive = !useGST && settings?.tax?.inclusive === true;
    const cgstAmount = enableCGST ? subtotal * parseFloat(settings?.tax?.cgstRate ?? 0) : 0;
    const sgstAmount = enableSGST ? subtotal * parseFloat(settings?.tax?.sgstRate ?? 0) : 0;
    const igstAmount = enableIGST ? subtotal * parseFloat(settings?.tax?.igstRate ?? 0) : 0;
    const taxRate = parseFloat(settings?.tax?.rate ?? 0);
    const flatTaxAmount = (!taxInclusive && !useGST && taxRate > 0) ? calculateTax( subtotal, taxRate ) : 0;
    const taxAmount = useGST ? cgstAmount + sgstAmount + igstAmount : flatTaxAmount;
    const total = Math.max(0, subtotal + effectiveShippingCost + taxAmount - orderDiscount);

    useEffect(() => {
        userService.getAddresses()
            .then((data) => {
                const list = Array.isArray(data) ? data : data?.rows || [];
                setAddresses(list);
                const def = list.find((a) => a.isDefault);
                // Auto-select default or first address and mark section complete
                const autoSelected = def || list[0];
                if (autoSelected) {
                    setSelectedAddressId(autoSelected.id);
                    setCompletedSections([1]);
                    setActiveSection(couponsEnabled ? 2 : 3);
                }
            })
            .catch(() => {})
            .finally(() => setLoadingAddresses(false));
    }, []);

    useEffect(() => {
        if (activeSection === 2 && couponsEnabled && showAvailableCoupons) {
            setPublicCouponsLoading(true);
            getEligibleCoupons({ subtotal, shippingCost })
                .then((res) => {
                    const data = res.data?.data || {};
                    setPublicCoupons(data.eligibleCoupons || []);
                    setEligibleCouponSummary(data);
                    if (!couponResult && !couponCode && data.bestCombination?.appliedCoupons?.length) {
                        const manualCoupon = data.bestCombination.appliedCoupons.find((c) => c.applicationMode !== 'auto');
                        setCouponCode(manualCoupon?.code || data.bestCombination.appliedCoupons[0]?.code || '');
                        setCouponResult(data.bestCombination);
                    }
                })
                .catch(() => {})
                .finally(() => setPublicCouponsLoading(false));
        }
    }, [activeSection, couponsEnabled, showAvailableCoupons, subtotal, shippingCost]);

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
                paymentMethod,
                ...(couponCode && couponResult && !couponResult.error && { couponCode }),
                ...(appliedCoupons.length > 0 && { couponCodes: appliedCoupons.map((c) => c.code) }),
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
            if (!isBuyNowFlow) await clearCart();
            if (paymentMethod === 'cod') navigate('/payment/success', { state: { orderId, isCod: true } });
            else navigate(`/payment/${orderId}`);
        } catch (err) {
            setError(getApiErrorMessage(err, 'Failed to place order. Please try again.'));
            setPlacing(false);
        }
    };

    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

    if (items.length === 0) {
        return (
            <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h5">Your cart is empty</Typography>
                <Button variant="contained" href="/products" sx={{ mt: 2 }}>Browse Products</Button>
            </Container>
        );
    }

    const totalSavings = orderDiscount + shippingDiscount;

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <PageSEO title="Checkout" type="noindex" />
            <Typography variant="h4" fontWeight={700} mb={3}>Checkout</Typography>

            {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 340px' }, gap: 3, alignItems: 'start' }}>

                {/* ── Left: sections ── */}
                <Box>

                    {/* ── Section 1: Delivery Address ── */}
                    <Section
                        step={1}
                        activeSection={activeSection}
                        completedSections={completedSections}
                        title="Delivery Address"
                        onEdit={() => editSection(1)}
                        summary={
                            selectedAddress && (
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                    <LocationOnIcon sx={{ fontSize: 16, color: 'primary.main', mt: 0.2, flexShrink: 0 }} />
                                    <Box>
                                        <Typography variant="body2" fontWeight={600}>
                                            {selectedAddress.fullName}
                                            {selectedAddress.label ? ` · ${selectedAddress.label}` : ''}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {selectedAddress.addressLine1}{selectedAddress.addressLine2 ? `, ${selectedAddress.addressLine2}` : ''},{' '}
                                            {selectedAddress.city}{selectedAddress.state ? `, ${selectedAddress.state}` : ''} {selectedAddress.postalCode}, {selectedAddress.country}
                                        </Typography>
                                        {selectedAddress.phone && (
                                            <Typography variant="body2" color="text.secondary">📞 {selectedAddress.phone}</Typography>
                                        )}
                                    </Box>
                                </Box>
                            )
                        }
                    >
                        {loadingAddresses ? (
                            <CenteredLoader message="Loading addresses..." minHeight="120px" />
                        ) : (
                            <>
                                {addresses.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 3 }}>
                                        <Typography color="text.secondary" mb={2}>No saved addresses yet.</Typography>
                                        <Button variant="outlined" startIcon={<AddIcon />} onClick={openAddAddrDialog}>
                                            Add Your First Address
                                        </Button>
                                    </Box>
                                ) : (
                                    <RadioGroup value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)}>
                                        {addresses.map((addr) => (
                                            <Paper
                                                key={addr.id}
                                                variant="outlined"
                                                sx={{
                                                    p: 2, mb: 1.5, cursor: 'pointer',
                                                    borderColor: selectedAddressId === addr.id ? 'primary.main' : 'divider',
                                                    bgcolor: selectedAddressId === addr.id ? 'action.selected' : 'background.paper',
                                                    transition: 'all 0.15s',
                                                    '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                                                }}
                                                onClick={() => setSelectedAddressId(addr.id)}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                                    <Radio
                                                        value={addr.id}
                                                        checked={selectedAddressId === addr.id}
                                                        size="small"
                                                        sx={{ mt: -0.5, mr: 0.5 }}
                                                    />
                                                    <Box sx={{ flexGrow: 1 }}>
                                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                                                            <Typography variant="body2" fontWeight={700}>{addr.fullName}</Typography>
                                                            {addr.label && (
                                                                <Chip label={addr.label} size="small" sx={{ height: 20, fontSize: 11 }} />
                                                            )}
                                                            {addr.isDefault && (
                                                                <Chip label="Default" size="small" color="primary" sx={{ height: 20, fontSize: 11 }} />
                                                            )}
                                                        </Box>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''},{' '}
                                                            {addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.postalCode}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">{addr.country}</Typography>
                                                        {addr.phone && (
                                                            <Typography variant="body2" color="text.secondary" mt={0.5}>
                                                                Mobile: <strong>{addr.phone}</strong>
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditAddrDialog(addr); }}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </Paper>
                                        ))}
                                    </RadioGroup>
                                )}

                                <Button
                                    startIcon={<AddIcon />}
                                    variant="text"
                                    size="small"
                                    onClick={openAddAddrDialog}
                                    sx={{ mb: 2, fontWeight: 600 }}
                                >
                                    Add a new address
                                </Button>

                                <Box>
                                    <Button
                                        variant="contained"
                                        disabled={!selectedAddressId}
                                        onClick={() => completeSection(1, couponsEnabled ? 2 : 3)}
                                        sx={{ px: 4 }}
                                    >
                                        Deliver to this address
                                    </Button>
                                </Box>
                            </>
                        )}
                    </Section>

                    {/* ── Section 2: Coupons (optional) ── */}
                    {couponsEnabled && (
                        <Section
                            step={2}
                            activeSection={activeSection}
                            completedSections={completedSections}
                            title="Coupons & Offers"
                            onEdit={() => editSection(2)}
                            summary={
                                couponResult && !couponResult.error ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <LocalOfferIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                        <Typography variant="body2" color="success.main" fontWeight={600}>
                                            Saving {formatPrice(couponResult.totalDiscount || couponResult.orderDiscount || 0)} with {appliedCoupons.length > 1 ? `${appliedCoupons.length} offers` : (couponCode || 'coupon')}
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">No coupon applied</Typography>
                                )
                            }
                        >
                            {/* Available coupons chips */}
                            {showAvailableCoupons && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                        AVAILABLE OFFERS
                                    </Typography>
                                    {publicCouponsLoading ? (
                                        <CircularProgress size={18} />
                                    ) : publicCoupons.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {publicCoupons.map((offer) => {
                                                const c = offer.coupon || offer;
                                                const label = c.type === 'percentage'
                                                    ? `${Number(c.value)}% off`
                                                    : c.type === 'free_shipping' ? 'Free shipping'
                                                        : `${formatPrice(Number(c.value))} off`;
                                                const applied = couponCode === c.code && couponResult && !couponResult.error;
                                                return (
                                                    <Chip
                                                        key={c.code}
                                                        icon={<LocalOfferIcon />}
                                                        label={`${c.code} — ${c.name || label}`}
                                                        onClick={() => handleApplyCoupon(c.code)}
                                                        color={applied ? 'success' : 'default'}
                                                        variant={applied ? 'filled' : 'outlined'}
                                                        clickable
                                                        disabled={couponLoading}
                                                    />
                                                );
                                            })}
                                        </Box>
                                    ) : (
                                        <Typography variant="caption" color="text.secondary">No offers available right now.</Typography>
                                    )}
                                    {eligibleCouponSummary?.bestCoupon && !couponResult?.error && (
                                        <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
                                            Best offer saves {formatPrice(eligibleCouponSummary.bestCoupon.totalDiscount || 0)}
                                        </Alert>
                                    )}
                                </Box>
                            )}

                            {/* Manual entry */}
                            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                <TextField
                                    size="small"
                                    placeholder="Enter coupon code"
                                    value={couponCode}
                                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                                    sx={{ flexGrow: 1 }}
                                    InputProps={{ sx: { fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 } }}
                                />
                                <Button
                                    variant="outlined"
                                    onClick={() => handleApplyCoupon()}
                                    disabled={!couponCode || couponLoading}
                                    sx={{ minWidth: 88 }}
                                >
                                    {couponLoading ? <CircularProgress size={18} /> : 'Apply'}
                                </Button>
                            </Box>

                            {couponResult && (
                                <Alert
                                    severity={couponResult.error ? 'error' : 'success'}
                                    sx={{ mb: 1.5 }}
                                    onClose={couponResult.error ? () => setCouponResult(null) : undefined}
                                >
                                    {couponResult.message}
                                    {!couponResult.error && ` — You save ${formatPrice(couponResult.totalDiscount || couponResult.orderDiscount || 0)}`}
                                </Alert>
                            )}

                            {!couponResult?.error && appliedCoupons.length > 1 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
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

                            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                <Button variant="contained" onClick={() => completeSection(2, 3)} sx={{ px: 4 }}>
                                    Continue
                                </Button>
                                {(couponResult && !couponResult.error) && (
                                    <Button
                                        variant="text"
                                        color="error"
                                        onClick={() => { setCouponCode(''); setCouponResult(null); }}
                                    >
                                        Remove coupon
                                    </Button>
                                )}
                            </Box>
                        </Section>
                    )}

                    {/* ── Section 3: Payment ── */}
                    <Section
                        step={3}
                        activeSection={activeSection}
                        completedSections={completedSections}
                        title="Payment Method"
                        onEdit={() => editSection(3)}
                        summary={
                            <Typography variant="body2" color="text.secondary">
                                {paymentMethod === 'cod' ? '💵 Cash on Delivery' : '💳 Pay Online (Razorpay)'}
                            </Typography>
                        }
                    >
                        <RadioGroup value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                            {/* Razorpay */}
                            <Paper
                                variant="outlined"
                                onClick={() => setPaymentMethod('razorpay')}
                                sx={{
                                    p: 2, mb: 1.5, cursor: 'pointer',
                                    borderColor: paymentMethod === 'razorpay' ? 'primary.main' : 'divider',
                                    bgcolor: paymentMethod === 'razorpay' ? 'action.selected' : 'background.paper',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Radio value="razorpay" checked={paymentMethod === 'razorpay'} size="small" />
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="body2" fontWeight={700}>Pay Online</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Credit / Debit card · UPI · Netbanking · Wallets
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                        {['VISA', 'UPI', 'MC'].map((brand) => (
                                            <Chip key={brand} label={brand} size="small" sx={{ fontSize: 10, height: 20 }} variant="outlined" />
                                        ))}
                                    </Box>
                                </Box>
                            </Paper>

                            {/* COD */}
                            <Paper
                                variant="outlined"
                                onClick={() => setPaymentMethod('cod')}
                                sx={{
                                    p: 2, cursor: 'pointer',
                                    borderColor: paymentMethod === 'cod' ? 'primary.main' : 'divider',
                                    bgcolor: paymentMethod === 'cod' ? 'action.selected' : 'background.paper',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Radio value="cod" checked={paymentMethod === 'cod'} size="small" />
                                    <Box>
                                        <Typography variant="body2" fontWeight={700}>Cash on Delivery</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Pay when your order arrives at your doorstep
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </RadioGroup>

                        {/* Order notes */}
                        <TextField
                            fullWidth
                            size="small"
                            label="Order notes (optional)"
                            placeholder="Special instructions for delivery..."
                            multiline
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            sx={{ mt: 2 }}
                        />
                    </Section>

                    {/* ── Items summary (always visible at bottom of left col) ── */}
                    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mt: 1.5 }}>
                        <Typography variant="subtitle2" fontWeight={600} mb={1.5} color="text.secondary">
                            ORDER ITEMS ({items.length})
                        </Typography>
                        {items.map((item) => {
                            const itemPrice = item?.product ? getCartItemUnitPrice(item) : 0;
                            const quantity = normalizeBuyNowQuantity(item?.quantity);
                            return (
                                <Box key={item.id || `${item.productId}-${item.variantId || 'base'}`}
                                    sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'flex-start' }}>
                                    <Box sx={{ flex: 1, pr: 2 }}>
                                        <Typography variant="body2" fontWeight={500}>
                                            {item?.product?.name || 'Product'}
                                        </Typography>
                                        {item.variant && (
                                            <Typography variant="caption" color="text.secondary">
                                                {getVariantOptionLabel(item.variant)}
                                            </Typography>
                                        )}
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Qty: {quantity}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" fontWeight={600}>{formatPrice(itemPrice * quantity)}</Typography>
                                </Box>
                            );
                        })}
                    </Paper>
                </Box>

                {/* ── Right: Price breakdown + CTA ── */}
                <Box sx={{ position: 'sticky', top: 80 }}>
                    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" letterSpacing={0.5}>
                                PRICE DETAILS
                            </Typography>
                        </Box>
                        <Box sx={{ px: 2.5, py: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Price ({items.reduce((s, i) => s + normalizeBuyNowQuantity(i?.quantity), 0)} items)
                                </Typography>
                                <Typography variant="body2">{formatPrice(subtotal)}</Typography>
                            </Box>

                            {/* Shipping */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">Delivery Charges</Typography>
                                {shippingCost === 0 ? (
                                    <Typography variant="body2" color="success.main" fontWeight={600}>FREE</Typography>
                                ) : shippingDiscount > 0 ? (
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                            {formatPrice(shippingCost)}
                                        </Typography>
                                        <Typography variant="body2" color="success.main" fontWeight={600}>FREE</Typography>
                                    </Box>
                                ) : (
                                    <Typography variant="body2">{formatPrice(shippingCost)}</Typography>
                                )}
                            </Box>
                            {shippingMethod === 'free_above_threshold' && shippingCost > 0 && (
                                <Typography variant="caption" color="success.main" display="block" mb={1}>
                                    Add {formatPrice(freeThreshold - subtotal)} more for free delivery
                                </Typography>
                            )}

                            {/* GST breakdown */}
                            {enableCGST && cgstAmount > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">CGST ({(parseFloat(settings?.tax?.cgstRate ?? 0) * 100).toFixed(1)}%)</Typography>
                                    <Typography variant="body2">{formatPrice(cgstAmount)}</Typography>
                                </Box>
                            )}
                            {enableSGST && sgstAmount > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">SGST ({(parseFloat(settings?.tax?.sgstRate ?? 0) * 100).toFixed(1)}%)</Typography>
                                    <Typography variant="body2">{formatPrice(sgstAmount)}</Typography>
                                </Box>
                            )}
                            {enableIGST && igstAmount > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">IGST ({(parseFloat(settings?.tax?.igstRate ?? 0) * 100).toFixed(1)}%)</Typography>
                                    <Typography variant="body2">{formatPrice(igstAmount)}</Typography>
                                </Box>
                            )}
                            {!useGST && flatTaxAmount > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">Tax ({(taxRate).toFixed(0)}%)</Typography>
                                    <Typography variant="body2">{formatPrice(flatTaxAmount)}</Typography>
                                </Box>
                            )}
                            {taxInclusive && (
                                <Typography variant="caption" color="text.secondary" display="block" mb={1} textAlign="right">
                                    Inclusive of all taxes
                                </Typography>
                            )}

                            {/* Discount */}
                            {orderDiscount > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">Coupon Discount</Typography>
                                    <Typography variant="body2" color="success.main" fontWeight={600}>−{formatPrice(orderDiscount)}</Typography>
                                </Box>
                            )}
                            {appliedCoupons.length > 0 && appliedCoupons.map((coupon) => (
                                <Box key={coupon.code} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {coupon.code}{coupon.applicationMode === 'auto' ? ' (auto)' : ''}
                                    </Typography>
                                    <Typography variant="caption" color="success.main">
                                        −{formatPrice(coupon.totalDiscount || 0)}
                                    </Typography>
                                </Box>
                            ))}

                            <Divider sx={{ my: 1.5 }} />

                            {/* Total */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="subtitle1" fontWeight={700}>Total Amount</Typography>
                                <Typography variant="subtitle1" fontWeight={700}>{formatPrice(total)}</Typography>
                            </Box>

                            {totalSavings > 0 && (
                                <Typography variant="body2" color="success.main" fontWeight={600} sx={{ textAlign: 'right', mt: 0.5 }}>
                                    You save {formatPrice(totalSavings)} on this order 🎉
                                </Typography>
                            )}

                            <Divider sx={{ my: 1.5 }} />

                            {/* CTA */}
                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                onClick={handlePlaceOrder}
                                disabled={placing || activeSection !== 3 || !selectedAddressId}
                                sx={{
                                    py: 1.5,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    borderRadius: 2,
                                }}
                            >
                                {placing ? (
                                    <CircularProgress size={22} color="inherit" />
                                ) : paymentMethod === 'cod' ? (
                                    'Place Order'
                                ) : (
                                    'Place Order & Pay'
                                )}
                            </Button>

                            {activeSection !== 3 && (
                                <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={1}>
                                    Complete the steps above to place your order
                                </Typography>
                            )}

                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1.5 }}>
                                <LockIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                <Typography variant="caption" color="text.disabled">Safe and secure payments</Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Box>
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
                            <TextField label="Label (e.g. Home, Work)" size="small" fullWidth
                                value={addrDialog.form.label} onChange={(e) => setAddrField('label', e.target.value)}
                                error={!!addrDialog.errors?.label} helperText={addrDialog.errors?.label} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Full Name *" size="small" fullWidth required
                                value={addrDialog.form.fullName} onChange={(e) => setAddrField('fullName', e.target.value)}
                                error={!!addrDialog.errors?.fullName} helperText={addrDialog.errors?.fullName} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Phone" size="small" fullWidth
                                value={addrDialog.form.phone} onChange={(e) => setAddrField('phone', e.target.value)}
                                error={!!addrDialog.errors?.phone} helperText={addrDialog.errors?.phone} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField label="Address Line 1 *" size="small" fullWidth required
                                value={addrDialog.form.addressLine1} onChange={(e) => setAddrField('addressLine1', e.target.value)}
                                error={!!addrDialog.errors?.addressLine1} helperText={addrDialog.errors?.addressLine1} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField label="Address Line 2" size="small" fullWidth
                                value={addrDialog.form.addressLine2} onChange={(e) => setAddrField('addressLine2', e.target.value)}
                                error={!!addrDialog.errors?.addressLine2} helperText={addrDialog.errors?.addressLine2} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="City *" size="small" fullWidth required
                                value={addrDialog.form.city} onChange={(e) => setAddrField('city', e.target.value)}
                                error={!!addrDialog.errors?.city} helperText={addrDialog.errors?.city} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="State / Province" size="small" fullWidth
                                value={addrDialog.form.state} onChange={(e) => setAddrField('state', e.target.value)}
                                error={!!addrDialog.errors?.state} helperText={addrDialog.errors?.state} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Postal Code *" size="small" fullWidth required
                                value={addrDialog.form.postalCode} onChange={(e) => setAddrField('postalCode', e.target.value)}
                                error={!!addrDialog.errors?.postalCode} helperText={addrDialog.errors?.postalCode} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField label="Country *" size="small" fullWidth required
                                value={addrDialog.form.country} onChange={(e) => setAddrField('country', e.target.value)}
                                error={!!addrDialog.errors?.country} helperText={addrDialog.errors?.country} />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Checkbox checked={!!addrDialog.form.isDefault}
                                        onChange={(e) => setAddrField('isDefault', e.target.checked)} />
                                }
                                label="Set as default address"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setAddrDialog((s) => ({ ...s, open: false }))} disabled={addrDialog.saving}>
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