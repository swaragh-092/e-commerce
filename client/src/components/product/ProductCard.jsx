import React from 'react';
import { Card, CardMedia, CardContent, Typography, Box, Rating, Chip, CardActions } from '@mui/material';
import { Link } from 'react-router-dom';
import { getMediaUrl } from '../../utils/media';
import { useCurrency, useSettings, useFeature } from '../../hooks/useSettings';
import { getDiscountPercent, getSaleTimingMessage, isEndingSoon } from '../../utils/pricing';
import WishlistButton from '../common/WishlistButton';

const ProductCard = ({ product, fromCategory }) => {
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  const pricingEnabled = useFeature('pricing');
  const showPrice = useFeature('showPrice');
  const sales = settings?.sales || {};
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

  const endingSoon = hasSale && sales.showCountdown !== false && isEndingSoon(product.saleEndAt, sales.endingSoonHours);
  const hasRating = product.avgRating != null;
  const productPath = `/products/${product.slug}`;

  return (
    <Card
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        overflow: 'hidden',
        boxShadow: 'rgba(15, 23, 42, 0.08) 0px 4px 14px',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 'rgba(15, 23, 42, 0.13) 0px 12px 28px',
        },
        '&:hover img': {
          transform: 'scale(1.035)',
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
          aspectRatio: { xs: '4 / 3.35', sm: '4 / 3.2' },
          minHeight: { xs: 150, sm: 170 },
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.action.hover} 0%, ${theme.palette.background.default} 100%)`,
        }}
      >
        {pricingEnabled && (hasSale || isScheduledSale) && sales.showDiscountPercent !== false && discountPercent > 0 && (
          <Chip
            label={hasSale ? `${discountPercent}% OFF` : 'Starts Soon'}
            color={hasSale ? 'error' : 'warning'}
            size="small"
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
          />
        )}
        {pricingEnabled && endingSoon && (
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
            top: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.45s ease',
          }}
        />
      </Box>
      <CardContent sx={{ flexGrow: 1, p: { xs: 1.5, sm: 1.75 }, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ minHeight: 40, mb: 0.75 }}>
          {product.brand?.name && (
            <Typography variant="caption" color="primary" sx={{ display: 'block', fontWeight: 700, mb: 0.25, letterSpacing: 0.4 }}>
              {product.brand.name}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {product.categories?.[0]?.name || 'Uncategorized'}
          </Typography>
        </Box>
        
        <Box sx={{ minHeight: 42, mb: 1 }}>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              fontWeight: 800, 
              fontSize: { xs: '0.92rem', sm: '0.96rem' }, 
              color: 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.22,
              height: 38,
            }}
          >
            {product.name}
          </Typography>
        </Box>
        {hasRating && (
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
        <Box sx={{ flexGrow: 1 }} />
        {showPrice && (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 'auto', flexWrap: 'wrap' }}>
            {hasSale ? (
              <>
                <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
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
              <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.2 }}>{formatPrice(displayPrice)}</Typography>
            )}
          </Box>
        )}
        {(saleTiming || endingSoon) && (
          <Box sx={{ mt: 1 }}>
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
      </Box>
      <CardActions sx={{ px: { xs: 1.25, sm: 1.5 }, pb: 1.25, pt: 0, gap: 0.75 }}>
        <Box sx={{ '& .MuiIconButton-root': { width: 34, height: 34, bgcolor: 'action.hover' } }}>
          <WishlistButton productId={product.id} />
        </Box>
      </CardActions>
    </Card>
  );
};

export default ProductCard;
