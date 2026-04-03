import React, { useState, useEffect } from 'react';
import {
    Box, Container, Typography, Button, Grid, Card, CardMedia,
    CardContent, CardActionArea, Skeleton, Chip,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { getProducts } from '../../services/productService';
import { getCategories } from '../../services/categoryService';
import { getMediaUrl } from '../../utils/media';
import PageSEO from '../../components/common/PageSEO';

const HomePage = () => {
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            getProducts({ limit: 8, sort: 'newest' }),
            getCategories(),
        ]).then(([productsRes, categoriesRes]) => {
            if (productsRes.success) setFeaturedProducts(productsRes.data?.slice(0, 8) || []);
            setCategories(Array.isArray(categoriesRes) ? categoriesRes.slice(0, 6) : []);
        }).catch(() => {})
          .finally(() => setLoading(false));
    }, []);

    return (
        <Box>
            <PageSEO title="Home" description="Shop the latest products" />

            {/* Hero */}
            <Box sx={{
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                color: 'white',
                py: { xs: 8, md: 12 },
                textAlign: 'center',
            }}>
                <Container maxWidth="md">
                    <Typography variant="h2" fontWeight={800} gutterBottom sx={{ fontSize: { xs: '2rem', md: '3.5rem' } }}>
                        Shop the Latest
                    </Typography>
                    <Typography variant="h6" sx={{ opacity: 0.9, mb: 4 }}>
                        Discover thousands of products at great prices.
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        component={Link}
                        to="/products"
                        sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' }, py: 1.5, px: 4, fontSize: '1.1rem' }}
                    >
                        Shop Now
                    </Button>
                </Container>
            </Box>

            <Container maxWidth="xl" sx={{ py: 6 }}>
                {/* Categories */}
                {categories.length > 0 && (
                    <Box sx={{ mb: 6 }}>
                        <Typography variant="h5" fontWeight={700} mb={3}>Shop by Category</Typography>
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
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h5" fontWeight={700}>New Arrivals</Typography>
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
                            : featuredProducts.map((product) => {
                                const imageUrl = getMediaUrl(product.images?.[0]?.url || '') || '/placeholder.png';
                                const price = product.salePrice || product.price;
                                const hasSale = product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price);

                                return (
                                    <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%', '&:hover': { boxShadow: 3 }, transition: 'box-shadow 0.2s' }}>
                                            <CardActionArea component={Link} to={`/products/${product.slug}`}>
                                                <CardMedia
                                                    component="img"
                                                    image={imageUrl}
                                                    alt={product.name}
                                                    sx={{ height: 200, objectFit: 'cover' }}
                                                />
                                                <CardContent>
                                                    <Typography variant="body1" fontWeight={600} noWrap>{product.name}</Typography>
                                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                                                        <Typography variant="h6" color="primary.main" fontWeight={700}>
                                                            ${parseFloat(price).toFixed(2)}
                                                        </Typography>
                                                        {hasSale && (
                                                            <Typography variant="body2" color="text.disabled" sx={{ textDecoration: 'line-through' }}>
                                                                ${parseFloat(product.price).toFixed(2)}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    </Grid>
                                );
                            })
                        }
                    </Grid>
                </Box>
            </Container>
        </Box>
    );
};

export default HomePage;
