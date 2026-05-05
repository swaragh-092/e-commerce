import React, { useState, useEffect } from 'react';
import { Box, Container, Grid, Typography, Pagination, useTheme, useMediaQuery } from '@mui/material';
import ProductGrid from '../../components/product/ProductGrid';
import { getProducts } from '../../services/productService';
import PageSEO from '../../components/common/PageSEO';
import { useSettings } from '../../hooks/useSettings';

const SalePage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
    const [page, setPage] = useState(1);

    const theme = useTheme();
    const { settings } = useSettings();
    const catalog = settings?.catalog || {};
    const defaultLimit = parseInt(catalog.defaultPageSize) || 20;
    const gridCols = parseInt(catalog.gridColumns) || 4;

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const res = await getProducts({ 
                    onSale: true, 
                    status: 'published', 
                    page, 
                    limit: defaultLimit 
                });
                setProducts(res.data || []);
                if (res.meta) setMeta(res.meta);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, [page, defaultLimit]);

    return (
        <Container maxWidth="xl" sx={{ py: 6 }}>
            <PageSEO 
                title="Current Sales & Offers" 
                description="Check out our latest deals and discounted products. Limited time offers!" 
            />
            
            <Box sx={{ mb: 6, textAlign: 'center' }}>
                <Typography variant="h3" fontWeight={800} color="error.main" gutterBottom>
                    Special Offers & Sales
                </Typography>
                <Typography variant="h6" color="text.secondary">
                    Don't miss out on these exclusive discounts.
                </Typography>
            </Box>

            {products.length === 0 && !loading ? (
                <Box sx={{ py: 10, textAlign: 'center' }}>
                    <Typography variant="h5" color="text.secondary">
                        There are no active sales at the moment. Check back soon!
                    </Typography>
                </Box>
            ) : (
                <>
                    <ProductGrid products={products} loading={loading} gridCols={gridCols} />

                    {meta.totalPages > 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                            <Pagination
                                count={meta.totalPages}
                                page={meta.page}
                                onChange={(e, p) => setPage(p)}
                                color="primary"
                                size="large"
                            />
                        </Box>
                    )}
                </>
            )}
        </Container>
    );
};

export default SalePage;
