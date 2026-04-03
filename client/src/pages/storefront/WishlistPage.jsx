import React, { useState, useEffect } from 'react';
import { Box, Typography, Container, Grid, Card, CardMedia, CardContent, CardActions, Button, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { wishlistService } from '../../services/wishlistService';
import { Link } from 'react-router-dom';
import { getMediaUrl } from '../../utils/media';
import { useFeature, useCurrency } from '../../hooks/useSettings';

const WishlistPage = () => {
    const wishlistEnabled = useFeature('wishlist');
    const { formatPrice } = useCurrency();
    if (!wishlistEnabled) {
        return (
            <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>Wishlist Unavailable</Typography>
                <Typography color="text.secondary">The wishlist feature is currently disabled.</Typography>
                <Button variant="contained" href="/products" sx={{ mt: 3 }}>Browse Products</Button>
            </Container>
        );
    }
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchWishlist = async () => {
        try {
            const data = await wishlistService.getWishlist();
            setItems(data);
        } catch (error) {
            console.error("Failed to load wishlist", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWishlist();
    }, []);

    const handleRemove = async (productId) => {
        try {
            await wishlistService.removeItem(productId);
            setItems(items.filter(item => item.productId !== productId));
        } catch (err) { }
    };

    const handleMoveToCart = async (productId) => {
        try {
            await wishlistService.moveToCart(productId);
            setItems(items.filter(item => item.productId !== productId));
        } catch (err) { }
    };

    if (loading) return <Container sx={{ py: 4 }}><Typography>Loading...</Typography></Container>;

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>My Wishlist</Typography>
            
            {items.length === 0 ? (
                <Typography>Your wishlist is currently empty.</Typography>
            ) : (
                <Grid container spacing={3}>
                    {items.map((item) => {
                        const product = item.Product;
                        const image = product?.images?.[0]?.url || '';
                        const imageUrl = getMediaUrl(image) || '/placeholder.png';

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
                                        <Typography color="text.secondary">
                                            {formatPrice(product.price)}
                                        </Typography>
                                    </CardContent>
                                    <CardActions sx={{ justifyContent: 'space-between' }}>
                                        <Button size="small" startIcon={<ShoppingCartIcon />} onClick={() => handleMoveToCart(product.id)}>
                                            Move to Cart
                                        </Button>
                                        <IconButton color="error" size="small" onClick={() => handleRemove(product.id)}>
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
