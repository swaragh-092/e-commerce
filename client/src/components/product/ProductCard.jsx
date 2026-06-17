import React from 'react';
import { Card, CardMedia, CardContent, Typography, Box, Rating, Chip, CardActions, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { getMediaUrl } from '../../utils/media';
import { useCurrency, useSettings, useFeature, useComponentStyles } from '../../hooks/useSettings';
import { getDiscountPercent, getSaleTimingMessage, isEndingSoon } from '../../utils/pricing';
import { resolveRadius, resolveShadow } from '../../utils/styleMaps';
import WishlistButton from '../common/WishlistButton';
import ShareButton from '../common/ShareButton';
import { useCart } from '../../hooks/useCart';
import { useNotification } from '../../context/NotificationContext';


const ratioToCss = (ratio, fallback) => String(ratio || fallback).replace('/', ' / ');

const hoverSx = (effect, shadow) => {
  if (effect === 'none') return {};
  if (effect === 'fade') return { opacity: 0.92, boxShadow: resolveShadow(shadow, resolveShadow('soft')) };
  if (effect === 'zoom') return { boxShadow: resolveShadow(shadow, resolveShadow('soft')) };
  return { transform: 'translateY(-4px)', boxShadow: 'var(--store-shadow-hover, rgba(15, 23, 42, 0.13) 0px 12px 28px)' };
};

const badgePositionSx = (position = 'top-right', offset = 8) => {
  const [vertical, horizontal] = String(position).split('-');
  return {
    position: 'absolute',
    [vertical === 'bottom' ? 'bottom' : 'top']: offset,
    [horizontal === 'left' ? 'left' : 'right']: 8,
    zIndex: 1,
  };
};

const ProductCard = ({ product, fromCategory, compact = false }) => {
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const productCardStyle = useComponentStyles('productCard');
  const pricingEnabled = useFeature('pricing');
  const showPrice = useFeature('showPrice');
  const sales = settings?.sales || {};
  const cardVariant = productCardStyle.variant || 'classic';
  const effectiveCompact = compact || productCardStyle.density === 'compact' || cardVariant === 'compact';
  const showBrand = productCardStyle.showBrand !== false && !effectiveCompact;
  const showCategory = productCardStyle.showCategory !== false;
  const showRating = productCardStyle.showRating !== false && !effectiveCompact;
  const showWishlist = productCardStyle.showWishlist !== false && !effectiveCompact;
  const showShare = productCardStyle.showShare === true && !effectiveCompact;
  const showSaleCountdown = productCardStyle.showSaleCountdown !== false;
  const cardRadius = resolveRadius(productCardStyle.radius);
  const cardShadow = resolveShadow(productCardStyle.shadow, resolveShadow('soft'));
  const imageRatio = ratioToCss(productCardStyle.imageRatio, effectiveCompact ? '1/1' : '4/3');
  const titleLines = Math.max(1, Math.min(4, Number.parseInt(productCardStyle.titleLines, 10) || 2));
  const contentAlign = productCardStyle.contentAlign || 'left';
  const imageInset = productCardStyle.imagePadding === 'comfortable' ? 1.25 : productCardStyle.imagePadding === 'spacious' ? 2 : 0;
  const isMinimal = cardVariant === 'minimal';
  const isEditorial = cardVariant === 'editorial';
  const primaryImage =
    getMediaUrl(product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url || '') || '/placeholder.png';
  const displayPrice = product.effectivePrice ?? product.salePrice ?? product.price;
  const hasSale = product.isSaleActive ?? (product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price));
  const isScheduledSale = product.saleStatus === 'scheduled';
  const discountPercent = product.discountPercent || getDiscountPercent(product);
  const saleTiming = sales.showSaleTiming !== false ? getSaleTimingMessage(product) : null;
  const resolvedLabel = product.saleLabelResolved;
  const showLabelSetting = sales.showSaleLabel !== false;
  
  let saleLabelText = null;
  let saleLabelColor = 'error.main'; 
  
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

  const cartEnabled = useFeature('cart');
  const { addItem } = useCart();
  const { notify } = useNotification();

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await addItem(product.id, 1);
      notify('Product added to cart successfully!', 'success');
    } catch (err) {
      console.error('Failed to add product to cart:', err);
      notify('Failed to add product to cart.', 'error');
    }
  };

  const endingSoon = hasSale && sales.showCountdown !== false && isEndingSoon(product.saleEndAt, sales.endingSoonHours);
  const hasRating = product.avgRating != null;
  const productPath = `/products/${product.slug}`;
  const actionPlacement = productCardStyle.actionPlacement || 'footer';
  const overlayActions = actionPlacement === 'image-overlay';
  const showFooterActions = (!overlayActions && (showWishlist || showShare)) || (cartEnabled && cardVariant === 'marketplace');
  const productShareUrl = typeof window !== 'undefined' ? `${window.location.origin}${productPath}` : productPath;
  const footerIconSx = { width: 44, height: 44, bgcolor: 'action.hover' };
  const overlayIconSx = {
    width: 40,
    height: 40,
    bgcolor: 'rgba(255,255,255,0.92)',
    color: 'text.primary',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.18)',
    '&:hover': { bgcolor: '#ffffff' },
  };

  return (
    <Card
      data-component="product-card"
      data-variant={cardVariant}
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        overflow: 'hidden',
        borderRadius: cardRadius,
        border: cardVariant === 'deal' && hasSale ? '2px solid' : (isMinimal ? '1px solid' : 'none'),
        borderColor: cardVariant === 'deal' && hasSale ? 'error.main' : 'divider',
        boxShadow: cardVariant === 'deal' && hasSale ? '0 10px 30px rgba(239, 68, 68, 0.15)' : (isMinimal ? 'none' : cardShadow),
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, opacity 0.22s ease',
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': {
            transform: 'none',
          },
          '&:hover img': {
            transform: 'none',
          },
        },
        '&:hover': hoverSx(productCardStyle.hoverEffect, productCardStyle.shadow),
        '&:hover img': {
          transform: productCardStyle.hoverEffect === 'zoom' || productCardStyle.hoverEffect === 'lift' ? 'scale(1.035)' : 'none',
        },
      }}
    >
      <Box
        component={Link}
        to={productPath}
        state={fromCategory ? { fromCategory } : undefined}
        sx={{ color: 'inherit', textDecoration: 'none', display: 'flex', flexDirection: 'column', flexGrow: 1 }}
      >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: imageRatio,
          minHeight: effectiveCompact ? { xs: 118, sm: 132 } : { xs: isEditorial ? 190 : 150, sm: isEditorial ? 220 : 170 },
          p: imageInset,
          background: (theme) =>
            `linear-gradient(135deg, var(--store-color-surface, ${theme.palette.action.hover}) 0%, var(--store-color-background, ${theme.palette.background.default}) 100%)`,
        }}
      >
        {cardVariant === 'deal' && hasSale && (
          <Chip
            label="DEAL OF THE DAY"
            color="error"
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 2,
              fontWeight: 900,
              fontSize: '0.68rem',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)',
            }}
          />
        )}
        {pricingEnabled && (hasSale || isScheduledSale) && sales.showDiscountPercent !== false && productCardStyle.badgeStyle !== 'minimal' && discountPercent > 0 && (
          <Chip
            label={hasSale ? `${discountPercent}% OFF` : 'Starts Soon'}
            color={hasSale ? 'error' : 'warning'}
            size="small"
            sx={{ ...badgePositionSx(productCardStyle.badgePosition), borderRadius: productCardStyle.badgeStyle === 'corner' ? 1 : undefined }}
          />
        )}
        {pricingEnabled && showSaleCountdown && endingSoon && (
          <Chip
            label="Ending Soon"
            color="warning"
            size="small"
            sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1, fontWeight: 700 }}
          />
        )}
        {pricingEnabled && saleLabelText && (
          <Chip
            label={saleLabelText}
            size="small"
            sx={{ 
              position: 'absolute', 
              top: endingSoon ? 36 : 8, 
              left: 8, 
              zIndex: 1, 
              fontWeight: 700,
              bgcolor: saleLabelColor,
              color: '#fff',
              border: 'none',
            }}
          />
        )}
        <CardMedia
          component="img"
          image={primaryImage}
          alt={product.name}
          sx={{
            position: 'absolute',
            top: imageInset ? (theme) => theme.spacing(imageInset) : 0,
            left: imageInset ? (theme) => theme.spacing(imageInset) : 0,
            width: imageInset ? (theme) => `calc(100% - ${theme.spacing(imageInset * 2)})` : '100%',
            height: imageInset ? (theme) => `calc(100% - ${theme.spacing(imageInset * 2)})` : '100%',
            borderRadius: imageInset ? Math.max(0, cardRadius - 1) : 0,
            objectFit: productCardStyle.imageFit || 'cover',
            transition: 'transform 0.45s ease',
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
          }}
        />
        {overlayActions && (showWishlist || showShare) && (
          <Box
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
            onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
            sx={{ ...badgePositionSx(productCardStyle.wishlistPosition || 'top-right', 10), display: 'flex', gap: 0.75, zIndex: 4 }}
          >
            {showWishlist && (
              <Box sx={{ '& .MuiIconButton-root': overlayIconSx }}>
                <WishlistButton productId={product.id} />
              </Box>
            )}
            {showShare && (
              <ShareButton title={product.name} url={productShareUrl} image={primaryImage} sx={overlayIconSx} />
            )}
          </Box>
        )}
      </Box>
      <CardContent sx={{ flexGrow: 1, p: effectiveCompact ? { xs: 1, sm: 1.15 } : { xs: 1.5, sm: isEditorial ? 2 : 1.75 }, display: 'flex', flexDirection: 'column', textAlign: contentAlign, alignItems: contentAlign === 'center' ? 'center' : contentAlign === 'right' ? 'flex-end' : 'stretch' }}>
        <Box sx={{ minHeight: effectiveCompact ? 20 : 40, mb: effectiveCompact ? 0.5 : 0.75 }}>
          {showBrand && product.brand?.name && (
            <Typography variant="caption" color="primary" sx={{ display: 'block', fontWeight: 700, mb: 0.25, letterSpacing: 0.4 }}>
              {product.brand.name}
            </Typography>
          )}
          {showCategory && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {product.categories?.[0]?.name || 'Uncategorized'}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ minHeight: effectiveCompact ? 34 : 42, mb: effectiveCompact ? 0.75 : 1 }}>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              fontWeight: 800, 
              fontSize: effectiveCompact ? { xs: '0.78rem', sm: '0.84rem' } : { xs: isEditorial ? '1rem' : '0.92rem', sm: isEditorial ? '1.05rem' : '0.96rem' }, 
              color: 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: titleLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.22,
              minHeight: effectiveCompact ? 32 : 38,
            }}
          >
            {product.name}
          </Typography>
        </Box>
        {showRating && hasRating && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
            <Rating
              value={parseFloat(product.avgRating)}
              readOnly
              size="small"
              precision={0.5}
            />
            {product.reviewCount != null && (
              <Typography variant="body2" sx={{ ml: 1 }}>
                ({product.reviewCount})
              </Typography>
            )}
          </Box>
        )}
        {pricingEnabled && cardVariant === 'deal' && hasSale && (() => {
          // Resolve a real "claimed" percentage from inventory/sales data when
          // available. Falls back to a generic "Hot Deal" label when no real
          // numbers exist — never fabricate percentages from a hash of the
          // product id (see issue H2 in docs/DESIGN-SYSTEM-ISSUES.md).
          const stock = Number(product?.stock);
          const sold = Number(product?.unitsSold ?? product?.saleUnitsSold);
          const initialStock = Number(product?.initialStock ?? product?.initial_stock);
          let claimedPercent = null;
          if (Number.isFinite(stock) && Number.isFinite(initialStock) && initialStock > 0) {
            claimedPercent = Math.max(0, Math.min(100, Math.round(((initialStock - stock) / initialStock) * 100)));
          } else if (Number.isFinite(sold) && Number.isFinite(initialStock) && initialStock > 0) {
            claimedPercent = Math.max(0, Math.min(100, Math.round((sold / initialStock) * 100)));
          }
          return (
            <Box sx={{ mt: 1, mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="error.main" sx={{ fontWeight: 800 }}>
                  🔥 Limited Deal
                </Typography>
                {claimedPercent != null ? (
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} data-testid="deal-claimed-percent">
                    {claimedPercent}% Claimed
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Selling fast
                  </Typography>
                )}
              </Box>
              <Box sx={{ width: '100%', height: 6, bgcolor: 'action.hover', borderRadius: 3, overflow: 'hidden' }}>
                {claimedPercent != null ? (
                  <Box sx={{ width: `${claimedPercent}%`, height: '100%', bgcolor: 'error.main', borderRadius: 3 }} />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', bgcolor: 'error.light', borderRadius: 3, opacity: 0.4 }} />
                )}
              </Box>
            </Box>
          );
        })()}
        <Box sx={{ flexGrow: 1 }} />
        {showPrice && (
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: contentAlign === 'center' ? 'center' : contentAlign === 'right' ? 'flex-end' : 'flex-start', gap: 0.75, mt: 'auto', flexWrap: 'wrap', width: '100%' }}>
            {hasSale ? (
              <>
                <Typography variant={effectiveCompact ? 'body2' : 'subtitle1'} color="primary" sx={{ fontWeight: productCardStyle.priceStyle === 'regular' ? 700 : 900, lineHeight: 1.2 }}>
                  {formatPrice(displayPrice)}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textDecoration: 'line-through' }}
                >
                  {formatPrice(product.price)}
                </Typography>
              </>
            ) : (
              <Typography variant={effectiveCompact ? 'body2' : 'subtitle1'} sx={{ fontWeight: productCardStyle.priceStyle === 'regular' ? 700 : 900, lineHeight: 1.2 }}>{formatPrice(displayPrice)}</Typography>
            )}
          </Box>
        )}
        {!effectiveCompact && showSaleCountdown && saleTiming && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {saleTiming}
            </Typography>
          </Box>
        )}
      </CardContent>
      </Box>
      <CardActions sx={{ display: showFooterActions ? 'flex' : 'none', px: { xs: 1.25, sm: 1.5 }, pb: 1.25, pt: 0, gap: 1, width: '100%', boxSizing: 'border-box' }}>
        {!overlayActions && showWishlist && (
          <Box sx={{ '& .MuiIconButton-root': footerIconSx }}>
            <WishlistButton productId={product.id} />
          </Box>
        )}
        {!overlayActions && showShare && (
          <ShareButton title={product.name} url={productShareUrl} image={primaryImage} sx={footerIconSx} />
        )}
        {cartEnabled && cardVariant === 'marketplace' && (
          <Button
            variant="contained"
            size="small"
            onClick={handleAddToCart}
            sx={{ flexGrow: 1, height: 44, borderRadius: 'var(--store-radius-button, 8px)', fontWeight: 700 }}
          >
            Add to Cart
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

export default ProductCard;
