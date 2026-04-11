import React, { useContext, useEffect, useState } from 'react';
import {
    Box, Container, Typography, Button, Divider, IconButton,
    TextField, Paper, Chip, CircularProgress, Alert,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useSettings } from '../../hooks/useSettings';
import { getMediaUrl } from '../../utils/media';
import { useCurrency } from '../../hooks/useSettings';
import PageSEO from '../../components/common/PageSEO';
import { AuthContext } from '../../context/AuthContext';
import { getEligibleCoupons } from '../../services/adminService';
import { getCartItemUnitPrice } from '../../utils/variantPricing';

const CartPage = () => {
    const { cart, cartCount, loading, updateItem, removeItem, clearCart } = useCart();
    const { formatPrice } = useCurrency();
    const { settings } = useSettings();
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [offerSummary, setOfferSummary] = useState(null);

    const items = cart?.items || [];
    const subtotal = items.reduce((sum, item) => {
        return sum + getCartItemUnitPrice(item) * item.quantity;
    }, 0);

    // Calculate shipping from settings (mirrors server logic)
    const shippingMethod = settings?.shipping?.method || 'flat_rate';
    const flatRate = parseFloat(settings?.shipping?.flatRate || 0);
    const freeThreshold = parseFloat(settings?.shipping?.freeThreshold || 0);
    let shippingCost = 0;
    if (shippingMethod === 'flat_rate') {
        shippingCost = flatRate;
    } else if (shippingMethod === 'free_above_threshold') {
        shippingCost = subtotal >= freeThreshold ? 0 : flatRate;
    }

    // Calculate tax from settings (supports CGST / SGST / IGST breakdown)
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

    const estimatedTotal = subtotal + shippingCost + taxAmount;

    useEffect(() => {
        if (!user || items.length === 0 || settings?.features?.coupons === false || settings?.features?.showAvailableCoupons === false) {
            setOfferSummary(null);
            return;
        }

        getEligibleCoupons({ subtotal, shippingCost })
            .then((res) => setOfferSummary(res.data?.data || null))
            .catch(() => setOfferSummary(null));
    }, [user, items.length, subtotal, shippingCost, settings?.features?.coupons, settings?.features?.showAvailableCoupons]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (items.length === 0) {
        return (
            <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
                <PageSEO title="Cart" type="noindex" />
                <ShoppingBagIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h5" gutterBottom>Your cart is empty</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    Looks like you haven't added anything yet.
                </Typography>
                <Button variant="contained" component={Link} to="/products">
                    Browse Products
                </Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <PageSEO title="Cart" type="noindex" />
            <Typography variant="h4" fontWeight={700} mb={3}>Shopping Cart ({cartCount})</Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 340px' }, gap: 3 }}>
                {/* Items list */}
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    {items.map((item, idx) => {
                        const product = item.product;
                        const variant = item.variant;
                        const itemPrice = getCartItemUnitPrice(item);
                        const imageUrl = getMediaUrl(product?.images?.[0]?.url || '') || '/placeholder.png';

                        return (
                            <React.Fragment key={item.id}>
                                {idx > 0 && <Divider />}
                                <Box sx={{ display: 'flex', gap: 2, p: 2, alignItems: 'center' }}>
                                    <Box
                                        component="img"
                                        src={imageUrl}
                                        alt={product?.name}
                                        sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
                                    />
                                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                        <Typography
                                            variant="body1"
                                            fontWeight={600}
                                            component={Link}
                                            to={`/products/${product?.slug}`}
                                            sx={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                                            noWrap
                                        >
                                            {product?.name}
                                        </Typography>
                                        {variant && (
                                            <Chip label={`${variant.name}: ${variant.value}`} size="small" sx={{ mt: 0.5 }} />
                                        )}
                                        <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ mt: 0.5 }}>
                                            {formatPrice(itemPrice)}
                                        </Typography>
                                    </Box>

                                    {/* Quantity controls */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => updateItem(item.id, item.quantity - 1)}
                                            disabled={item.quantity <= 1}
                                        >
                                            <RemoveIcon fontSize="small" />
                                        </IconButton>
                                        <Typography sx={{ minWidth: 28, textAlign: 'center' }}>{item.quantity}</Typography>
                                        <IconButton
                                            size="small"
                                            onClick={() => updateItem(item.id, item.quantity + 1)}
                                        >
                                            <AddIcon fontSize="small" />
                                        </IconButton>
                                    </Box>

                                    {/* Line total */}
                                    <Typography variant="body1" fontWeight={700} sx={{ minWidth: 70, textAlign: 'right', flexShrink: 0 }}>
                                        {formatPrice(itemPrice * item.quantity)}
                                    </Typography>

                                    {/* Remove */}
                                    <IconButton size="small" color="error" onClick={() => removeItem(item.id)}>
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </React.Fragment>
                        );
                    })}

                    <Divider />
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button size="small" color="error" onClick={clearCart}>Clear Cart</Button>
                    </Box>
                </Paper>

                {/* Order summary */}
                <Box>
                    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, position: 'sticky', top: 80 }}>
                        <Typography variant="h6" fontWeight={700} mb={2}>Order Summary</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography color="text.secondary">Subtotal ({cartCount} items)</Typography>
                            <Typography fontWeight={600}>{formatPrice(subtotal)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LocalShippingIcon fontSize="small" color="action" />
                                <Typography color="text.secondary">Shipping</Typography>
                            </Box>
                            {shippingMethod === 'free' || shippingCost === 0 ? (
                                <Typography color="success.main" fontWeight={600}>Free</Typography>
                            ) : (
                                <Typography fontWeight={600}>{formatPrice(shippingCost)}</Typography>
                            )}
                        </Box>
                        {shippingMethod === 'free_above_threshold' && shippingCost > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, pl: 3 }}>
                                Add {formatPrice(freeThreshold - subtotal)} more for free shipping
                            </Typography>
                        )}
                        {/* GST breakdown */}
                        {enableCGST && cgstAmount > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography color="text.secondary" variant="body2">CGST ({(parseFloat(settings?.tax?.cgstRate ?? 0) * 100).toFixed(1)}%)</Typography>
                                <Typography fontWeight={600} variant="body2">{formatPrice(cgstAmount)}</Typography>
                            </Box>
                        )}
                        {enableSGST && sgstAmount > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography color="text.secondary" variant="body2">SGST ({(parseFloat(settings?.tax?.sgstRate ?? 0) * 100).toFixed(1)}%)</Typography>
                                <Typography fontWeight={600} variant="body2">{formatPrice(sgstAmount)}</Typography>
                            </Box>
                        )}
                        {enableIGST && igstAmount > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography color="text.secondary" variant="body2">IGST ({(parseFloat(settings?.tax?.igstRate ?? 0) * 100).toFixed(1)}%)</Typography>
                                <Typography fontWeight={600} variant="body2">{formatPrice(igstAmount)}</Typography>
                            </Box>
                        )}
                        {/* fallback flat tax */}
                        {!useGST && flatTaxAmount > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography color="text.secondary" variant="body2">Tax ({(taxRate * 100).toFixed(0)}%)</Typography>
                                <Typography fontWeight={600} variant="body2">{formatPrice(flatTaxAmount)}</Typography>
                            </Box>
                        )}
                        {/* inclusive note */}
                        {taxInclusive && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                Tax included in price
                            </Typography>
                        )}
                        {offerSummary?.bestCoupon && (
                            <Alert severity={offerSummary.autoAppliedCoupon ? 'success' : 'info'} sx={{ my: 2 }}>
                                {offerSummary.autoAppliedCoupon
                                    ? `${offerSummary.autoAppliedCoupon.coupon.name || offerSummary.autoAppliedCoupon.coupon.code} will auto-apply at checkout.`
                                    : `${offerSummary.bestCoupon.coupon.name || offerSummary.bestCoupon.coupon.code} is available at checkout.`}
                                {` Save ${formatPrice(offerSummary.bestCoupon.totalDiscount || 0)}.`}
                            </Alert>
                        )}
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6" fontWeight={700}>Total</Typography>
                            <Typography variant="h6" fontWeight={700} color="primary.main">{formatPrice(estimatedTotal)}</Typography>
                        </Box>
                        <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            onClick={() => navigate('/checkout')}
                            sx={{ py: 1.5 }}
                        >
                            Proceed to Checkout
                        </Button>
                        <Button
                            fullWidth
                            component={Link}
                            to="/products"
                            sx={{ mt: 1 }}
                        >
                            Continue Shopping
                        </Button>
                    </Paper>
                </Box>
            </Box>
        </Container>
    );
};

export default CartPage;
