import React from 'react';
import { Card, CardMedia, CardContent, Typography, Box, Rating, Chip } from '@mui/material';
import { Link } from 'react-router-dom';

const ProductCard = ({ product }) => {
    const primaryImage = product.images?.find(i => i.isPrimary)?.url || product.images?.[0]?.url || '/placeholder.png';
    const hasSale = product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price);

    return (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', textDecoration: 'none' }} component={Link} to={`/products/${product.slug}`}>
            <Box sx={{ position: 'relative', pt: '100%', backgroundColor: '#f5f5f5' }}>
                {hasSale && (
                    <Chip label="Sale" color="error" size="small" sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }} />
                )}
                <CardMedia
                    component="img"
                    image={primaryImage}
                    alt={product.name}
                    sx={{ position: 'absolute', top: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                />
            </Box>
            <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="body2" color="text.secondary" noWrap gutterBottom>
                    {product.categories?.[0]?.name}
                </Typography>
                <Typography variant="h6" component="div" noWrap sx={{ fontWeight: 600 }}>
                    {product.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Rating value={4.5} readOnly size="small" />
                    <Typography variant="body2" sx={{ ml: 1 }}>(12)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {hasSale ? (
                        <>
                            <Typography variant="h6" color="primary">${product.salePrice}</Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                ${product.price}
                            </Typography>
                        </>
                    ) : (
                        <Typography variant="h6">${product.price}</Typography>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};

export default ProductCard;
