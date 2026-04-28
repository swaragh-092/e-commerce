import React from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Link, useLocation } from 'react-router-dom';

const PaymentSuccessPage = () => {
    const location = useLocation();
    const query = new URLSearchParams(location.search);
    const orderId = location.state?.orderId || query.get('orderId');

    return (
        <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 96, color: 'success.main', mb: 2 }} />
            <Typography variant="h4" fontWeight={700} gutterBottom>Order Placed!</Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                Thank you for your order! Your order has been placed successfully. <br />
                We’re processing it now and will keep you updated on its status.
                {orderId && ` Order reference: #${orderId}`}
                
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button variant="contained" component={Link} to="/account">View Orders</Button>
                <Button variant="outlined" component={Link} to="/products">Continue Shopping</Button>
            </Box>
        </Container>
    );
};

export default PaymentSuccessPage;
