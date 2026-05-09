import React, { useRef, useState, useEffect } from 'react';
import {
  Box, Typography, Button, Grid, Skeleton, IconButton,
} from '@mui/material';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/**
 * ProductRow — reusable section component used on the homepage.
 */
const ProductRow = ({
  title,
  viewAllLink,
  viewAllLabel = 'View All',
  products = [],
  loading = false,
  count = 4,
  layout = 'grid',
}) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Track scroll to show/hide navigation
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      // Use a smaller threshold for better accuracy
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      
      // Check after a short delay to ensure layout is complete
      const timer = setTimeout(checkScroll, 100);
      
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
        clearTimeout(timer);
      };
    }
  }, [products, loading, layout]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.8 : clientWidth * 0.8;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!loading && products.length === 0) return null;

  const carouselStyles = {
    display: 'flex',
    gap: 2,
    overflowX: 'auto',
    pb: 2,
    alignItems: 'stretch',
    scrollBehavior: 'smooth',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
  };

  const arrowButtonStyles = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    bgcolor: 'background.paper',
    boxShadow: 3,
    '&:hover': { bgcolor: 'background.paper', boxShadow: 6 },
    width: 44,
    height: 44,
  };

  return (
    <Box sx={{ mb: 6 }}>
      {/* Section header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={800}>
          {title}
        </Typography>
        {viewAllLink && (
          <Button
            component={Link}
            to={viewAllLink}
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
            {viewAllLabel}
          </Button>
        )}
      </Box>

      {/* Product content */}
      {layout === 'carousel' ? (
        <Box sx={{ position: 'relative', mx: { xs: 0, md: -1 } }}>
          {/* Previous Button (Fades in when moved) */}
          {canScrollLeft && (
            <IconButton
              onClick={() => scroll('left')}
              aria-label="Scroll left"
              sx={{ ...arrowButtonStyles, left: -22, display: { xs: 'none', md: 'flex' } }}
            >
              <ChevronLeftIcon />
            </IconButton>
          )}

          {/* Next Button (Fades in when there is content to the right) */}
          {canScrollRight && (
            <IconButton
              onClick={() => scroll('right')}
              aria-label="Scroll right"
              sx={{ ...arrowButtonStyles, right: -22, display: { xs: 'none', md: 'flex' } }}
            >
              <ChevronRightIcon />
            </IconButton>
          )}

          <Box ref={scrollRef} sx={carouselStyles}>
            {loading
              ? Array.from({ length: count }).map((_, i) => (
                <Box key={i} sx={{ width: { xs: '260px', sm: '280px', md: '300px' }, flexShrink: 0, display: 'flex' }}>
                  <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ position: 'relative', pt: '100%', mb: 1, bgcolor: 'action.hover', borderRadius: 2 }}>
                      <Skeleton variant="rectangular" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 2 }} />
                    </Box>
                    <Skeleton width="80%" />
                    <Skeleton width="60%" />
                  </Box>
                </Box>
              ))
              : products.map((product) => (
                <Box key={product.id} sx={{ width: { xs: '260px', sm: '280px', md: '300px' }, flexShrink: 0, display: 'flex' }}>
                  <ProductCard product={product} />
                </Box>
              ))
            }
          </Box>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {loading
            ? Array.from({ length: count }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                <Box sx={{ position: 'relative', pt: '100%', mb: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Skeleton variant="rectangular" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 2 }} />
                </Box>
                <Skeleton width="80%" />
                <Skeleton width="60%" />
              </Grid>
            ))
            : products.map((product) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={product.id} sx={{ display: 'flex' }}>
                <ProductCard product={product} />
              </Grid>
            ))
          }
        </Grid>
      )}
    </Box>
  );
};

export default ProductRow;
