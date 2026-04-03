import React from 'react';
import {
    Box, Container, Typography, Button, Divider, IconButton,
    TextField, Paper, Chip, CircularProgress, Alert,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { getMediaUrl } from '../../utils/media';
import { useCurrency } from '../../hooks/useSettings';
import PageSEO from '../../components/common/PageSEO';

const CartPage = () => {
    const { cart, cartCount, loading, updateItem, removeItem, clearCart } = useCart();
    const { formatPrice } = useCurrency();
    const navigate = useNavigate();

    const items = cart?.items || [];
    const subtotal = items.reduce((sum, item) => {
        const price = parseFloat(item.product?.salePrice || item.product?.price || 0);
        const modifier = parseFloat(item.variant?.priceModifier ?? 0);
        return sum + (price + modifier) * item.quantity;
    }, 0);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (items.length === 0) {
        return (
            <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
                <PageSEO title="Cart" type="noindex" />
                <ShoppingBagIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h5" gutterBottom>Your cart is empty</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    Looks like you haven't added anything yet.
                </Typography>
                <Button variant="contained" component={Link} to="/products">
                    Browse Products
                </Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <PageSEO title="Cart" type="noindex" />
            <Typography variant="h4" fontWeight={700} mb={3}>Shopping Cart ({cartCount})</Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 340px' }, gap: 3 }}>
                {/* Items list */}
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    {items.map((item, idx) => {
                        const product = item.product;
                        const variant = item.variant;
                        const price = parseFloat(product?.salePrice || product?.price || 0);
                        const modifier = parseFloat(variant?.priceModifier ?? 0);
                        const itemPrice = price + modifier;
                        const imageUrl = getMediaUrl(product?.images?.[0]?.url || '') || '/placeholder.png';

                        return (
                            <React.Fragment key={item.id}>
                                {idx > 0 && <Divider />}
                                <Box sx={{ display: 'flex', gap: 2, p: 2, alignItems: 'center' }}>
                                    <Box
                                        component="img"
                                        src={imageUrl}
                                        alt={product?.name}
                                        sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
                                    />
                                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                        <Typography
                                            variant="body1"
                                            fontWeight={600}
                                            component={Link}
                                            to={`/products/${product?.slug}`}
                                            sx={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                                            noWrap
                                        >
                                            {product?.name}
                                        </Typography>
                                        {variant && (
                                            <Chip label={`${variant.name}: ${variant.value}`} size="small" sx={{ mt: 0.5 }} />
                                        )}
                                        <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ mt: 0.5 }}>
                                            {formatPrice(itemPrice)}
                                        </Typography>
                                    </Box>

                                    {/* Quantity controls */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => updateItem(item.id, item.quantity - 1)}
                                            disabled={item.quantity <= 1}
                                        >
                                            <RemoveIcon fontSize="small" />
                                        </IconButton>
                                        <Typography sx={{ minWidth: 28, textAlign: 'center' }}>{item.quantity}</Typography>
                                        <IconButton
                                            size="small"
                                            onClick={() => updateItem(item.id, item.quantity + 1)}
                                        >
                                            <AddIcon fontSize="small" />
                                        </IconButton>
                                    </Box>

                                    {/* Line total */}
                                    <Typography variant="body1" fontWeight={700} sx={{ minWidth: 70, textAlign: 'right', flexShrink: 0 }}>
                                        {formatPrice(itemPrice * item.quantity)}
                                    </Typography>

                                    {/* Remove */}
                                    <IconButton size="small" color="error" onClick={() => removeItem(item.id)}>
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </React.Fragment>
                        );
                    })}

                    <Divider />
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button size="small" color="error" onClick={clearCart}>Clear Cart</Button>
                    </Box>
                </Paper>

                {/* Order summary */}
                <Box>
                    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, position: 'sticky', top: 80 }}>
                        <Typography variant="h6" fontWeight={700} mb={2}>Order Summary</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography color="text.secondary">Subtotal ({cartCount} items)</Typography>
                            <Typography fontWeight={600}>{formatPrice(subtotal)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography color="text.secondary">Shipping</Typography>
                            <Typography color="text.secondary">Calculated at checkout</Typography>
                        </Box>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6" fontWeight={700}>Estimated Total</Typography>
                            <Typography variant="h6" fontWeight={700} color="primary.main">{formatPrice(subtotal)}</Typography>
                        </Box>
                        <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            onClick={() => navigate('/checkout')}
                            sx={{ py: 1.5 }}
                        >
                            Proceed to Checkout
                        </Button>
                        <Button
                            fullWidth
                            component={Link}
                            to="/products"
                            sx={{ mt: 1 }}
                        >
                            Continue Shopping
                        </Button>
                    </Paper>
                </Box>
            </Box>
        </Container>
    );
};

export default CartPage;
