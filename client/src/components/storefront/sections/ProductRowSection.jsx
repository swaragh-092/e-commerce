import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ProductRow from '../../product/ProductRow';
import ProductCard from '../../product/ProductCard';
import { useComponentStyles } from '../../../hooks/useSettings';
import { CanvasEditableText } from './SectionFallback';


const previewProducts = [
  { name: 'Signature Product', price: '$29.99' },
  { name: 'Customer Favorite', price: '$44.99' },
  { name: 'New Arrival', price: '$19.99' },
  { name: 'Best Seller', price: '$59.99' },
];

const clampPreviewCount = (count) => Math.min(parseInt(count, 10) || 4, 4);


const makeMockProduct = (name, priceStr, index, source) => {
  const numericPrice = parseFloat(String(priceStr).replace(/[^0-9.]/g, '')) || 29.99;
  const isSale = source === 'sale' || index % 2 === 1;
  const price = numericPrice;
  const salePrice = isSale ? numericPrice * 0.8 : null;
  
  return {
    id: `preview-${index}`,
    name,
    slug: `preview-${index}`,
    price: price,
    salePrice: salePrice,
    effectivePrice: isSale ? salePrice : price,
    isSaleActive: isSale,
    saleStatus: isSale ? 'active' : 'none',
    discountPercent: isSale ? 20 : 0,
    avgRating: '4.5',
    reviewCount: 12 + index,
    brand: { name: 'Preview Brand' },
    categories: [{ name: 'Preview Category' }],
    images: [{ url: '', isPrimary: true }],
  };
};

const PreviewProductCardWrapper = ({ product, index, compact = false, onSelectComponent, source }) => {
  const mockProduct = makeMockProduct(product.name, product.price, index, source);
  
  return (
    <Box
      onClick={(event) => {
        if (!onSelectComponent) return;
        event.preventDefault();
        event.stopPropagation();
        onSelectComponent('productCard');
      }}
      sx={{
        height: '100%',
        width: '100%',
        cursor: 'pointer',
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          cursor: 'pointer',
        },
        '&:hover': onSelectComponent ? {
          outline: '2px dashed #1976d2',
          outlineOffset: 2,
        } : undefined,
      }}
    >
      <ProductCard product={mockProduct} compact={compact} />
    </Box>
  );
};

const PreviewProductRow = ({ section, onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const count = clampPreviewCount(section?.count);
  const items = Array.from({ length: count }, (_, index) => previewProducts[index % previewProducts.length]);
  const variant = section?.variant || section?.layout || 'grid';
  const isCarousel = variant === 'carousel';
  const isCompact = variant === 'grid-compact';

  const align = section?.textAlign || 'left';
  const carouselCardWidth = isCompact
    ? { xs: '170px', sm: '190px', md: '210px', lg: '220px' }
    : { xs: '210px', sm: '230px', md: '248px', lg: '260px' };

  return (
    <Box sx={{ mb: isCompact ? { xs: 3, md: 4 } : { xs: 4, md: 5 } }}>
      <Box sx={{
        display: 'flex',
        flexDirection: align === 'left' ? { xs: 'column', sm: 'row' } : 'column',
        justifyContent: 'space-between',
        alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : { xs: 'flex-start', sm: 'center' },
        gap: 2,
        mb: isCompact ? 1.5 : 2.25,
        textAlign: align,
        width: '100%',
      }}>
        <CanvasEditableText
          section={section}
          field="title"
          preview
          onInlineFieldChange={onInlineFieldChange}
          onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
          variant={isCompact ? 'h6' : 'h5'}
          sx={{ fontWeight: 800, width: align === 'left' ? 'auto' : '100%' }}
        >
          {section?.title || 'Products'}
        </CanvasEditableText>
        {section?.viewAllLink && (
          <Button
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardIcon />}
            sx={{
              bgcolor: 'background.paper',
              '&:hover': {
                bgcolor: 'primary.light',
                color: 'primary.dark',
              },
            }}
          >
            {section?.viewAllLabel || 'View All'}
          </Button>
        )}
      </Box>

      {isCarousel ? (
        <Box sx={{ position: 'relative', mx: { xs: 0, md: -1 } }}>
          <Box
            sx={{
              display: 'flex',
              gap: isCompact ? { xs: 1, md: 1.25 } : { xs: 1.5, md: 2 },
              overflowX: 'auto',
              pb: 2,
              alignItems: 'stretch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {items.map((product, index) => (
              <Box key={`${product.name}-${index}`} sx={{ width: carouselCardWidth, flexShrink: 0, display: 'flex' }}>
                <PreviewProductCardWrapper product={product} index={index} compact={isCompact} onSelectComponent={onSelectComponent} source={section?.source} />
              </Box>
            ))}
          </Box>
        </Box>
      ) : (
        <Grid container spacing={isCompact ? { xs: 1, md: 1.25 } : { xs: 1.5, md: 2 }}>
          {items.map((product, index) => (
            <Grid item xs={6} sm={isCompact ? 3 : 4} md={isCompact ? 2 : 3} lg={isCompact ? 2 : 2.4} key={`${product.name}-${index}`} sx={{ display: 'flex' }}>
              <PreviewProductCardWrapper product={product} index={index} compact={isCompact} onSelectComponent={onSelectComponent} source={section?.source} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

const ProductRowSection = ({
  section,
  products = [],
  loading = false,
  count = 8,
  mode = 'live',
  pricingEnabled = true,
  onSelectComponent,
  onInlineFieldChange,
  onInlineFieldCommit, onInlineBlockFocus,
}) => {
  if (mode === 'preview') {
    return <PreviewProductRow section={section || {}} onSelectComponent={onSelectComponent} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />;
  }

  if (!pricingEnabled && section?.source === 'sale') return null;

  const variant = section?.variant || section?.layout || 'grid';

  return (
    <ProductRow
      title={section?.title}
      viewAllLink={section?.viewAllLink}
      viewAllLabel={section?.viewAllLabel || 'View All'}
      products={products}
      loading={loading}
      count={count}
      layout={variant === 'grid-compact' ? 'grid' : variant}
      compact={variant === 'grid-compact'}
      align={section?.textAlign || 'left'}
    />
  );
};

export default React.memo(ProductRowSection);
