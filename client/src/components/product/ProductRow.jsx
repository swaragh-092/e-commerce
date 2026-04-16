import React from 'react';
import {
    Box, Typography, Button, Grid, Skeleton,
} from '@mui/material';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

/**
 * ProductRow — reusable section component used on the homepage.
 * Props:
 *   title        {string}   Section heading
 *   viewAllLink  {string}   URL for the "View All" button (omit to hide button)
 *   viewAllLabel {string}   Override label for the "View All" button
 *   products     {array}    Array of product objects
 *   loading      {boolean}  Show skeleton state
 *   count        {number}   How many skeleton cards to show while loading (default 4)
 *   layout       {string}   'grid' or 'carousel' layout mode
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
    if (!loading && products.length === 0) return null;

    // Layout configuration for carousels
    const carouselStyles = {
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
        pb: 2, // padding for strict scrollbars
        scrollSnapType: 'x mandatory',
        '&::-webkit-scrollbar': { height: 8 },
        '&::-webkit-scrollbar-track': { bgcolor: 'divider', borderRadius: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'text.disabled', borderRadius: 4 },
        // ensures cards snap to beginning
        '& > *': {
            scrollSnapAlign: 'start',
            minWidth: { xs: '260px', sm: '280px', md: '300px' },
            flexShrink: 0
        }
    };

    return (
        <Box sx={{ mb: 6 }}>
            {/* Section header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" fontWeight={700}>
                    {title}
                </Typography>
                {viewAllLink && (
                    <Button
                        component={Link}
                        to={viewAllLink}
                        variant="outlined"
                        size="small"
                        endIcon={<ArrowForwardIcon />}
                        sx={{ textTransform: 'none' }}
                    >
                        {viewAllLabel}
                    </Button>
                )}
            </Box>

            {/* Product content */}
            {layout === 'carousel' ? (
                <Box sx={carouselStyles}>
                    {loading
                        ? Array.from({ length: count }).map((_, i) => (
                            <Box key={i}>
                                <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
                                <Skeleton sx={{ mt: 1 }} />
                                <Skeleton width="60%" />
                            </Box>
                        ))
                        : products.map((product) => (
                            <Box key={product.id}>
                                <ProductCard product={product} />
                            </Box>
                        ))
                    }
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {loading
                        ? Array.from({ length: count }).map((_, i) => (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                                <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
                                <Skeleton sx={{ mt: 1 }} />
                                <Skeleton width="60%" />
                            </Grid>
                        ))
                        : products.map((product) => (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
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
