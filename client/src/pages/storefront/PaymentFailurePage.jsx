import React from 'react';
import { Container, Typography, Button, Box } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Link, useNavigate } from 'react-router-dom';

const PaymentFailurePage = () => {
    const navigate = useNavigate();

    return (
        <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
            <ErrorOutlineIcon sx={{ fontSize: 96, color: 'error.main', mb: 2 }} />
            <Typography variant="h4" fontWeight={700} gutterBottom>Payment Failed</Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                We were unable to process your payment. Your order has not been charged.
                Please check your payment details and try again.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button variant="contained" onClick={() => navigate(-1)}>Try Again</Button>
                <Button variant="outlined" component={Link} to="/cart">Back to Cart</Button>
            </Box>
        </Container>
    );
};

export default PaymentFailurePage;
