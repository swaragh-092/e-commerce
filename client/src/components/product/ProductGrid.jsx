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

const ProductGrid = ({ products, loading, gridCols = 4, fromCategory }) => {
    const cols = COLS_MAP[parseInt(gridCols)] || COLS_MAP[4];

    if (loading) {
        return (
            <Grid container spacing={3}>
                {[...Array(8)].map((_, i) => (
                    <Grid item xs={cols.xs} sm={cols.sm} md={cols.md} lg={cols.lg} key={i}>
                        <Box sx={{ position: 'relative', pt: '100%', mb: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                            <Skeleton variant="rectangular" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 2 }} />
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
        <Grid container spacing={3}>
            {products.map(product => (
                <Grid item xs={cols.xs} sm={cols.sm} md={cols.md} lg={cols.lg} key={product.id} sx={{ display: 'flex' }}>
                    <ProductCard product={product} fromCategory={fromCategory} />
                </Grid>
            ))}
        </Grid>
    );
};

export default ProductGrid;
