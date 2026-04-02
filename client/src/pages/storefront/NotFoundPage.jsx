import React from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { Link } from 'react-router-dom';

const NotFoundPage = () => (
    <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <SearchOffIcon sx={{ fontSize: 100, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h2" fontWeight={800} gutterBottom>404</Typography>
        <Typography variant="h5" gutterBottom>Page Not Found</Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
            Sorry, the page you're looking for doesn't exist or has been moved.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" component={Link} to="/">Go Home</Button>
            <Button variant="outlined" component={Link} to="/products">Browse Products</Button>
        </Box>
    </Container>
);

export default NotFoundPage;
