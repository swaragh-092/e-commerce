import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
    Box, Container, Typography, Button, Divider, IconButton,
    Paper, Chip, CircularProgress, Alert, Skeleton, Tooltip,
    Fade, Collapse,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LockIcon from '@mui/icons-material/Lock';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import VerifiedIcon from '@mui/icons-material/Verified';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import CachedIcon from '@mui/icons-material/Cached';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useSettings, useCurrency, useFeatureFlag } from '../../hooks/useSettings';
import { getMediaUrl } from '../../utils/media';
import PageSEO from '../../components/common/PageSEO';
import { AuthContext } from '../../context/AuthContext';
import { getEligibleCoupons } from '../../services/adminService';
import { getCartItemUnitPrice } from '../../utils/variantPricing';
import { getVariantOptionLabel } from '../../utils/variantOptions';
import {calculateTax} from '../../../../shared/calculations.js';
import EnquiryModal from '../../components/storefront/EnquiryModal';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const row = (align = 'center', justify = 'flex-start') => ({
    display: 'flex', alignItems: align, justifyContent: justify,
});

// ── Optimistic state ──────────────────────────────────────────────────────────
const useOptimisticCart = (items, updateItem, removeItem) => {
    const [optimisticQtys, setOptimisticQtys] = useState({});
    const [removingIds, setRemovingIds] = useState(new Set());
    const [updatingIds, setUpdatingIds] = useState(new Set());
    const pendingRef = useRef({});
    const getQty = (item) => optimisticQtys[item.id] ?? item.quantity;
    const handleUpdate = useCallback(async (itemId, newQty) => {
        if (newQty < 1) return;
        setOptimisticQtys(p => ({ ...p, [itemId]: newQty }));
        setUpdatingIds(p => new Set([...p, itemId]));
        clearTimeout(pendingRef.current[itemId]);
        pendingRef.current[itemId] = setTimeout(async () => {
            try { await updateItem(itemId, newQty); }
            catch { setOptimisticQtys(p => { const n = { ...p }; delete n[itemId]; return n; }); }
            finally { setUpdatingIds(p => { const n = new Set(p); n.delete(itemId); return n; }); }
        }, 400);
    }, [updateItem]);
    const handleRemove = useCallback(async (itemId) => {
        setRemovingIds(p => new Set([...p, itemId]));
        try { await removeItem(itemId); }
        catch { setRemovingIds(p => { const n = new Set(p); n.delete(itemId); return n; }); }
    }, [removeItem]);
    return { getQty, handleUpdate, handleRemove, removingIds, updatingIds };
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
const CartSkeleton = () => (
    <Container maxWidth="lg" sx={{ py: 5 }}>
        <Skeleton width={120} height={13} sx={{ mb: 0.5 }} /><Skeleton width={240} height={40} sx={{ mb: 4 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 400px' }, gap: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[1, 2].map(i => (
                    <Paper key={i} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
                        <Skeleton variant="rectangular" width={120} height={120} sx={{ flexShrink: 0 }} />
                        <Box sx={{ flexGrow: 1, p: 2, display: 'flex', justifyContent: 'space-between' }}>
                            <Box><Skeleton width={160} height={20} /><Skeleton width={80} height={14} sx={{ mt: 1 }} /></Box>
                            <Box sx={{ textAlign: 'right' }}><Skeleton width={60} height={22} /><Skeleton width={100} height={30} sx={{ mt: 2 }} /></Box>
                        </Box>
                    </Paper>
                ))}
            </Box>
            <Skeleton variant="rounded" height={480} sx={{ borderRadius: 2 }} />
        </Box>
    </Container>
);

