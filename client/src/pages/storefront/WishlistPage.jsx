import React, { useState, useEffect } from 'react';
import { Box, Typography, Container, Grid, Card, CardMedia, CardContent, CardActions, Button, IconButton, Chip, Stack } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { wishlistService } from '../../services/wishlistService';
import { Link } from 'react-router-dom';
import { getMediaUrl } from '../../utils/media';
import { useFeature, useCurrency } from '../../hooks/useSettings';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../hooks/useCart';
import { useNotification } from '../../context/NotificationContext';
import { getVariantDiscountPercent, getVariantRegularPrice, getVariantUnitPrice } from '../../utils/variantPricing';

const WishlistPage = () => {
    const wishlistEnabled = useFeature('wishlist');
    const { formatPrice } = useCurrency();
    const { refreshWishlist, wishlistCount } = useWishlist();
    const { fetchCart } = useCart();
    const notify = useNotification();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const displayItems = items.filter((item) => item?.Product?.id);

    if (!wishlistEnabled) {
        return (
            <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>Wishlist Unavailable</Typography>
                <Typography color="text.secondary">The wishlist feature is currently disabled.</Typography>
                <Button variant="contained" href="/products" sx={{ mt: 3 }}>Browse Products</Button>
            </Container>
        );
    }

    const fetchWishlist = async () => {
        try {
            setError(null);
            const response = await refreshWishlist();
            setItems(response.items || []);
        } catch (error) {
            console.error("Failed to load wishlist", error);
            setError(error?.response?.data?.error?.message || 'Failed to load wishlist.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWishlist();
    }, []);

    const handleRemove = async (productId, variantId = null) => {
        if (!productId) {
            setError('Wishlist item is invalid and cannot be removed.');
            return;
        }

        try {
            await wishlistService.removeItem(productId, variantId);
            setItems((prev) => prev.filter((item) => !(item.productId === productId && (item.variantId || item.variant?.id || null) === (variantId || null))));
            await refreshWishlist();
            notify('Item removed from wishlist.', 'info');
        } catch (err) {
            setError(err?.response?.data?.error?.message || 'Failed to remove item from wishlist.');
        }
    };

    const handleMoveToCart = async (wishlistItem) => {
        const productId = wishlistItem?.productId || wishlistItem?.Product?.id;

        if (!productId) {
            setError('Wishlist item is invalid and cannot be moved to cart.');
            return;
        }

        try {
            const variantId = wishlistItem.variantId || wishlistItem.variant?.id || null;
            await wishlistService.moveToCart(productId, variantId);
            setItems((prev) => prev.filter((item) => item.id !== wishlistItem.id));
            await Promise.all([refreshWishlist(), fetchCart()]);
            notify('Item moved to cart.', 'success');
        } catch (err) {
            setError(err?.response?.data?.error?.message || 'Failed to move item to cart.');
        }
    };

    const handleMoveAllToCart = async () => {
        try {
            const result = await wishlistService.moveAllToCart();
            await Promise.all([fetchWishlist(), fetchCart()]);
            notify(`${result?.movedCount || 0} wishlist item${result?.movedCount === 1 ? '' : 's'} moved to cart.`, 'success');
        } catch (err) {
            setError(err?.response?.data?.error?.message || 'Failed to move wishlist items to cart.');
        }
    };

    const handleClearWishlist = async () => {
        try {
            const result = await wishlistService.clearWishlist();
            await fetchWishlist();
            notify(`${result?.removedCount || 0} wishlist item${result?.removedCount === 1 ? '' : 's'} removed.`, 'info');
        } catch (err) {
            setError(err?.response?.data?.error?.message || 'Failed to clear wishlist.');
        }
    };

    if (loading) return <Container sx={{ py: 4 }}><Typography>Loading...</Typography></Container>;

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="h4">My Wishlist ({wishlistCount})</Typography>
                {displayItems.length > 0 && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button variant="outlined" startIcon={<ShoppingCartIcon />} onClick={handleMoveAllToCart}>
                            Move All to Cart
                        </Button>
                        <Button variant="text" color="error" onClick={handleClearWishlist}>
                            Clear Wishlist
                        </Button>
                    </Stack>
                )}
            </Box>
            {error && (
                <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
            )}
            
            {displayItems.length === 0 ? (
                <Typography>Your wishlist is currently empty.</Typography>
            ) : (
                <Grid container spacing={3}>
                    {displayItems.map((item) => {
                        const product = item.Product;
                        const variant = item.variant;
                        const image = product?.images?.[0]?.url || '';
                        const imageUrl = getMediaUrl(image) || '/placeholder.png';
                        const itemPrice = variant?.unitPrice ?? getVariantUnitPrice(product, variant);
                        const regularPrice = getVariantRegularPrice(product, variant);
                        const discountPercent = getVariantDiscountPercent(product, variant);
                        const inStock = item.availability?.inStock === true;

                        return (
                            <Grid item xs={12} sm={6} md={4} key={item.id}>
                                <Card>
                                    <CardMedia
                                        component="img"
                                        height="200"
                                        image={imageUrl}
                                        alt={product.name}
                                        sx={{ objectFit: 'cover' }}
                                    />
                                    <CardContent>
                                        <Typography gutterBottom variant="h6" component={Link} to={`/products/${product.slug}`} sx={{ textDecoration: 'none', color: 'inherit' }}>
                                            {product.name}
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                                            <Chip size="small" label={inStock ? 'In Stock' : 'Out of Stock'} color={inStock ? 'success' : 'default'} />
                                            {product?.isSaleActive && discountPercent > 0 && <Chip size="small" label={`${discountPercent}% OFF`} color="error" variant="outlined" />}
                                            {variant && <Chip size="small" label={`${variant.name}: ${variant.value}`} variant="outlined" />}
                                        </Stack>
                                        <Typography color="text.secondary">
                                            {formatPrice(itemPrice)}
                                            {product?.isSaleActive && regularPrice > 0 && itemPrice < regularPrice && (
                                                <Box component="span" sx={{ ml: 1, textDecoration: 'line-through', color: 'text.disabled' }}>
                                                    {formatPrice(regularPrice)}
                                                </Box>
                                            )}
                                        </Typography>
                                    </CardContent>
                                    <CardActions sx={{ justifyContent: 'space-between' }}>
                                        <Button size="small" startIcon={<ShoppingCartIcon />} onClick={() => handleMoveToCart(item)} disabled={!inStock}>
                                            Move to Cart
                                        </Button>
                                        <IconButton color="error" size="small" onClick={() => handleRemove(product?.id, variant?.id || null)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </CardActions>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}
        </Container>
    );
};

export default WishlistPage;
