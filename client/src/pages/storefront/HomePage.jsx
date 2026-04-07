import React, { useState, useEffect } from 'react';
import {
    Box, Container, Typography, Button, Grid, Card, CardMedia,
    CardContent, CardActionArea, Skeleton, Chip, useTheme,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { getProducts } from '../../services/productService';
import { getCategories } from '../../services/categoryService';
import { getMediaUrl } from '../../utils/media';
import { isEndingSoon } from '../../utils/pricing';
import { useCurrency, useSettings } from '../../hooks/useSettings';
import ProductCard from '../../components/product/ProductCard';
import PageSEO from '../../components/common/PageSEO';

const HomePage = () => {
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const { formatPrice } = useCurrency();
    const { settings } = useSettings();
    const theme = useTheme();
    const hero = settings?.hero || {};
    const hp = settings?.homepage || {};
    const showCategories  = hp.showCategories  !== false;
    const categoriesTitle = hp.categoriesTitle || 'Shop by Category';
    const showNewArrivals = hp.showNewArrivals !== false;
    const newArrivalsTitle = hp.newArrivalsTitle || 'New Arrivals';
    const newArrivalsCount = parseInt(hp.newArrivalsCount) || 8;
    const bgType = hero.backgroundType || 'gradient';
    const bgImage = hero.backgroundImage || '';
    const overlayOpacity = Number(hero.overlayOpacity ?? 0.5);
    const heroTextColor = hero.color || '#ffffff';
    const heroTitle = hero.title || 'Shop the Latest';
    const heroSubtitle = hero.subtitle || 'Discover thousands of products at great prices.';
    const heroBtnText = hero.buttonText || 'Shop Now';
    const heroBtnLink = hero.buttonLink || '/products';

    useEffect(() => {
        Promise.all([
            getProducts({ limit: newArrivalsCount, sort: 'newest', status: 'published' }),
            getCategories(),
        ]).then(([productsRes, categoriesRes]) => {
            if (productsRes.success) setFeaturedProducts(productsRes.data?.slice(0, newArrivalsCount) || []);
            setCategories(Array.isArray(categoriesRes) ? categoriesRes.slice(0, 6) : []);
        }).catch(() => {})
          .finally(() => setLoading(false));
    }, [newArrivalsCount]);

    return (
        <Box>
            <PageSEO title="Home" description="Shop the latest products" />

            {/* Hero */}
            <Box sx={{
                position: 'relative',
                overflow: 'hidden',
                ...(bgType === 'image' && bgImage
                    ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : { background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)` }
                ),
                color: heroTextColor,
                py: { xs: 8, md: 12 },
                textAlign: 'center',
            }}>
                {/* Overlay for image backgrounds */}
                {bgType === 'image' && bgImage && (
                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'black', opacity: overlayOpacity, zIndex: 1 }} />
                )}
                <Container maxWidth="md" sx={{ position: 'relative', zIndex: 2 }}>
                    <Typography variant="h2" fontWeight={800} gutterBottom sx={{ fontSize: { xs: '2rem', md: '3.5rem' } }}>
                        {heroTitle}
                    </Typography>
                    <Typography variant="h6" sx={{ opacity: 0.9, mb: 4 }}>
                        {heroSubtitle}
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        component={Link}
                        to={heroBtnLink}
                        sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' }, py: 1.5, px: 4, fontSize: '1.1rem' }}
                    >
                        {heroBtnText}
                    </Button>
                </Container>
            </Box>

            <Container maxWidth="xl" sx={{ py: 6 }}>
                {/* Categories */}
                {showCategories && categories.length > 0 && (
                    <Box sx={{ mb: 6 }}>
                        <Typography variant="h5" fontWeight={700} mb={3}>{categoriesTitle}</Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                            {categories.map((cat) => (
                                <Chip
                                    key={cat.id}
                                    label={cat.name}
                                    component={Link}
                                    to={`/products?category=${cat.slug}`}
                                    clickable
                                    variant="outlined"
                                    size="medium"
                                    sx={{ fontSize: '0.9rem', py: 2, px: 1 }}
                                />
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Featured Products */}
                {showNewArrivals && (
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h5" fontWeight={700}>{newArrivalsTitle}</Typography>
                        <Button component={Link} to="/products" variant="outlined" size="small">View All</Button>
                    </Box>
                    <Grid container spacing={2}>
                        {loading
                            ? Array.from({ length: 8 }).map((_, i) => (
                                <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                                    <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
                                    <Skeleton sx={{ mt: 1 }} />
                                    <Skeleton width="60%" />
                                </Grid>
                            ))
                            : featuredProducts.map((product) => (
                                <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                                    <ProductCard product={product} />
                                </Grid>
                            ))
                        }
                    </Grid>
                </Box>
                )}
            </Container>
        </Box>
    );
};

export default HomePage;
