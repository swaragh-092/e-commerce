import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Container, Grid, Typography, Button, Chip, CircularProgress, Divider } from '@mui/material';
import { AddShoppingCart as CartIcon } from '@mui/icons-material';
import ProductImages from '../../components/product/ProductImages';
import VariantSelector from '../../components/product/VariantSelector';
import WishlistButton from '../../components/common/WishlistButton';
import ReviewSection from '../../components/product/ReviewSection';
import { getProduct } from '../../services/productService';

const ProductDetailPage = () => {
    const { slug } = useParams();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const res = await getProduct(slug);
                if (res?.data?.product) {
                    setProduct(res.data.product);
                    if (res.data.product.variants?.length > 0) {
                        setSelectedVariant(res.data.product.variants[0]);
                    }
                }
            } catch (err) {
                setError('Product not found');
            } finally {
                setLoading(false);
            }
        };
        fetchProduct();
    }, [slug]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
    if (error || !product) return <Typography variant="h5" color="error" textAlign="center" sx={{ mt: 10 }}>{error}</Typography>;

    const currentPrice = selectedVariant?.priceModifier ? parseFloat(product.salePrice || product.price) + parseFloat(selectedVariant.priceModifier) : parseFloat(product.salePrice || product.price);
    const hasSale = product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price);
    const stockAvailable = selectedVariant ? selectedVariant.quantity > 0 : product.quantity > 0;

    return (
        <Container maxWidth="lg" sx={{ py: 6 }}>
            <Grid container spacing={6}>
                <Grid item xs={12} md={6}>
                    <ProductImages images={product.images} />
                </Grid>
                
                <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {product.categories?.map(c => c.name).join(' > ')}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h4" fontWeight="bold">
                            {product.name}
                        </Typography>
                        <WishlistButton productId={product.id} />
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        {hasSale ? (
                            <>
                                <Typography variant="h5" color="primary" fontWeight="bold">${currentPrice.toFixed(2)}</Typography>
                                <Typography variant="h6" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                    ${parseFloat(product.price).toFixed(2)}
                                </Typography>
                            </>
                        ) : (
                            <Typography variant="h5" fontWeight="bold">${currentPrice.toFixed(2)}</Typography>
                        )}
                        {hasSale && <Chip label="Sale" color="error" />}
                    </Box>

                    <Typography variant="body1" color="text.secondary" paragraph>
                        {product.shortDescription}
                    </Typography>

                    <VariantSelector 
                        variants={product.variants} 
                        selectedVariantId={selectedVariant?.id} 
                        onSelect={setSelectedVariant} 
                    />

                    <Box sx={{ mb: 4, mt: 3 }}>
                        <Button 
                            variant="contained" 
                            size="large" 
                            fullWidth 
                            startIcon={<CartIcon />}
                            disabled={!stockAvailable}
                            sx={{ py: 1.5, fontSize: '1.1rem' }}
                        >
                            {stockAvailable ? 'Add to Cart' : 'Out of Stock'}
                        </Button>
                    </Box>

                    <Divider sx={{ my: 4 }} />
                    
                    <Typography variant="h6" gutterBottom>Product Details</Typography>
                    <Box dangerouslySetInnerHTML={{ __html: product.description }} sx={{ typography: 'body2', color: 'text.secondary', '& p': { mt: 0, mb: 2 } }} />
                    
                    {product.tags?.length > 0 && (
                        <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {product.tags.map(t => <Chip key={t.id} label={t.name} size="small" variant="outlined" />)}
                        </Box>
                    )}

                    <ReviewSection slug={product.slug} />
                </Grid>
            </Grid>
        </Container>
    );
};

export default ProductDetailPage;
