import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Skeleton, Card, CardContent } from '@mui/material';
import { getRelatedProducts } from '../../services/productService';
import ProductCard from './ProductCard';

const SKELETON_COUNT = 4;

const RelatedProducts = ({ productId }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!productId) return;
        setLoading(true);
        getRelatedProducts(productId)
            .then((res) => setProducts(res.data || []))
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
    }, [productId]);

    if (!loading && products.length === 0) return null;

    return (
        <Box sx={{ mt: 8 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 4 }}>
                You May Also Like
            </Typography>
            <Grid container spacing={3}>
                {loading
                    ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                          <Grid item xs={6} sm={4} md={3} key={i}>
                              <Card>
                                  <Skeleton variant="rectangular" sx={{ pt: '100%' }} />
                                  <CardContent>
                                      <Skeleton width="60%" />
                                      <Skeleton />
                                      <Skeleton width="40%" />
                                  </CardContent>
                              </Card>
                          </Grid>
                      ))
                    : products.map((product) => (
                          <Grid item xs={6} sm={4} md={3} key={product.id}>
                              <ProductCard product={product} />
                          </Grid>
                      ))}
            </Grid>
        </Box>
    );
};

export default RelatedProducts;
