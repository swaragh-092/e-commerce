import React from 'react';
import { Grid, Skeleton, Typography, Box } from '@mui/material';
import ProductCard from './ProductCard';

// Maps the setting value (number of desktop columns) → MUI Grid breakpoints
const COLS_MAP = {
    2: { xs: 12, sm: 6,  md: 6,  lg: 6   },
    3: { xs: 12, sm: 6,  md: 4,  lg: 4   },
    4: { xs: 12, sm: 6,  md: 4,  lg: 3   },
    5: { xs: 12, sm: 4,  md: 3,  lg: 2.4 },
};

const ProductGrid = ({ products, loading, gridCols = 4 }) => {
    const cols = COLS_MAP[parseInt(gridCols)] || COLS_MAP[4];

    if (loading) {
        return (
            <Grid container spacing={3}>
                {[...Array(8)].map((_, i) => (
                    <Grid item xs={cols.xs} sm={cols.sm} md={cols.md} lg={cols.lg} key={i}>
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
                <Grid item xs={cols.xs} sm={cols.sm} md={cols.md} lg={cols.lg} key={product.id}>
                    <ProductCard product={product} />
                </Grid>
            ))}
        </Grid>
    );
};

export default ProductGrid;
