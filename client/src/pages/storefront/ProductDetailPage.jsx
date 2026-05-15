import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
    Box, Button, Chip, CircularProgress, Container, Divider, Grid, IconButton, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CartIcon from '@mui/icons-material/ShoppingCart';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { getProduct } from '../../services/productService';
import PageSEO from '../../components/common/PageSEO';
import ProductImages from '../../components/product/ProductImages';
import VariantSelector from '../../components/product/VariantSelector';
import WishlistButton from '../../components/common/WishlistButton';
import ShareButton from '../../components/common/ShareButton';
import ReviewSection from '../../components/product/ReviewSection';
import DOMPurify from 'dompurify';
import { useCart } from '../../hooks/useCart';
import { useCurrency, useSettings, useFeature } from '../../hooks/useSettings';
import { formatSaleDateTime, getCountdownText, getDiscountPercent, getSaleTimingMessage, getSavingsAmount, isEndingSoon } from '../../utils/pricing';
import {
    getVariantDiscountPercent,
    getVariantRegularPrice,
    getVariantSalePrice,
    getVariantSavingsAmount,
    getVariantUnitPrice,
} from '../../utils/variantPricing';
import { getVariantOptionLabel } from '../../utils/variantOptions';
import { formatAttributeValue } from '../../utils/attributePresentation';
import EnquiryModal from '../../components/storefront/EnquiryModal';
import RelatedProducts from '../../components/product/RelatedProducts';
import ProductTabsAccordion from '../../components/storefront/ProductTabsAccordion';

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
    const [qty, setQty] = useState(1);
    const [enquiryOpen, setEnquiryOpen] = useState(false);
    const { addItem } = useCart();
    const { formatPrice } = useCurrency();
    const { settings } = useSettings();
    const cartEnabled    = useFeature('cart');
    const pricingEnabled = useFeature('pricing');
    const showPrice = useFeature('showPrice');
    const wishlistEnabled = useFeature('wishlist');
    const enquiryEnabled = useFeature('enquiry');
    const pp = settings?.productPage || {};
    const sales = settings?.sales || {};
    const addToCartLabel = pp.addToCartLabel || 'Add to Cart';
    const buyNowLabel = pp.buyNowLabel || 'Buy Now';
    const showBuyNowButton = pp.showBuyNowButton !== false;
    const imageAlignment = pp.imageAlignment === 'vertical' ? 'vertical' : 'horizontal';
    const [countdownNow, setCountdownNow] = useState(Date.now());

    useEffect(() => {
        setQty(1);
    }, [selectedVariant]);

    useEffect(() => {
        if (sales.showCountdown === false) return undefined;
        const timer = window.setInterval(() => setCountdownNow(Date.now()), 60000);
        return () => window.clearInterval(timer);
    }, [sales.showCountdown]);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const res = await getProduct(slug);
                const nextProduct = res?.data?.product || res?.data || null;
                if (!nextProduct) {
                    setError('Product not found');
                }
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
    const displayAttributes = useMemo(() => {
        if (!Array.isArray(product?.attributes)) return [];

        const groups = {};
        product.attributes.forEach((attr) => {
            const label = attr.attribute?.name || attr.customName;
            const value = attr.value
                ? formatAttributeValue(attr.value, attr.attribute)
                : attr.customValue;
            if (!label || !value) return;

            if (!groups[label]) {
                groups[label] = {
                    id: attr.id,
                    displayLabel: label,
                    values: new Set(),
                };
            }
            groups[label].values.add(value);
        });

        const selectedOptionsByLabel = {};
        if (selectedVariant?.options) {
            selectedVariant.options.forEach((opt) => {
                const optLabel = opt?.attribute?.name;
                const optValue = opt?.value?.value;
                if (optLabel && optValue) {
                    selectedOptionsByLabel[optLabel] = optValue;
                }
            });
        }

        return Object.values(groups).map((group) => {
            if (selectedOptionsByLabel[group.displayLabel]) {
                return {
                    id: group.id,
                    displayLabel: group.displayLabel,
                    displayValue: selectedOptionsByLabel[group.displayLabel],
                };
            }

            return {
                id: group.id,
                displayLabel: group.displayLabel,
                displayValue: Array.from(group.values).join(', '),
            };
        });
    }, [product, selectedVariant]);

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
    const resolvedLabel = product.saleLabelResolved;
    const showLabelSetting = sales.showSaleLabel !== false;
    let saleLabelText = null;
    let saleLabelColor = hasSale ? 'error' : 'warning';

    if ((hasSale || isScheduledSale) && showLabelSetting) {
        if (resolvedLabel && resolvedLabel.name) {
            saleLabelText = resolvedLabel.name;
            if (resolvedLabel.color) {
                saleLabelColor = resolvedLabel.color;
            }
        } else if (product.saleLabel) {
            saleLabelText = product.saleLabel;
        } else if (sales.defaultSaleLabel) {
            saleLabelText = sales.defaultSaleLabel;
        }
    }

    const countdownText = sales.showCountdown === false ? null : (isScheduledSale
        ? getCountdownText(product.saleStartAt, 'Starts in ')
        : hasSale
            ? getCountdownText(product.saleEndAt, 'Ends in ')
            : null);

    const showDiscountPercent = sales.showDiscountPercent !== false;
    const showSavingsAmount = sales.showSavingsAmount !== false;
    const endingSoon = hasSale && sales.showCountdown !== false && isEndingSoon(product.saleEndAt, sales.endingSoonHours);
    const maxStock = selectedVariant ? Number(selectedVariant.stockQty || 0) : Number(product.quantity || 0);
    const stockAvailable = maxStock > 0;
    const selectedVariantLabel = selectedVariant ? getVariantOptionLabel(selectedVariant) : '';
    const displaySku = selectedVariant?.sku || product.sku;

    const addSelectedItemToCart = async (action) => {
        setPendingAction(action);
        setCartMsg(null);
        try {
            await addItem(product.id, Math.min(qty, maxStock), selectedVariant?.id || null);
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
                    quantity: Math.min(qty, maxStock),
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
        <Container
            maxWidth={false}
            sx={{
                maxWidth: { xs: '100%', lg: 1520 },
                mx: 'auto',
                px: { xs: 2, sm: 3, lg: 5 },
                py: { xs: 3, md: 5 },
            }}
        >
            <PageSEO
                title={product.name}
                description={product.shortDescription}
                image={product.ogImage || product.images?.[0]?.url}
                type="product"
            />
            <Grid container spacing={{ xs: 3, md: 4, lg: 5 }} alignItems="flex-start">
                <Grid item xs={12} md={5}>
                    <Box sx={{ position: { md: 'sticky' }, top: { md: 96 } }}>
                        <ProductImages
                            images={product.images}
                            variantImages={selectedVariant?.images || []}
                            selectedVariantId={selectedVariant?.id}
                            thumbnailAlignment={imageAlignment}
                        />
                    </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Box
                        sx={{
                            p: { xs: 2, sm: 0 },
                        }}
                    >
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}
                    >
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

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
                        <Typography variant="h2" fontWeight={900} sx={{ fontSize: { xs: '2.1rem', md: '2.6rem', lg: '3rem' }, lineHeight: 1.04 }}>
                            {product.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            {wishlistEnabled && (
                                <WishlistButton productId={product.id} variantId={selectedVariant?.id || null} />
                            )}
                            <ShareButton 
                                title={product.name}
                                text={product.shortDescription}
                                url={window.location.href}
                                image={product.ogImage || product.images?.[0]?.url}
                            />
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2.5 }}>
                        {pp.showStockBadge !== false && (
                            <Chip
                                label={stockAvailable ? 'In Stock' : 'Out of Stock'}
                                color={stockAvailable ? 'success' : 'default'}
                                size="small"
                                sx={{ fontWeight: 800 }}
                            />
                        )}
                        {pp.showSKU !== false && displaySku && (
                            <Chip label={`SKU: ${displaySku}`} size="small" variant="outlined" />
                        )}
                        {selectedVariantLabel && (
                            <Chip label={`Selected: ${selectedVariantLabel}`} size="small" variant="outlined" />
                        )}
                    </Box>

                    {showPrice && (
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
                            {hasSale ? (
                                <>
                                    <Typography variant="h3" color="primary" fontWeight={900} sx={{ fontSize: { xs: '2rem', lg: '2.4rem' } }}>{formatPrice(currentPrice)}</Typography>
                                    <Typography variant="h6" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                        {formatPrice(regularPrice)}
                                    </Typography>
                                </>
                            ) : (
                                <Typography variant="h3" fontWeight={900} sx={{ fontSize: { xs: '2rem', lg: '2.4rem' } }}>{formatPrice(currentPrice)}</Typography>
                            )}
                            {pricingEnabled && hasSale && showDiscountPercent && discountPercent > 0 && <Chip label={`${discountPercent}% OFF`} color="error" />}
                            {pricingEnabled && isScheduledSale && <Chip label="Sale Starts Soon" color="warning" />}
                            {pricingEnabled && endingSoon && <Chip label="Ending Soon" color="warning" variant="outlined" />}
                        </Box>
                    )}

                    {pricingEnabled && (hasSale || isScheduledSale) && (
                        <Box
                            sx={{
                                mb: 3,
                                p: 2,
                                borderRadius: 2.5,
                                border: '1px solid',
                                borderColor: hasSale ? 'error.light' : 'warning.light',
                                bgcolor: hasSale ? 'error.50' : 'warning.50',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                            }}
                        >
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
                                {saleLabelText && (
                                    <Chip 
                                        label={saleLabelText} 
                                        sx={{ 
                                            bgcolor: saleLabelColor.startsWith('#') ? saleLabelColor : undefined,
                                            color: saleLabelColor.startsWith('#') ? '#fff' : undefined,
                                            fontWeight: 700
                                        }}
                                        color={!saleLabelColor.startsWith('#') ? saleLabelColor : undefined}
                                        size="small" 
                                    />
                                )}
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

                    <Typography variant="body1" color="text.secondary" paragraph sx={{ lineHeight: 1.75, mb: 3 }}>
                        {product.shortDescription}
                    </Typography>

                    {activeVariants.length > 0 && (
                        <VariantSelector
                            variants={activeVariants}
                            selectedVariantId={selectedVariant?.id}
                            onSelect={setSelectedVariant}
                        />
                    )}

                    <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 4, mt: 3 }}>
                        {cartMsg && (
                            <Typography color={cartMsg.type === 'error' ? 'error' : 'success.main'} variant="body2" sx={{ mb: 1 }}>
                                {cartMsg.text}
                            </Typography>
                        )}
                        {cartEnabled && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1.5,
                                    p: 2,
                                    borderRadius: 2.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'action.hover',
                                }}
                            >
                                {/* Quantity stepper — only show when in stock */}
                                {stockAvailable && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>Qty:</Typography>
                                        <Box
                                            sx={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 2,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <IconButton
                                                size="small"
                                                onClick={() => setQty((q) => Math.max(1, q - 1))}
                                                disabled={qty <= 1 || pendingAction !== null}
                                                sx={{ borderRadius: 0, px: 1.5, py: 0.75 }}
                                                aria-label="Decrease quantity"
                                            >
                                                <RemoveIcon fontSize="small" />
                                            </IconButton>
                                            <Typography
                                                variant="body1"
                                                fontWeight={600}
                                                sx={{ px: 2.5, minWidth: 40, textAlign: 'center', userSelect: 'none' }}
                                            >
                                                {qty}
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                onClick={() => setQty((q) => Math.min(q + 1, maxStock))}
                                                disabled={pendingAction !== null || qty >= maxStock}
                                                sx={{ borderRadius: 0, px: 1.5, py: 0.75 }}
                                                aria-label="Increase quantity"
                                            >
                                                <AddIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </Box>
                                )}

                                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: showBuyNowButton ? { xs: '1fr', sm: '1fr 1fr' } : '1fr' }}>
                                    <Button
                                        variant="contained"
                                        size="large"
                                        fullWidth
                                        startIcon={<CartIcon />}
                                        disabled={!stockAvailable || pendingAction !== null}
                                        onClick={handleAddToCart}
                                        sx={{ py: 1.55, fontSize: '1.05rem', borderRadius: 2, fontWeight: 900 }}
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
                                            sx={{ py: 1.55, fontSize: '1.05rem', borderRadius: 2, fontWeight: 900 }}
                                        >
                                            {pendingAction === 'buyNow' ? 'Redirecting...' : stockAvailable ? buyNowLabel : 'Out of Stock'}
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                        )}
                        {enquiryEnabled && (
                            <Button
                                variant="outlined"
                                color="secondary"
                                fullWidth
                                startIcon={<HelpOutlineIcon />}
                                onClick={() => setEnquiryOpen(true)}
                                sx={{ py: 1.5, fontSize: '1.1rem', mt: cartEnabled ? 1.5 : 0 }}
                            >
                                Enquire Now
                            </Button>
                        )}
                    </Box>

                    {displayAttributes.length > 0 && (
                        <>
                            <Typography variant="h6" fontWeight={900} gutterBottom>Specifications</Typography>
                            <Box sx={{ display: 'grid', gap: 1.25 }}>
                                {displayAttributes.map((attributeRow) => {
                                    const label = attributeRow.displayLabel;
                                    const value = attributeRow.displayValue;
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


                    {product.description && (
                        <>
                            <Typography variant="h6" fontWeight={900} sx={{ mt: 4 }} gutterBottom>Product Details</Typography>
                            <Box dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || '') }} sx={{ typography: 'body2', color: 'text.secondary', '& p': { mt: 0, mb: 2 } }} />
                        </>
                    )}

                    {/* Custom tabs accordion — rendered from product.tabs included in the API response */}
                    {Array.isArray(product.tabs) && product.tabs.length > 0 && (
                        <ProductTabsAccordion
                            productId={product.id}
                            tabs={product.tabs}
                        />
                    )}

                    {product.tags?.length > 0 && (
                        <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {product.tags.map(t => <Chip key={t.id} label={t.name} size="small" variant="outlined" />)}
                        </Box>
                    )}

                    <ReviewSection slug={product.slug} productId={product.id} />
                    </Box>
                </Grid>

                <Grid item xs={12} md={3} sx={{ display: { xs: 'none', md: 'block' } }}>
                    <Box
                        sx={{
                            position: 'sticky',
                            top: 96,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            boxShadow: '0 14px 40px rgba(15, 23, 42, 0.10)',
                            p: 2.25,
                        }}
                    >
                        {showPrice && (
                            <Box sx={{ mb: 2 }}>
                                {hasSale ? (
                                    <>
                                        <Typography variant="body2" color="error.main" fontWeight={800}>
                                            -{discountPercent}% deal
                                        </Typography>
                                        <Typography variant="h4" fontWeight={900} sx={{ lineHeight: 1.15 }}>
                                            {formatPrice(currentPrice)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                            M.R.P. {formatPrice(regularPrice)}
                                        </Typography>
                                    </>
                                ) : (
                                    <Typography variant="h4" fontWeight={900}>{formatPrice(currentPrice)}</Typography>
                                )}
                            </Box>
                        )}

                        <Divider sx={{ my: 1.5 }} />

                        <Typography variant="body2" color="success.main" fontWeight={900} sx={{ mb: 0.75 }}>
                            {stockAvailable ? 'In stock' : 'Currently unavailable'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Ships from <strong>My Store</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Sold by <strong>My Store</strong>
                        </Typography>

                        {cartMsg && (
                            <Typography color={cartMsg.type === 'error' ? 'error' : 'success.main'} variant="body2" sx={{ mb: 1.5 }}>
                                {cartMsg.text}
                            </Typography>
                        )}

                        {cartEnabled && stockAvailable && (
                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                    Quantity
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        width: '100%',
                                        justifyContent: 'space-between',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 999,
                                        overflow: 'hidden',
                                        bgcolor: 'action.hover',
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                                        disabled={qty <= 1 || pendingAction !== null}
                                        aria-label="Decrease quantity"
                                    >
                                        <RemoveIcon fontSize="small" />
                                    </IconButton>
                                    <Typography variant="body1" fontWeight={800}>{qty}</Typography>
                                    <IconButton
                                        size="small"
                                        onClick={() => setQty((q) => Math.min(q + 1, maxStock))}
                                        disabled={pendingAction !== null || qty >= maxStock}
                                        aria-label="Increase quantity"
                                    >
                                        <AddIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Box>
                        )}

                        {cartEnabled && (
                            <Box sx={{ display: 'grid', gap: 1.25 }}>
                                <Button
                                    variant="contained"
                                    fullWidth
                                    startIcon={<CartIcon />}
                                    disabled={!stockAvailable || pendingAction !== null}
                                    onClick={handleAddToCart}
                                    sx={{ py: 1.25, borderRadius: 999, fontWeight: 900 }}
                                >
                                    {pendingAction === 'cart' ? 'Adding...' : stockAvailable ? addToCartLabel : 'Out of Stock'}
                                </Button>
                                {showBuyNowButton && (
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        fullWidth
                                        startIcon={<FlashOnIcon />}
                                        disabled={!stockAvailable || pendingAction !== null}
                                        onClick={handleBuyNow}
                                        sx={{ py: 1.25, borderRadius: 999, fontWeight: 900 }}
                                    >
                                        {pendingAction === 'buyNow' ? 'Redirecting...' : stockAvailable ? buyNowLabel : 'Out of Stock'}
                                    </Button>
                                )}
                            </Box>
                        )}

                        {enquiryEnabled && (
                            <Button
                                variant="outlined"
                                color="secondary"
                                fullWidth
                                startIcon={<HelpOutlineIcon />}
                                onClick={() => setEnquiryOpen(true)}
                                sx={{ py: 1.15, borderRadius: 999, fontWeight: 800, mt: cartEnabled ? 1.25 : 0 }}
                            >
                                Enquire Now
                            </Button>
                        )}

                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'grid', gap: 1 }}>
                            {[
                                ['Delivery', 'Fast dispatch after confirmation'],
                                ['Payment', 'Secure transaction'],
                                ['Support', 'Order updates available'],
                            ].map(([label, value]) => (
                                <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '82px 1fr', gap: 1 }}>
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                    <Typography variant="caption" fontWeight={700}>{value}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Grid>
            </Grid>

            <RelatedProducts productId={product.id} />

            <EnquiryModal
                open={enquiryOpen}
                onClose={() => setEnquiryOpen(false)}
                product={{ ...product, selectedVariant }}
            />
        </Container>
    );
};

export default ProductDetailPage;