// ── Empty Cart ─────────────────────────────────────────────────────────────────
const EmptyCart = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 14, px: 2 }}>
        <PageSEO title="Cart" type="noindex" />
        <Box sx={{ width: 72, height: 72, borderRadius: '50%', border: '1.5px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}>
            <ShoppingBagOutlinedIcon sx={{ fontSize: 30, color: 'text.disabled' }} />
        </Box>
        <Typography variant="h6" fontWeight={700} letterSpacing={-0.4} gutterBottom>Your cart is empty</Typography>
        <Typography color="text.secondary" sx={{ fontSize: '0.85rem', mb: 4, textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>
            Haven't added anything yet. Let's fix that.
        </Typography>
        <Button variant="contained" component={Link} to="/products" size="large"
            endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: 1.5, px: 3.5, py: 1.3, fontWeight: 700, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}>
            Browse Products
        </Button>
    </Box>
);

// ── Qty Stepper ───────────────────────────────────────────────────────────────
const QttyStepper = ({ qty, isUpdating, onDecrement, onIncrement }) => (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', height: 30, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <IconButton size="small" disableRipple disabled={qty <= 1 || isUpdating} onClick={onDecrement}
            sx={{ width: 28, height: 30, borderRadius: 0, color: 'text.secondary', '&:not(.Mui-disabled):hover': { bgcolor: 'action.selected' }, '&.Mui-disabled': { opacity: 0.3 } }}>
            <RemoveIcon sx={{ fontSize: 12 }} />
        </IconButton>
        <Box sx={{ minWidth: 30, height: 30, borderLeft: '1px solid', borderRight: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper' }}>
            {isUpdating ? <CircularProgress size={10} /> : <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{qty}</Typography>}
        </Box>
        <IconButton size="small" disableRipple disabled={isUpdating} onClick={onIncrement}
            sx={{ width: 28, height: 30, borderRadius: 0, color: 'text.secondary', '&:not(.Mui-disabled):hover': { bgcolor: 'action.selected' } }}>
            <AddIcon sx={{ fontSize: 12 }} />
        </IconButton>
    </Box>
);

// ── Cart Item Card ────────────────────────────────────────────────────────────
const CartItem = React.memo(({ item, getQty, handleUpdate, handleRemove, removingIds, updatingIds, formatPrice }) => {
    const product = item.product;
    const variant = item.variant;
    const itemPrice = getCartItemUnitPrice(item);
    const imageUrl = getMediaUrl(product?.images?.[0]?.url || '') || '/placeholder.png';
    const qty = getQty(item);
    const isRemoving = removingIds.has(item.id);
    const isUpdating = updatingIds.has(item.id);
    return (
        <Collapse in={!isRemoving} timeout={280} unmountOnExit>
            <Paper elevation={0} sx={{
                display: 'flex', overflow: 'hidden',
                border: '1px solid', borderColor: 'divider', borderRadius: 2,
                transition: 'border-color 0.18s, box-shadow 0.18s',
                '&:hover': { borderColor: 'text.secondary', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
                opacity: isRemoving ? 0.4 : 1,
            }}>
                {/* Image */}
                <Box component={Link} to={`/products/${product?.slug}`}
                    sx={{ display: 'block', flexShrink: 0, width: { xs: 100, sm: 120 }, bgcolor: 'action.hover', borderRight: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                    <Box component="img" src={imageUrl} alt={product?.name}
                        sx={{ width: '100%', height: '100%', minHeight: 120, objectFit: 'cover', display: 'block', transition: 'transform 0.4s ease', '&:hover': { transform: 'scale(1.06)' } }} />
                </Box>
                {/* Body */}
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', p: { xs: 1.75, sm: 2.25 } }}>
                    {/* Top */}
                    <Box sx={{ ...row('flex-start', 'space-between'), gap: 1, mb: 1.5 }}>
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography component={Link} to={`/products/${product?.slug}`}
                                sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.4, color: 'text.primary', '&:hover': { color: 'primary.main' }, transition: 'color 0.15s' }}>
                                {product?.name}
                            </Typography>
                            {variant && (
                                <Box sx={{ display: 'inline-block', mt: 0.6, px: 1, py: 0.2, border: '1px solid', borderColor: 'divider', borderRadius: 0.75, fontSize: '0.68rem', fontWeight: 600, color: 'text.secondary' }}>
                                    {getVariantOptionLabel(variant)}
                                </Box>
                            )}
                        </Box>
                        {/* Line total */}
                        <Typography sx={{ fontSize: '1rem', fontWeight: 800, letterSpacing: -0.5, flexShrink: 0 }}>
                            {formatPrice(itemPrice * qty)}
                        </Typography>
                    </Box>
                    {/* Bottom controls */}
                    <Box sx={{ ...row('center', 'space-between') }}>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 500 }}>
                            {formatPrice(itemPrice)} / unit
                        </Typography>
                        <Box sx={{ ...row('center'), gap: 0.75 }}>
                            <QttyStepper qty={qty} isUpdating={isUpdating}
                                onDecrement={() => handleUpdate(item.id, qty - 1)}
                                onIncrement={() => handleUpdate(item.id, qty + 1)} />
                            <Tooltip title="Remove" placement="top" arrow>
                                <IconButton size="small" onClick={() => handleRemove(item.id)} disabled={isRemoving}
                                    sx={{ width: 30, height: 30, border: '1px solid', borderColor: 'divider', borderRadius: 1, color: 'text.disabled', '&:hover': { color: 'error.main', borderColor: 'error.light', bgcolor: 'error.lighter' }, transition: 'all 0.15s' }}>
                                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>
                </Box>
            </Paper>
        </Collapse>
    );
});

// ── Price Row ─────────────────────────────────────────────────────────────────
const PriceRow = ({ label, value, green, bold, icon }) => (
    <Box sx={{ ...row('center', 'space-between'), py: 0.7 }}>
        <Box sx={{ ...row('center'), gap: 0.75 }}>
            {icon && React.cloneElement(icon, { sx: { fontSize: 13, color: 'text.disabled' } })}
            <Typography sx={{ fontSize: '0.82rem', fontWeight: bold ? 700 : 400, color: bold ? 'text.primary' : 'text.secondary' }}>{label}</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: bold ? 800 : 600, color: green ? 'success.main' : 'text.primary' }}>{value}</Typography>
    </Box>
);

// ── Trust badge ───────────────────────────────────────────────────────────────
const TrustBadge = ({ icon, title, sub }) => (
    <Paper elevation={0} sx={{
        border: '1px solid', borderColor: 'divider', borderRadius: 1.75, p: 1.5,
        display: 'flex', alignItems: 'flex-start', gap: 1.25,
        transition: 'border-color 0.15s', '&:hover': { borderColor: 'text.secondary' },
    }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1, bgcolor: 'action.selected', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {React.cloneElement(icon, { sx: { fontSize: 15, color: 'text.secondary' } })}
        </Box>
        <Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.3 }}>{title}</Typography>
            <Typography sx={{ fontSize: '0.67rem', color: 'text.disabled' }}>{sub}</Typography>
        </Box>
    </Paper>
);

