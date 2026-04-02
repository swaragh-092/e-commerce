import React from 'react';
import { Grid, Skeleton, Typography, Box } from '@mui/material';
import ProductCard from './ProductCard';

const ProductGrid = ({ products, loading }) => {
    if (loading) {
        return (
            <Grid container spacing={3}>
                {[...Array(8)].map((_, i) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                        <Skeleton variant="rectangular" height={250} />
                        <Skeleton height={30} sx={{ mt: 1 }} />
                        <Skeleton width="60%" height={24} />
                    </Grid>
                ))}
            </Grid>
        );
    }

    if (!products || products.length === 0) {
        return (
            <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">No products found matching your criteria.</Typography>
            </Box>
        );
    }

    return (
        <Grid container spacing={3}>
            {products.map(product => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                    <ProductCard product={product} />
                </Grid>
            ))}
        </Grid>
    );
};

export default ProductGrid;
