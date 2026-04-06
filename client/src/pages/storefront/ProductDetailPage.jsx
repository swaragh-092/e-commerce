import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
    Box, Button, Chip, CircularProgress, Container, Divider, Grid, Typography,
} from '@mui/material';
import CartIcon from '@mui/icons-material/ShoppingCart';
import { getProduct } from '../../services/productService';
import PageSEO from '../../components/common/PageSEO';
import ProductImages from '../../components/product/ProductImages';
import VariantSelector from '../../components/product/VariantSelector';
import WishlistButton from '../../components/common/WishlistButton';
import ReviewSection from '../../components/product/ReviewSection';
import DOMPurify from 'dompurify';
import { useCart } from '../../hooks/useCart';
    import { useCurrency, useSettings } from '../../hooks/useSettings';
const ProductDetailPage = () => {
    const { slug } = useParams();
    const location = useLocation();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [addingToCart, setAddingToCart] = useState(false);
    const [cartMsg, setCartMsg] = useState(null);
    const { addItem } = useCart();
    const { formatPrice } = useCurrency();
    const { settings } = useSettings();
    const pp = settings?.productPage || {};
    const addToCartLabel = pp.addToCartLabel || 'Add to Cart';

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

    const basePrice = parseFloat(product.salePrice || product.price);
    const currentPrice = basePrice + parseFloat(selectedVariant?.priceModifier ?? 0);
    const hasSale = product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price);
    const stockAvailable = selectedVariant ? selectedVariant.quantity > 0 : product.quantity > 0;

    const handleAddToCart = async () => {
        setAddingToCart(true);
        setCartMsg(null);
        try {
            await addItem(product.id, 1, selectedVariant?.id || null);
            setCartMsg({ type: 'success', text: 'Added to cart!' });
        } catch (err) {
            setCartMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to add to cart' });
        } finally {
            setAddingToCart(false);
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: 6 }}>
            <PageSEO 
                title={product.name} 
                description={product.shortDescription} 
                image={product.images?.[0]?.url}
                type="product"
            />
            <Grid container spacing={6}>
                <Grid item xs={12} md={6}>
                    <ProductImages images={product.images} />
                </Grid>
                
                <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {(() => {
                            // If the user navigated here from a category page, show that context.
                            if (location.state?.fromCategory) return location.state.fromCategory;

                            // Fallback: build the deepest category path from the product's category list.
                            const cats = product.categories;
                            if (!cats?.length) return null;
                            const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
                            const parentIds = new Set(cats.map(c => c.parentId).filter(Boolean));
                            const leaf = cats.find(c => !parentIds.has(c.id)) || cats[0];
                            const path = [];
                            let cur = leaf;
                            while (cur) {
                                path.unshift(cur.name);
                                cur = cur.parentId ? catMap[cur.parentId] : null;
                            }
                            return path.join(' > ');
                        })()}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h4" fontWeight="bold">
                            {product.name}
                        </Typography>
                        <WishlistButton productId={product.id} />
                    </Box>

                    {pp.showStockBadge !== false && (
                        <Chip
                            label={stockAvailable ? 'In Stock' : 'Out of Stock'}
                            color={stockAvailable ? 'success' : 'default'}
                            size="small"
                            sx={{ mb: 1.5 }}
                        />
                    )}
                    {pp.showSKU !== false && product.sku && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            SKU: <strong>{product.sku}</strong>
                        </Typography>
                    )}
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        {hasSale ? (
                            <>
                                <Typography variant="h5" color="primary" fontWeight="bold">{formatPrice(currentPrice)}</Typography>
                                <Typography variant="h6" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                    {formatPrice(product.price)}
                                </Typography>
                            </>
                        ) : (
                            <Typography variant="h5" fontWeight="bold">{formatPrice(currentPrice)}</Typography>
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
                        {cartMsg && (
                            <Typography color={cartMsg.type === 'error' ? 'error' : 'success.main'} variant="body2" sx={{ mb: 1 }}>
                                {cartMsg.text}
                            </Typography>
                        )}
                        <Button 
                            variant="contained" 
                            size="large" 
                            fullWidth 
                            startIcon={<CartIcon />}
                            disabled={!stockAvailable || addingToCart}
                            onClick={handleAddToCart}
                            sx={{ py: 1.5, fontSize: '1.1rem' }}
                        >
                            {addingToCart ? 'Adding...' : stockAvailable ? addToCartLabel : 'Out of Stock'}
                        </Button>
                    </Box>

                    <Divider sx={{ my: 4 }} />
                    
                    <Typography variant="h6" gutterBottom>Product Details</Typography>
                    <Box dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || '') }} sx={{ typography: 'body2', color: 'text.secondary', '& p': { mt: 0, mb: 2 } }} />
                    
                    {product.tags?.length > 0 && (
                        <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {product.tags.map(t => <Chip key={t.id} label={t.name} size="small" variant="outlined" />)}
                        </Box>
                    )}

                    <ReviewSection slug={product.slug} productId={product.id} />
                </Grid>
            </Grid>
        </Container>
    );
};

export default ProductDetailPage;
