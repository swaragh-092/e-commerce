import React, { useState, useEffect } from 'react';
import { Box, Container, Grid, Typography, Pagination, TextField, InputAdornment, Drawer, IconButton, useTheme, useMediaQuery } from '@mui/material';
import { Search as SearchIcon, FilterList as FilterIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import ProductGrid from '../../components/product/ProductGrid';
import ProductFilters from '../../components/product/ProductFilters';
import { getProducts } from '../../services/productService';
import { getCategoryTree } from '../../services/categoryService';
import PageSEO from '../../components/common/PageSEO';
import { useDebounce } from '../../hooks/useDebounce';
import { useSettings } from '../../hooks/useSettings';

const ProductListPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
    const [categoryName, setCategoryName] = useState('');

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { settings } = useSettings();
    const catalog      = settings?.catalog || {};
    const defaultSort  = catalog.defaultSort  || 'newest';
    const defaultLimit = parseInt(catalog.defaultPageSize) || 20;
    const gridCols     = parseInt(catalog.gridColumns) || 4;
    const showFilters  = catalog.showFilters !== false;

    const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
    const debouncedSearch = useDebounce(searchInput, 400);

    // Sync debounced search into URL params
    useEffect(() => {
        const current = searchParams.get('search') || '';
        if (debouncedSearch !== current) {
            handleFilterChange({ ...filters, search: debouncedSearch, page: 1 });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    // Sync searchInput when URL changes externally (e.g. clear filters)
    useEffect(() => {
        setSearchInput(searchParams.get('search') || '');
    }, [searchParams]);

    const filters = {
        search: searchParams.get('search') || '',
        category: searchParams.get('category') || '',
        page: parseInt(searchParams.get('page')) || 1,
        sort: searchParams.get('sort') || defaultSort,
        minPrice: searchParams.get('minPrice') || '',
        maxPrice: searchParams.get('maxPrice') || '',
        status: 'published',
        limit: defaultLimit,
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

    // Resolve the category slug → full breadcrumb path for the contextual breadcrumb on PDP
    // e.g. "vegetable" slug → "Vegetable > Roots > Beetroot" when filtering by beetroot
    useEffect(() => {
        const categorySlug = searchParams.get('category');
        if (!categorySlug) { setCategoryName(''); return; }

        // Recursively search the tree, building the path as we go.
        // Returns the full path string if found, or null.
        const findPathInTree = (nodes, slug, ancestors = []) => {
            for (const node of nodes) {
                const currentPath = [...ancestors, node.name];
                if (node.slug === slug) return currentPath.join(' > ');
                if (node.children?.length) {
                    const found = findPathInTree(node.children, slug, currentPath);
                    if (found) return found;
                }
            }
            return null;
        };

        getCategoryTree().then((res) => {
            const path = findPathInTree(res?.data?.categories || [], categorySlug);
            setCategoryName(path || '');
        }).catch(() => setCategoryName(''));
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
            <PageSEO title="Products" description="Browse our products" />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">Our Products</Typography>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    {showFilters && isMobile && (
                        <IconButton onClick={() => setMobileFilterOpen(true)} color="primary">
                            <FilterIcon />
                        </IconButton>
                    )}
                    <TextField
                        size="small"
                        placeholder="Search products..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                        }}
                    />
                </Box>
            </Box>

            <Grid container spacing={4}>
                {showFilters && !isMobile && (
                    <Grid item md={3} lg={2.5}>
                        <ProductFilters filters={filters} onFilterChange={handleFilterChange} />
                    </Grid>
                )}

                <Grid item xs={12} md={showFilters ? 9 : 12} lg={showFilters ? 9.5 : 12}>
                    <ProductGrid products={products} loading={loading} gridCols={gridCols} fromCategory={categoryName} />

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
