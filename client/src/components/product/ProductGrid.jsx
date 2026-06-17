import React from 'react';
import { Button, Grid, Skeleton, Typography, Box, Card, CardMedia, CardContent, Chip } from '@mui/material';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import { getMediaUrl } from '../../utils/media';
import { useCurrency, useFeature } from '../../hooks/useSettings';

// Maps the setting value (number of desktop columns) -> MUI Grid breakpoints
const COLS_MAP = {
    2: { xs: 6, sm: 6,  md: 6,  lg: 6   },
    3: { xs: 6, sm: 6,  md: 4,  lg: 4   },
    4: { xs: 6, sm: 4,  md: 3,  lg: 3   },
    5: { xs: 6, sm: 4,  md: 3,  lg: 2.4 },
    6: { xs: 6, sm: 4,  md: 2.4, lg: 2   },
};

const ProductGrid = ({ products, loading, gridCols = 4, fromCategory, hasActiveFilters = false, onClearFilters, variant = 'grid' }) => {
    const cols = COLS_MAP[parseInt(gridCols)] || COLS_MAP[4];
    const isCompactList = variant === 'compact-list';
    const { formatPrice } = useCurrency();
    const showPrice = useFeature('showPrice');

    if (loading) {
        return (
            <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
                {[...Array(8)].map((_, i) => (
                    <Grid item xs={isCompactList ? 12 : cols.xs} sm={isCompactList ? 12 : cols.sm} md={isCompactList ? 12 : cols.md} lg={isCompactList ? 12 : cols.lg} key={i}>
                        <Box sx={{ aspectRatio: isCompactList ? '8 / 1.4' : '4 / 3.2', mb: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                            <Skeleton variant="rectangular" sx={{ width: '100%', height: '100%', borderRadius: 2 }} />
                        </Box>
                    </Grid>
                ))}
            </Grid>
        );
    }

    if (!products || products.length === 0) {
        return (
            <Box sx={{ py: { xs: 7, md: 9 }, px: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box sx={{ width: 72, height: 72, borderRadius: '50%', border: '1.5px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}>
                    <SearchOffOutlinedIcon sx={{ fontSize: 30, color: 'text.disabled' }} />
                </Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>No products found</Typography>
                <Typography color="text.secondary" sx={{ mb: hasActiveFilters ? 3 : 0, maxWidth: 360, lineHeight: 1.6 }}>
                    {hasActiveFilters
                        ? 'Try broadening your search or clearing some filters to see more products.'
                        : 'There are no products available right now. Please check back soon.'}
                </Typography>
                {hasActiveFilters && onClearFilters && (
                    <Button variant="contained" onClick={onClearFilters}>
                        Clear Filters
                    </Button>
                )}
            </Box>
        );
    }

    if (isCompactList) {
        return (
            <Grid container spacing={1.5}>
                {products.map((product) => {
                    const primaryImage = getMediaUrl(product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url || '') || '/placeholder.png';
                    const displayPrice = product.effectivePrice ?? product.salePrice ?? product.price;
                    const hasSale = product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price);
                    return (
                        <Grid item xs={12} key={product.id}>
                            <Card
                                component={Link}
                                to={`/products/${product.slug}`}
                                state={fromCategory ? { fromCategory } : undefined}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '96px 1fr', sm: '132px 1fr auto' },
                                    gap: { xs: 1.5, sm: 2 },
                                    alignItems: 'center',
                                    p: 1.25,
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    boxShadow: 'none',
                                    '&:hover': { borderColor: 'primary.main', boxShadow: '0 14px 34px rgba(15, 23, 42, 0.10)' },
                                }}
                            >
                                <CardMedia
                                    component="img"
                                    image={primaryImage}
                                    alt={product.name}
                                    sx={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 1.5, objectFit: 'cover', bgcolor: 'action.hover' }}
                                />
                                <CardContent sx={{ p: '0 !important', minWidth: 0 }}>
                                    {product.brand?.name && (
                                        <Typography variant="caption" color="primary" fontWeight={800} noWrap>{product.brand.name}</Typography>
                                    )}
                                    <Typography variant="subtitle1" fontWeight={900} noWrap>{product.name}</Typography>
                                    <Typography variant="body2" color="text.secondary" noWrap>
                                        {product.shortDescription || product.categories?.[0]?.name || 'Catalog item'}
                                    </Typography>
                                    {hasSale && <Chip label="Sale" size="small" color="error" sx={{ mt: 1, fontWeight: 800 }} />}
                                </CardContent>
                                {showPrice && (
                                    <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right', pr: 1 }}>
                                        <Typography variant="subtitle1" fontWeight={900}>{formatPrice(displayPrice)}</Typography>
                                        {hasSale && (
                                            <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                                {formatPrice(product.price)}
                                            </Typography>
                                        )}
                                    </Box>
                                )}
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>
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
