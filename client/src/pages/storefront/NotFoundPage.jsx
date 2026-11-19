import React from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { Link } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings';

const storePath = (value, fallback) =>
    typeof value === 'string' && /^\/(?!\/)[^\\\s]*$/.test(value) ? value : fallback;

const NotFoundPage = () => {
    const { settings } = useSettings();
    const pageStyle = settings?.notFoundPage || {};

    return (
        <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
            <SearchOffIcon sx={{ fontSize: 100, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h2" component="div" fontWeight={800} gutterBottom>404</Typography>
            <Typography variant="h5" component="h1" gutterBottom>{pageStyle.headline || 'Page Not Found'}</Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                {pageStyle.subtext || "Sorry, the page you're looking for doesn't exist or has been moved."}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button variant="contained" component={Link} to={storePath(pageStyle.cta1Link, '/products')}>
                    {pageStyle.cta1Label || 'Browse Products'}
                </Button>
                <Button variant="outlined" component={Link} to={storePath(pageStyle.cta2Link, '/')}>
                    {pageStyle.cta2Label || 'Go Home'}
                </Button>
            </Box>
        </Container>
    );
};

export default NotFoundPage;
