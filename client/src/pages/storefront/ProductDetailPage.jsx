import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
    Box, Button, Chip, CircularProgress, Container, Divider, Grid, Typography,
} from '@mui/material';
import CartIcon from '@mui/icons-material/ShoppingCart';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import { getProduct } from '../../services/productService';
import PageSEO from '../../components/common/PageSEO';
import ProductImages from '../../components/product/ProductImages';
import VariantSelector from '../../components/product/VariantSelector';
import WishlistButton from '../../components/common/WishlistButton';
import ReviewSection from '../../components/product/ReviewSection';
import DOMPurify from 'dompurify';
import { useCart } from '../../hooks/useCart';
import { useCurrency, useSettings } from '../../hooks/useSettings';
import { formatSaleDateTime, getCountdownText, getDiscountPercent, getSaleTimingMessage, getSavingsAmount, isEndingSoon } from '../../utils/pricing';
import {
    getVariantDiscountPercent,
    getVariantRegularPrice,
    getVariantSalePrice,
    getVariantSavingsAmount,
    getVariantUnitPrice,
} from '../../utils/variantPricing';
import { getVariantOptionLabel } from '../../utils/variantOptions';

const ProductDetailPage = () => {
    const { slug } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [cartMsg, setCartMsg] = useState(null);
    const { addItem } = useCart();
    const { formatPrice } = useCurrency();
    const { settings } = useSettings();
    const pp = settings?.productPage || {};
    const sales = settings?.sales || {};
    const addToCartLabel = pp.addToCartLabel || 'Add to Cart';
    const buyNowLabel = pp.buyNowLabel || 'Buy Now';
    const showBuyNowButton = pp.showBuyNowButton !== false;
    const [countdownNow, setCountdownNow] = useState(Date.now());

    useEffect(() => {
        if (sales.showCountdown === false) return undefined;
        const timer = window.setInterval(() => setCountdownNow(Date.now()), 60000);
        return () => window.clearInterval(timer);
    }, [sales.showCountdown]);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const res = await getProduct(slug);
                const nextProduct = res?.data?.product || null;
                setProduct(nextProduct);
                if (nextProduct?.variants?.length > 0) {
                    const initialVariant = nextProduct.variants.find((variant) => variant?.isActive !== false && Number(variant?.stockQty || 0) > 0)
                        || nextProduct.variants.find((variant) => variant?.isActive !== false)
                        || nextProduct.variants[0];
                    setSelectedVariant(initialVariant || null);
                } else {
                    setSelectedVariant(null);
                }
            } catch (err) {
                setError('Product not found');
            } finally {
                setLoading(false);
            }
        };
        fetchProduct();
    }, [slug]);

    const activeVariants = useMemo(
        () => (Array.isArray(product?.variants) ? product.variants.filter((variant) => variant?.isActive !== false) : []),
        [product]
    );
    const displayAttributes = useMemo(
        () => (Array.isArray(product?.attributes) ? product.attributes : []),
        [product]
    );

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
    if (error || !product) return <Typography variant="h5" color="error" textAlign="center" sx={{ mt: 10 }}>{error}</Typography>;

    const currentPrice = getVariantUnitPrice(product, selectedVariant);
    const regularPrice = getVariantRegularPrice(product, selectedVariant);
    const upcomingSalePrice = getVariantSalePrice(product, selectedVariant);
    const productHasSale = product.isSaleActive ?? (product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price));
    const isScheduledSale = product.saleStatus === 'scheduled';
    const discountPercent = selectedVariant
        ? getVariantDiscountPercent(product, selectedVariant)
        : (product.discountPercent || getDiscountPercent(product));
    const savingsAmount = selectedVariant
        ? getVariantSavingsAmount(product, selectedVariant)
        : (product.savingsAmount || getSavingsAmount(product));
    const saleTiming = sales.showSaleTiming !== false ? getSaleTimingMessage(product) : null;
    const hasSale = productHasSale && currentPrice < regularPrice;
    const countdownText = sales.showCountdown === false ? null : (isScheduledSale
        ? getCountdownText(product.saleStartAt, 'Starts in ')
        : hasSale
            ? getCountdownText(product.saleEndAt, 'Ends in ')
            : null);
    const saleLabel = (hasSale || isScheduledSale) && sales.showSaleLabel !== false ? (product.saleLabel || sales.defaultSaleLabel || null) : null;
    const showDiscountPercent = sales.showDiscountPercent !== false;
    const showSavingsAmount = sales.showSavingsAmount !== false;
    const endingSoon = hasSale && sales.showCountdown !== false && isEndingSoon(product.saleEndAt, sales.endingSoonHours);
    const stockAvailable = selectedVariant ? Number(selectedVariant.stockQty || 0) > 0 : product.quantity > 0;
    const selectedVariantLabel = selectedVariant ? getVariantOptionLabel(selectedVariant) : '';
    const displaySku = selectedVariant?.sku || product.sku;

    const addSelectedItemToCart = async (action) => {
        setPendingAction(action);
        setCartMsg(null);
        try {
            await addItem(product.id, 1, selectedVariant?.id || null);
            return true;
        } catch (err) {
            setCartMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to add to cart' });
            return false;
        } finally {
            setPendingAction(null);
        }
    };

    const handleAddToCart = async () => {
        const added = await addSelectedItemToCart('cart');
        if (added) {
            setCartMsg({ type: 'success', text: 'Added to cart!' });
        }
    };

    const handleBuyNow = async () => {
        if (!stockAvailable) {
            return;
        }

        navigate('/checkout', {
            state: {
                fromBuyNow: true,
                buyNowItem: {
                    productId: product.id,
                    variantId: selectedVariant?.id || null,
                    quantity: 1,
                    product: {
                        id: product.id,
                        name: product.name,
                        slug: product.slug,
                        price: product.price,
                        salePrice: product.salePrice,
                        effectivePrice: product.effectivePrice,
                        saleStartAt: product.saleStartAt,
                        saleEndAt: product.saleEndAt,
                        images: product.images,
                    },
                    variant: selectedVariant
                        ? {
                            ...selectedVariant,
                            unitPrice: currentPrice,
                            optionLabel: selectedVariantLabel,
                            stockQty: Number(selectedVariant.stockQty || 0),
                        }
                        : null,
                },
            },
        });
    };

    return (
        <Container maxWidth="lg" sx={{ py: 6 }}>
            <PageSEO
                title={product.name}
                description={product.shortDescription}
                image={product.images?.[0]?.url}
                type="product"
            />
            <Grid container spacing={6}>
                <Grid item xs={12} md={6}>
                    <ProductImages images={product.images} />
                </Grid>

                <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {(() => {
                            if (location.state?.fromCategory) return location.state.fromCategory;

                            const cats = product.categories;
                            if (!cats?.length) return null;
                            const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
                            const parentIds = new Set(cats.map(c => c.parentId).filter(Boolean));
                            const leaf = cats.find(c => !parentIds.has(c.id)) || cats[0];
                            const path = [];
                            let cur = leaf;
                            while (cur) {
                                path.unshift(cur.name);
                                cur = cur.parentId ? catMap[cur.parentId] : null;
                            }
                            return path.join(' > ');
                        })()}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h4" fontWeight="bold">
                            {product.name}
                        </Typography>
                        <WishlistButton productId={product.id} variantId={selectedVariant?.id || null} />
                    </Box>

                    {pp.showStockBadge !== false && (
                        <Chip
                            label={stockAvailable ? 'In Stock' : 'Out of Stock'}
                            color={stockAvailable ? 'success' : 'default'}
                            size="small"
                            sx={{ mb: 1.5 }}
                        />
                    )}
                    {pp.showSKU !== false && displaySku && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            SKU: <strong>{displaySku}</strong>
                        </Typography>
                    )}
                    {selectedVariantLabel && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Selected: <strong>{selectedVariantLabel}</strong>
                        </Typography>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        {hasSale ? (
                            <>
                                <Typography variant="h5" color="primary" fontWeight="bold">{formatPrice(currentPrice)}</Typography>
                                <Typography variant="h6" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                    {formatPrice(regularPrice)}
                                </Typography>
                            </>
                        ) : (
                            <Typography variant="h5" fontWeight="bold">{formatPrice(currentPrice)}</Typography>
                        )}
                        {hasSale && showDiscountPercent && discountPercent > 0 && <Chip label={`${discountPercent}% OFF`} color="error" />}
                        {isScheduledSale && <Chip label="Sale Starts Soon" color="warning" />}
                        {endingSoon && <Chip label="Ending Soon" color="warning" variant="outlined" />}
                    </Box>

                    {(hasSale || isScheduledSale) && (
                        <Box
                            sx={{
                                mb: 3,
                                p: 2,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: hasSale ? 'error.light' : 'warning.light',
                                bgcolor: hasSale ? 'error.50' : 'warning.50',
                            }}
                        >
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
                                {saleLabel && <Chip label={saleLabel} color={hasSale ? 'error' : 'warning'} size="small" />}
                                {showDiscountPercent && discountPercent > 0 && <Chip label={`${discountPercent}% OFF`} color={hasSale ? 'error' : 'warning'} variant="outlined" size="small" />}
                                {saleTiming && <Chip label={saleTiming} variant="outlined" size="small" />}
                                {countdownText && <Chip key={countdownNow} label={countdownText} color={hasSale ? 'error' : 'warning'} variant="filled" size="small" />}
                            </Box>

                            {hasSale && showSavingsAmount && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                    You save <strong>{formatPrice(savingsAmount)}</strong> on this product.
                                </Typography>
                            )}

                            {isScheduledSale && upcomingSalePrice !== null && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                    Upcoming sale price: <strong>{formatPrice(upcomingSalePrice)}</strong>
                                </Typography>
                            )}

                            {countdownText && (
                                <Typography variant="body2" color={hasSale ? 'error.main' : 'warning.dark'} sx={{ mb: 0.5, fontWeight: 700 }}>
                                    {countdownText}
                                </Typography>
                            )}
                            {endingSoon && (
                                <Typography variant="body2" color="warning.dark" sx={{ mb: 0.5, fontWeight: 700 }}>
                                    Hurry - this sale is inside the ending-soon window.
                                </Typography>
                            )}

                            {sales.showSaleTiming !== false && product.saleStartAt && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    Starts: {formatSaleDateTime(product.saleStartAt)}
                                </Typography>
                            )}
                            {sales.showSaleTiming !== false && product.saleEndAt && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    Ends: {formatSaleDateTime(product.saleEndAt)}
                                </Typography>
                            )}
                        </Box>
                    )}

                    <Typography variant="body1" color="text.secondary" paragraph>
                        {product.shortDescription}
                    </Typography>

                    {activeVariants.length > 0 && (
                        <VariantSelector
                            variants={activeVariants}
                            selectedVariantId={selectedVariant?.id}
                            onSelect={setSelectedVariant}
                        />
                    )}

                    <Box sx={{ mb: 4, mt: 3 }}>
                        {cartMsg && (
                            <Typography color={cartMsg.type === 'error' ? 'error' : 'success.main'} variant="body2" sx={{ mb: 1 }}>
                                {cartMsg.text}
                            </Typography>
                        )}
                        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: showBuyNowButton ? { xs: '1fr', sm: '1fr 1fr' } : '1fr' }}>
                            <Button
                                variant="contained"
                                size="large"
                                fullWidth
                                startIcon={<CartIcon />}
                                disabled={!stockAvailable || pendingAction !== null}
                                onClick={handleAddToCart}
                                sx={{ py: 1.5, fontSize: '1.1rem' }}
                            >
                                {pendingAction === 'cart' ? 'Adding...' : stockAvailable ? addToCartLabel : 'Out of Stock'}
                            </Button>
                            {showBuyNowButton && (
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    size="large"
                                    fullWidth
                                    startIcon={<FlashOnIcon />}
                                    disabled={!stockAvailable || pendingAction !== null}
                                    onClick={handleBuyNow}
                                    sx={{ py: 1.5, fontSize: '1.1rem' }}
                                >
                                    {pendingAction === 'buyNow' ? 'Redirecting...' : stockAvailable ? buyNowLabel : 'Out of Stock'}
                                </Button>
                            )}
                        </Box>
                    </Box>

                    {displayAttributes.length > 0 && (
                        <>
                            <Divider sx={{ my: 4 }} />
                            <Typography variant="h6" gutterBottom>Specifications</Typography>
                            <Box sx={{ display: 'grid', gap: 1.25 }}>
                                {displayAttributes.map((attributeRow) => {
                                    const label = attributeRow.attribute?.name || attributeRow.customName;
                                    const value = attributeRow.value?.value || attributeRow.customValue;
                                    if (!label || !value) {
                                        return null;
                                    }

                                    return (
                                        <Box
                                            key={attributeRow.id}
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' },
                                                gap: 1,
                                                py: 1,
                                                borderBottom: '1px solid',
                                                borderColor: 'divider',
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">{label}</Typography>
                                            <Typography variant="body2" fontWeight={500}>{value}</Typography>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </>
                    )}

                    <Divider sx={{ my: 4 }} />

                    <Typography variant="h6" gutterBottom>Product Details</Typography>
                    <Box dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || '') }} sx={{ typography: 'body2', color: 'text.secondary', '& p': { mt: 0, mb: 2 } }} />

                    {product.tags?.length > 0 && (
                        <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {product.tags.map(t => <Chip key={t.id} label={t.name} size="small" variant="outlined" />)}
                        </Box>
                    )}

                    <ReviewSection slug={product.slug} productId={product.id} />
                </Grid>
            </Grid>
        </Container>
    );
};

export default ProductDetailPage;
