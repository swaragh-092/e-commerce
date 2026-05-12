import React from 'react';
import { Grid, Skeleton, Typography, Box } from '@mui/material';
import ProductCard from './ProductCard';

// Maps the setting value (number of desktop columns) → MUI Grid breakpoints
const COLS_MAP = {
    2: { xs: 6, sm: 6,  md: 6,  lg: 6   },
    3: { xs: 6, sm: 6,  md: 4,  lg: 4   },
    4: { xs: 6, sm: 4,  md: 3,  lg: 3   },
    5: { xs: 6, sm: 4,  md: 3,  lg: 2.4 },
};

const ProductGrid = ({ products, loading, gridCols = 4, fromCategory }) => {
    const cols = COLS_MAP[parseInt(gridCols)] || COLS_MAP[4];

    if (loading) {
        return (
            <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
                {[...Array(8)].map((_, i) => (
                    <Grid item xs={cols.xs} sm={cols.sm} md={cols.md} lg={cols.lg} key={i}>
                        <Box sx={{ aspectRatio: '4 / 3.2', mb: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                            <Skeleton variant="rectangular" sx={{ width: '100%', height: '100%', borderRadius: 2 }} />
                        </Box>
                        <Skeleton width="80%" height={24} />
                        <Skeleton width="60%" height={24} sx={{ mt: 1 }} />
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
        <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
            {products.map(product => (
                <Grid item xs={cols.xs} sm={cols.sm} md={cols.md} lg={cols.lg} key={product.id} sx={{ display: 'flex' }}>
                    <ProductCard product={product} fromCategory={fromCategory} />
                </Grid>
            ))}
        </Grid>
    );
};

export default ProductGrid;
