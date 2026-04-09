import React from 'react';
import { Card, CardMedia, CardContent, Typography, Box, Rating, Chip } from '@mui/material';
import { Link } from 'react-router-dom';
import { getMediaUrl } from '../../utils/media';
import { useCurrency, useSettings } from '../../hooks/useSettings';
import { getDiscountPercent, getSaleTimingMessage, isEndingSoon } from '../../utils/pricing';

const ProductCard = ({ product, fromCategory }) => {
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const sales = settings?.sales || {};
  const primaryImage =
    getMediaUrl(product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url || '') || '/placeholder.png';
  const displayPrice = product.effectivePrice ?? product.salePrice ?? product.price;
  const hasSale = product.isSaleActive ?? (product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price));
  const isScheduledSale = product.saleStatus === 'scheduled';
  const discountPercent = product.discountPercent || getDiscountPercent(product);
  const saleTiming = sales.showSaleTiming !== false ? getSaleTimingMessage(product) : null;
  const saleLabel = (hasSale || isScheduledSale) && sales.showSaleLabel !== false ? (product.saleLabel || sales.defaultSaleLabel || null) : null;
  const endingSoon = hasSale && sales.showCountdown !== false && isEndingSoon(product.saleEndAt, sales.endingSoonHours);
  const hasRating = product.averageRating != null;

  return (
    <Card
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', textDecoration: 'none' }}
      component={Link}
      to={`/products/${product.slug}`}
      state={fromCategory ? { fromCategory } : undefined}
    >
      <Box sx={{ position: 'relative', pt: '100%', backgroundColor: 'action.hover' }}>
        {(hasSale || isScheduledSale) && sales.showDiscountPercent !== false && discountPercent > 0 && (
          <Chip
            label={hasSale ? `${discountPercent}% OFF` : 'Starts Soon'}
            color={hasSale ? 'error' : 'warning'}
            size="small"
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
          />
        )}
        {endingSoon && (
          <Chip
            label="Ending Soon"
            color="warning"
            size="small"
            sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1, fontWeight: 700 }}
          />
        )}
        <CardMedia
          component="img"
          image={primaryImage}
          alt={product.name}
          sx={{ position: 'absolute', top: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        {product.brand?.name && (
          <Typography variant="caption" color="primary" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
            {product.brand.name}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" noWrap gutterBottom>
          {product.categories?.[0]?.name}
        </Typography>
        <Typography variant="h6" component="div" noWrap sx={{ fontWeight: 600 }}>
          {product.name}
        </Typography>
        {hasRating && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Rating
              value={parseFloat(product.averageRating)}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasSale ? (
            <>
              <Typography variant="h6" color="primary">
                {formatPrice(displayPrice)}
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ textDecoration: 'line-through' }}
              >
                {formatPrice(product.price)}
              </Typography>
            </>
          ) : (
            <Typography variant="h6">{formatPrice(displayPrice)}</Typography>
          )}
        </Box>
        {(saleLabel || saleTiming) && (
          <Box sx={{ mt: 1 }}>
            {saleLabel && (
              <Typography variant="caption" color="error.main" sx={{ display: 'block', fontWeight: 700 }}>
                {saleLabel}
              </Typography>
            )}
            {saleTiming && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {saleTiming}
              </Typography>
            )}
            {endingSoon && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', fontWeight: 700 }}>
                Ends soon
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductCard;
