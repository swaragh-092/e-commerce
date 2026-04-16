import React from 'react';
import {
    Box, Typography, Grid, Card, CardActionArea, CardMedia, CardContent, Skeleton,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { getMediaUrl } from '../../utils/media';

/**
 * CategoryGrid — rich category section for the homepage.
 * Shows category image + name cards in a responsive grid.
 */
const CategoryGrid = ({ title, categories = [], loading = false }) => {
    if (!loading && categories.length === 0) return null;

    return (
        <Box sx={{ mb: 6 }}>
            <Typography variant="h5" fontWeight={700} mb={3}>{title}</Typography>
            <Grid container spacing={2}>
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <Grid item xs={6} sm={4} md={2} key={i}>
                            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
                            <Skeleton sx={{ mt: 1 }} width="70%" />
                        </Grid>
                    ))
                    : categories.slice(0, 12).map((cat) => (
                        <Grid item xs={6} sm={4} md={2} key={cat.id}>
                            <Card
                                component={Link}
                                to={`/products?category=${cat.slug}`}
                                sx={{
                                    textDecoration: 'none',
                                    height: '100%',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    '&:hover': {
                                        transform: 'translateY(-3px)',
                                        boxShadow: 4,
                                    },
                                }}
                            >
                                <CardActionArea>
                                    {cat.image ? (
                                        <CardMedia
                                            component="img"
                                            image={getMediaUrl(cat.image)}
                                            alt={cat.name}
                                            sx={{ height: 100, objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <Box sx={{
                                            height: 100,
                                            background: (theme) =>
                                                `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Typography
                                                variant="h4"
                                                sx={{ color: 'white', opacity: 0.6, fontWeight: 800 }}
                                            >
                                                {cat.name?.[0] || '?'}
                                            </Typography>
                                        </Box>
                                    )}
                                    <CardContent sx={{ p: 1.5, pb: '12px !important' }}>
                                        <Typography
                                            variant="body2"
                                            fontWeight={600}
                                            noWrap
                                            align="center"
                                        >
                                            {cat.name}
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))
                }
            </Grid>
        </Box>
    );
};

export default CategoryGrid;
