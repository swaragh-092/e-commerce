import React, { useEffect } from 'react';
import { keyframes } from '@emotion/react';
import { Box, Container, Typography, Button, Paper, Stack, Chip, Divider } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';

const floatUp = keyframes`
    from {
        opacity: 0;
        transform: translate3d(0, 18px, 0) scale(0.96);
    }
    to {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
    }
`;

const checkPop = keyframes`
    0% {
        opacity: 0;
        transform: scale(0.45) rotate(-12deg);
    }
    60% {
        opacity: 1;
        transform: scale(1.12) rotate(3deg);
    }
    100% {
        opacity: 1;
        transform: scale(1) rotate(0deg);
    }
`;

const ringPulse = keyframes`
    0% {
        opacity: 0.45;
        transform: scale(0.72);
    }
    100% {
        opacity: 0;
        transform: scale(1.55);
    }
`;

const confettiDrop = keyframes`
    0% {
        opacity: 0;
        transform: translateY(-24px) rotate(0deg);
    }
    18% {
        opacity: 1;
    }
    100% {
        opacity: 0;
        transform: translateY(96px) rotate(190deg);
    }
`;

const confettiPieces = [
    { left: '15%', top: 8, color: '#67e8f9', delay: '0.05s', rotate: '12deg' },
    { left: '26%', top: 0, color: '#f9a8d4', delay: '0.2s', rotate: '-18deg' },
    { left: '38%', top: 14, color: '#fde68a', delay: '0.12s', rotate: '30deg' },
    { left: '58%', top: 4, color: '#86efac', delay: '0.28s', rotate: '-28deg' },
    { left: '72%', top: 16, color: '#c4b5fd', delay: '0.16s', rotate: '18deg' },
    { left: '84%', top: 2, color: '#fb7185', delay: '0.34s', rotate: '-10deg' },
];

const PaymentSuccessPage = () => {
    const location = useLocation();
    const { fetchCart } = useCart();
    const query = new URLSearchParams(location.search);
    const orderId = location.state?.orderId || query.get('orderId');
    const isCod = location.state?.isCod;
    const orderDetailPath = orderId ? `/account/orders/${orderId}` : '/orders';

    useEffect(() => {
        fetchCart();
    }, [fetchCart]);

    return (
        <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
            <Paper
                elevation={0}
                sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    px: { xs: 2.5, sm: 5 },
                    py: { xs: 4, sm: 5 },
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    textAlign: 'center',
                    background:
                        'linear-gradient(180deg, rgba(34,197,94,0.10) 0%, rgba(255,255,255,0.025) 42%, rgba(255,255,255,0.015) 100%)',
                    animation: `${floatUp} 520ms ease-out both`,
                }}
            >
                {confettiPieces.map((piece, index) => (
                    <Box
                        key={index}
                        sx={{
                            position: 'absolute',
                            left: piece.left,
                            top: piece.top,
                            width: 9,
                            height: 15,
                            borderRadius: '2px',
                            bgcolor: piece.color,
                            opacity: 0,
                            transform: `rotate(${piece.rotate})`,
                            animation: `${confettiDrop} 1.8s ease-in-out ${piece.delay} both`,
                        }}
                    />
                ))}

                <Box
                    sx={{
                        position: 'relative',
                        mx: 'auto',
                        mb: 2.5,
                        width: 108,
                        height: 108,
                        display: 'grid',
                        placeItems: 'center',
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 6,
                            borderRadius: '50%',
                            border: '2px solid',
                            borderColor: 'success.main',
                            animation: `${ringPulse} 1.5s ease-out 220ms both`,
                        }}
                    />
                    <Box
                        sx={{
                            width: 88,
                            height: 88,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: 'rgba(34, 197, 94, 0.12)',
                            border: '1px solid',
                            borderColor: 'success.main',
                            boxShadow: '0 18px 44px rgba(34, 197, 94, 0.18)',
                            animation: `${checkPop} 620ms cubic-bezier(.2,.9,.2,1.2) both`,
                        }}
                    >
                        <CheckCircleOutlineIcon sx={{ fontSize: 58, color: 'success.main' }} />
                    </Box>
                </Box>

                <Chip
                    label={isCod ? 'Cash on delivery order confirmed' : 'Payment successful'}
                    color="success"
                    variant="outlined"
                    sx={{ mb: 2, fontWeight: 700 }}
                />

                <Typography variant="h3" component="h1" fontWeight={800} sx={{ fontSize: { xs: 30, sm: 42 }, mb: 1 }}>
                    Order Placed!
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 560, mx: 'auto', mb: 3, lineHeight: 1.7 }}>
                    Thank you for your order. We are getting it ready now and will keep you updated as it moves forward.
                    {orderId && ` Order reference: #${orderId}`}
                </Typography>

                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    justifyContent="center"
                    sx={{ mb: 4 }}
                >
                    <Button variant="contained" size="large" component={Link} to="/orders" startIcon={<ReceiptLongIcon />}>
                        View Orders
                    </Button>
                    <Button variant="outlined" size="large" component={Link} to="/products" startIcon={<ShoppingBagOutlinedIcon />}>
                        Continue Shopping
                    </Button>
                </Stack>

                <Divider sx={{ mb: 3 }} />

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                        gap: 1.5,
                        textAlign: 'left',
                    }}
                >
                    {[
                        { title: 'Order received', text: 'Your order is safely in our system.', icon: <CheckCircleOutlineIcon /> },
                        { title: 'Preparing items', text: 'We will pack and process your products.', icon: <ShoppingBagOutlinedIcon /> },
                        { title: 'Delivery updates', text: 'Tracking details will appear in your orders.', icon: <LocalShippingOutlinedIcon /> },
                    ].map((item) => (
                        <Box
                            key={item.title}
                            component={Link}
                            to={orderDetailPath}
                            sx={{
                                display: 'flex',
                                gap: 1.25,
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: 'action.hover',
                                border: '1px solid',
                                borderColor: 'divider',
                                color: 'inherit',
                                textDecoration: 'none',
                                transition: 'transform 160ms ease, border-color 160ms ease, background-color 160ms ease',
                                '&:hover, &:focus-visible': {
                                    transform: 'translateY(-2px)',
                                    borderColor: 'success.main',
                                    bgcolor: 'rgba(34, 197, 94, 0.08)',
                                    outline: 'none',
                                },
                            }}
                        >
                            <Box sx={{ color: 'success.main', display: 'flex', mt: 0.25 }}>
                                {item.icon}
                            </Box>
                            <Box>
                                <Typography variant="body2" fontWeight={800}>{item.title}</Typography>
                                <Typography variant="caption" color="text.secondary">{item.text}</Typography>
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Paper>
        </Container>
    );
};

export default PaymentSuccessPage;
