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

    // Track scroll to show/hide navigation
    const checkScroll = () => {
        if (scrollRef.current) {
            setCanScrollLeft(scrollRef.current.scrollLeft > 20);
        }
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (el) {
            el.addEventListener('scroll', checkScroll);
            checkScroll(); // initial check
            return () => el.removeEventListener('scroll', checkScroll);
        }
    }, [products, loading]);

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
        scrollBehavior: 'smooth',
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // IE 10+
        '&::-webkit-scrollbar': { display: 'none' }, // Safari and Chrome
        '& > *': {
            scrollSnapAlign: 'start',
            minWidth: { xs: '260px', sm: '280px', md: '300px' },
            flexShrink: 0
        }
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
                <Box sx={{ position: 'relative', mx: { xs: 0, md: -1 } }}>
                    {/* Previous Button (Fades in when moved) */}
                    {canScrollLeft && (
                        <IconButton
                            onClick={() => scroll('left')}
                            sx={{ ...arrowButtonStyles, left: -22, display: { xs: 'none', md: 'flex' } }}
                        >
                            <ChevronLeftIcon />
                        </IconButton>
                    )}

                    {/* Next Button (Always visible) */}
                    <IconButton
                        onClick={() => scroll('right')}
                        sx={{ ...arrowButtonStyles, right: -22, display: { xs: 'none', md: 'flex' } }}
                    >
                        <ChevronRightIcon />
                    </IconButton>

                    <Box ref={scrollRef} sx={carouselStyles}>
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