// ── Order Summary ─────────────────────────────────────────────────────────────
const OrderSummary = ({ visibleCount, subtotal, shippingCost, shippingMethod, freeThreshold, taxRows, taxInclusive, estimatedTotal, offerSummary, formatPrice, onCheckout, setEnquiryOpen }) => {
    const shippingFree = shippingMethod === 'free' || shippingCost === 0;
    const progressPct = freeThreshold > 0 ? Math.min((subtotal / freeThreshold) * 100, 100) : 0;
    return (
        <Box sx={{ position: { md: 'sticky' }, top: { md: 80 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

            {/* Main card */}
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>

                {/* Header stripe */}
                <Box sx={{ px: 2.5, py: 1.4, bgcolor: 'action.selected', borderBottom: '1px solid', borderColor: 'divider', ...row('center', 'space-between') }}>
                    <Typography sx={{ fontSize: '0.63rem', fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: 'text.secondary' }}>
                        Order Summary
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', fontWeight: 500 }}>
                        {visibleCount} {visibleCount === 1 ? 'item' : 'items'}
                    </Typography>
                </Box>

                <Box sx={{ px: 2.5, py: 2 }}>
                    <PriceRow label="Subtotal" value={formatPrice(subtotal)} />
                    <PriceRow label="Shipping" icon={<LocalShippingOutlinedIcon />}
                        value={shippingFree ? 'Free' : formatPrice(shippingCost)} green={shippingFree} />
                    {taxRows.map(r => <PriceRow key={r.label} label={r.label} value={r.value} />)}
                    {taxInclusive && <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.25, mb: 0.5 }}>Taxes included in price</Typography>}

                    {/* Free shipping bar */}
                    {shippingMethod === 'free_above_threshold' && shippingCost > 0 && freeThreshold > 0 && (
                        <Fade in>
                            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                                <Box sx={{ ...row('center', 'space-between'), mb: 0.9 }}>
                                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary' }}>
                                        Free shipping at {formatPrice(freeThreshold)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>{progressPct.toFixed(0)}%</Typography>
                                </Box>
                                <Box sx={{ height: 4, bgcolor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                                    <Box sx={{ height: '100%', bgcolor: 'primary.main', borderRadius: 2, width: `${progressPct}%`, transition: 'width 0.5s ease' }} />
                                </Box>
                                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.75 }}>
                                    Add <Box component="strong" sx={{ color: 'text.primary' }}>{formatPrice(freeThreshold - subtotal)}</Box> more to qualify
                                </Typography>
                            </Box>
                        </Fade>
                    )}

                    {offerSummary?.bestCoupon && (
                        <Alert icon={<LocalOfferOutlinedIcon sx={{ fontSize: 14 }} />}
                            severity={offerSummary.autoAppliedCoupon ? 'success' : 'info'}
                            sx={{ mt: 1.75, borderRadius: 1.5, fontSize: '0.75rem', py: 0.25, px: 1.25 }}>
                            <strong>{offerSummary.autoAppliedCoupon
                                ? `${offerSummary.autoAppliedCoupon.coupon.name || offerSummary.autoAppliedCoupon.coupon.code} auto-applies.`
                                : `${offerSummary.bestCoupon.coupon.name || offerSummary.bestCoupon.coupon.code} available.`}
                            </strong>
                            {` Save ${formatPrice(offerSummary.bestCoupon.totalDiscount || 0)}.`}
                        </Alert>
                    )}

                    <Box sx={{ my: 2, borderTop: '1px solid', borderColor: 'divider' }} />

                    {/* Total */}
                    <Box sx={{ ...row('flex-end', 'space-between'), mb: 0.25 }}>
                        <Box>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>Estimated Total</Typography>
                            <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>Incl. all taxes & fees</Typography>
                        </Box>
                        <Typography sx={{ fontSize: '1.55rem', fontWeight: 900, letterSpacing: -1, color: 'primary.main', lineHeight: 1.1 }}>
                            {formatPrice(estimatedTotal)}
                        </Typography>
                    </Box>

                    <Button variant="contained" fullWidth size="large" onClick={onCheckout}
                        endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                        sx={{ mt: 2, py: 1.55, borderRadius: 1.5, fontWeight: 800, fontSize: '0.88rem', letterSpacing: 0.6, boxShadow: 'none', '&:hover': { boxShadow: 'none', filter: 'brightness(1.08)' } }}>
                        Proceed to Checkout
                    </Button>
                    <Button variant="outlined" color="secondary" fullWidth size="large" onClick={() => setEnquiryOpen(true)}
                        startIcon={<HelpOutlineIcon sx={{ fontSize: 16 }} />}
                        sx={{ mt: 1, py: 1.55, borderRadius: 1.5, fontWeight: 700, fontSize: '0.88rem' }}>
                        Enquire About Cart
                    </Button>
                    <Button fullWidth component={Link} to="/products"
                        sx={{ mt: 0.75, fontSize: '0.78rem', fontWeight: 500, color: 'text.secondary', py: 0.75 }}>
                        ← Continue Shopping
                    </Button>
                </Box>

                {/* Secure strip */}
                <Box sx={{ px: 2.5, py: 1.1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', ...row('center', 'center'), gap: 0.75 }}>
                    <LockIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                    <Typography sx={{ fontSize: '0.67rem', color: 'text.disabled', fontWeight: 600, letterSpacing: 0.4 }}>
                        256-BIT SSL ENCRYPTED CHECKOUT
                    </Typography>
                </Box>
            </Paper>

            {/* Trust badges 2×2 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <TrustBadge icon={<CachedIcon />} title="Easy Returns" sub="30-day hassle-free" />
                <TrustBadge icon={<VerifiedIcon />} title="100% Authentic" sub="Guaranteed genuine" />
                <TrustBadge icon={<LocalShippingOutlinedIcon />} title="Fast Delivery" sub="Tracked & insured" />
                <TrustBadge icon={<HeadsetMicIcon />} title="24/7 Support" sub="Always here for you" />
            </Box>

            {/* Payment methods */}
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.75, px: 2, py: 1.25, ...row('center', 'space-between') }}>
                <Typography sx={{ fontSize: '0.63rem', color: 'text.disabled', fontWeight: 800, letterSpacing: 2 }}>WE ACCEPT</Typography>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                    {['VISA', 'MC', 'UPI', 'COD'].map(m => (
                        <Box key={m} sx={{ px: 0.75, py: 0.3, border: '1px solid', borderColor: 'divider', borderRadius: 0.75, bgcolor: 'action.hover', fontSize: '0.6rem', fontWeight: 800, color: 'text.secondary', letterSpacing: 0.5 }}>
                            {m}
                        </Box>
                    ))}
                </Box>
            </Paper>
        </Box>
    );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const CartPage = () => {
    const { cart, loading, updateItem, removeItem, clearCart } = useCart();
    const { formatPrice } = useCurrency();
    const { settings } = useSettings();
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [offerSummary, setOfferSummary] = useState(null);
    const [clearing, setClearing] = useState(false);
    const [enquiryOpen, setEnquiryOpen] = useState(false);


    const items = cart?.items || [];
    const { getQty, handleUpdate, handleRemove, removingIds, updatingIds } = useOptimisticCart(items, updateItem, removeItem);

    const subtotal = items.reduce((sum, item) => sum + getCartItemUnitPrice(item) * getQty(item), 0);
    const shippingMethod = settings?.shipping?.method || 'flat_rate';
    const flatRate = parseFloat(settings?.shipping?.flatRate || 0);
    const freeThreshold = parseFloat(settings?.shipping?.freeThreshold || 0);
    let shippingCost = 0;
    if (shippingMethod === 'flat_rate') shippingCost = flatRate;
    else if (shippingMethod === 'free_above_threshold') shippingCost = subtotal >= freeThreshold ? 0 : flatRate;

    const enableCGST = settings?.tax?.enableCGST === true;
    const enableSGST = settings?.tax?.enableSGST === true;
    const enableIGST = settings?.tax?.enableIGST === true;
    const useGST = enableCGST || enableSGST || enableIGST;
    const taxInclusive = !useGST && settings?.tax?.inclusive === true;
    const cgst = enableCGST ? subtotal * parseFloat(settings?.tax?.cgstRate ?? 0) : 0;
    const sgst = enableSGST ? subtotal * parseFloat(settings?.tax?.sgstRate ?? 0) : 0;
    const igst = enableIGST ? subtotal * parseFloat(settings?.tax?.igstRate ?? 0) : 0;
    const taxRate = parseInt(settings?.tax?.rate ?? 0);

  
    const flatTax = (!taxInclusive && !useGST && taxRate > 0) ? calculateTax(subtotal, taxRate) : 0;

    const taxAmount = useGST ? cgst + sgst + igst : flatTax;
    const estimatedTotal = subtotal + shippingCost + taxAmount;

    const taxRows = [
        ...(enableCGST && cgst > 0 ? [{ label: `CGST (${(parseFloat(settings?.tax?.cgstRate ?? 0) * 100).toFixed(1)}%)`, value: formatPrice(cgst) }] : []),
        ...(enableSGST && sgst > 0 ? [{ label: `SGST (${(parseFloat(settings?.tax?.sgstRate ?? 0) * 100).toFixed(1)}%)`, value: formatPrice(sgst) }] : []),
        ...(enableIGST && igst > 0 ? [{ label: `IGST (${(parseFloat(settings?.tax?.igstRate ?? 0) * 100).toFixed(1)}%)`, value: formatPrice(igst) }] : []),
        ...(!useGST && flatTax > 0 ? [{ label: `Tax (${(taxRate).toFixed(0)}%)`, value: formatPrice(flatTax) }] : []),
    ];

    const couponsEnabled = useFeatureFlag('coupons');
    const showAvailableCoupons = useFeatureFlag('showAvailableCoupons');

    useEffect(() => {
        if (!user || items.length === 0 || !couponsEnabled || !showAvailableCoupons) { setOfferSummary(null); return; }
        getEligibleCoupons({ subtotal, shippingCost })
            .then(res => setOfferSummary(res.data?.data || null))
            .catch(() => setOfferSummary(null));
    }, [user, items.length, subtotal, shippingCost, couponsEnabled, showAvailableCoupons]);

    const handleClearCart = async () => { setClearing(true); await clearCart(); setClearing(false); };

    if (loading) return <CartSkeleton />;
    if (items.length === 0) return <EmptyCart />;

    const visibleItems = items.filter(i => !removingIds.has(i.id));
    const visibleCount = visibleItems.reduce((s, i) => s + getQty(i), 0);

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
            <PageSEO title="Cart" type="noindex" />

            {/* Header */}
            <Box sx={{ mb: { xs: 3, md: 4 }, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <Box>
                    <Typography sx={{ fontSize: '0.63rem', fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: 'text.disabled', mb: 0.25, display: 'block' }}>
                        Review your order
                    </Typography>
                    <Typography variant="h4" fontWeight={800} letterSpacing={-0.8} lineHeight={1.1}>
                        Shopping Cart{' '}
                        <Box component="span" sx={{ fontSize: '0.95rem', fontWeight: 400, color: 'text.disabled', letterSpacing: 0 }}>
                            ({visibleCount})
                        </Box>
                    </Typography>
                </Box>
                <Button component={Link} to="/products" size="small"
                    sx={{ color: 'text.secondary', fontSize: '0.78rem', fontWeight: 500, display: { xs: 'none', sm: 'flex' } }}>
                    ← Continue shopping
                </Button>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 400px' }, gap: { xs: 3, md: 3.5 }, alignItems: 'start' }}>

                {/* Items */}
                <Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {items.map(item => (
                            <CartItem key={item.id} item={item} getQty={getQty}
                                handleUpdate={handleUpdate} handleRemove={handleRemove}
                                removingIds={removingIds} updatingIds={updatingIds} formatPrice={formatPrice} />
                        ))}
                    </Box>

                    {/* Clear all */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Button size="small" disabled={clearing} onClick={handleClearCart}
                            startIcon={clearing ? <CircularProgress size={10} /> : <DeleteOutlineIcon sx={{ fontSize: 13 }} />}
                            sx={{ color: 'text.disabled', fontSize: '0.72rem', fontWeight: 500, '&:hover': { color: 'error.main', bgcolor: 'transparent' }, transition: 'color 0.15s' }}>
                            {clearing ? 'Clearing…' : 'Clear all items'}
                        </Button>
                    </Box>

                    {/* Cart breakdown summary bar */}
                    {visibleItems.length >= 2 && (
                        <Fade in>
                            <Paper elevation={0} sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                                <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
                                    <Typography sx={{ fontSize: '0.63rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'text.secondary' }}>
                                        Cart Breakdown
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', px: 2, py: 1.75 }}>
                                    {[
                                        { label: 'Items', val: visibleItems.length },
                                        { label: 'Total units', val: visibleCount },
                                        { label: 'Subtotal', val: formatPrice(subtotal) },
                                    ].map(({ label, val }, i, arr) => (
                                        <Box key={label} sx={{ textAlign: i === 2 ? 'right' : i === 1 ? 'center' : 'left', borderRight: i < arr.length - 1 ? '1px solid' : 'none', borderColor: 'divider', pr: i < arr.length - 1 ? 2 : 0, pl: i > 0 ? 2 : 0 }}>
                                            <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mb: 0.25 }}>{label}</Typography>
                                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: -0.3 }}>{val}</Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Paper>
                        </Fade>
                    )}
                </Box>

                {/* Summary */}
                <OrderSummary
                    visibleCount={visibleCount} subtotal={subtotal}
                    shippingCost={shippingCost} shippingMethod={shippingMethod} freeThreshold={freeThreshold}
                    taxRows={taxRows} taxInclusive={taxInclusive}
                    estimatedTotal={estimatedTotal} offerSummary={offerSummary}
                    formatPrice={formatPrice} onCheckout={() => navigate('/checkout')}
                    setEnquiryOpen={setEnquiryOpen}
                />
            </Box>

            {clearing && (
                <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(255,255,255,0.7)', zIndex: 9999, ...row('center', 'center'), backdropFilter: 'blur(2px)' }}>
                    <CircularProgress color="inherit" />
                </Box>
            )}
            <EnquiryModal
                open={enquiryOpen}
                onClose={() => setEnquiryOpen(false)}
                cartItems={items}
            />
        </Container>
    );
};

export default CartPage;