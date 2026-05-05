import React from 'react';
import { Card, CardMedia, CardContent, Typography, Box, Rating, Chip } from '@mui/material';
import { Link } from 'react-router-dom';
import { getMediaUrl } from '../../utils/media';
import { useCurrency, useSettings, useFeature } from '../../hooks/useSettings';
import { getDiscountPercent, getSaleTimingMessage, isEndingSoon } from '../../utils/pricing';

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
  const hasRating = product.averageRating != null;

  return (
    <Card
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        overflow: 'hidden',
        boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 12px;',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
        '&:hover': {
          transform: 'translateY(-6px)',
          // borderColor: 'primary.light',
          // boxShadow: '0 24px 54px rgba(31, 41, 51, 0.14)',
        },
        '&:hover img': {
          transform: 'scale(1.045)',
        },
      }}
      component={Link}
      to={`/products/${product.slug}`}
      state={fromCategory ? { fromCategory } : undefined}
    >
      <Box
        sx={{
          position: 'relative',
          pt: '100%',
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
      <CardContent sx={{ flexGrow: 1, p: 2.25, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ minHeight: 40, mb: 1 }}>
          {product.brand?.name ? (
            <Typography variant="caption" color="primary" sx={{ display: 'block', fontWeight: 600, mb: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>
              {product.brand.name}
            </Typography>
          ) : (
            <Box sx={{ height: 20 }} />
          )}
          <Typography variant="body2" color="text.secondary" noWrap>
            {product.categories?.[0]?.name || 'Uncategorized'}
          </Typography>
        </Box>
        
        <Box sx={{ minHeight: 48, mb: 1.5 }}>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              fontWeight: 800, 
              fontSize: '1rem', 
              color: 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.2,
              height: 40 // Fixed height for 2 lines
            }}
          >
            {product.name}
          </Typography>
        </Box>
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
        <Box sx={{ flexGrow: 1 }} />
        {showPrice && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto' }}>
            {hasSale ? (
              <>
                <Typography variant="h6" color="primary" sx={{ fontWeight: 900 }}>
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
              <Typography variant="h6" sx={{ fontWeight: 900 }}>{formatPrice(displayPrice)}</Typography>
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
    </Card>
  );
};

export default ProductCard;
