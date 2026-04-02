import React, { useState, useEffect } from 'react';
import { Box, Container, Grid, Typography, Pagination, TextField, InputAdornment, Drawer, IconButton, useTheme, useMediaQuery } from '@mui/material';
import { Search as SearchIcon, FilterList as FilterIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import ProductGrid from '../../components/product/ProductGrid';
import ProductFilters from '../../components/product/ProductFilters';
import { getProducts } from '../../services/productService';

const ProductListPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
    
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const filters = {
        search: searchParams.get('search') || '',
        category: searchParams.get('category') || '',
        page: parseInt(searchParams.get('page')) || 1,
        sort: searchParams.get('sort') || 'newest',
        minPrice: searchParams.get('minPrice') || '',
        maxPrice: searchParams.get('maxPrice') || ''
    };

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const res = await getProducts(filters);
                if (res.success) {
                    setProducts(res.data);
                    if (res.meta) setMeta(res.meta);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, [searchParams]);

    const handleFilterChange = (newFilters) => {
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => {
            if (v) params.set(k, v);
        });
        setSearchParams(params);
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">Our Products</Typography>
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {isMobile && (
                        <IconButton onClick={() => setMobileFilterOpen(true)} color="primary">
                            <FilterIcon />
                        </IconButton>
                    )}
                    <TextField
                        size="small"
                        placeholder="Search products..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange({ ...filters, search: e.target.value, page: 1 })}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                        }}
                    />
                </Box>
            </Box>

            <Grid container spacing={4}>
                {!isMobile && (
                    <Grid item md={3} lg={2.5}>
                        <ProductFilters filters={filters} onFilterChange={handleFilterChange} />
                    </Grid>
                )}
                
                <Grid item xs={12} md={9} lg={9.5}>
                    <ProductGrid products={products} loading={loading} />
                    
                    {meta.totalPages > 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                            <Pagination 
                                count={meta.totalPages} 
                                page={meta.page} 
                                onChange={(e, p) => handleFilterChange({ ...filters, page: p })} 
                                color="primary" 
                                size="large" 
                            />
                        </Box>
                    )}
                </Grid>
            </Grid>

            <Drawer anchor="left" open={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)}>
                <Box sx={{ width: 280, p: 3 }}>
                    <ProductFilters filters={filters} onFilterChange={(f) => { handleFilterChange(f); setMobileFilterOpen(false); }} />
                </Box>
            </Drawer>
        </Container>
    );
};

export default ProductListPage;
