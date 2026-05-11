import React from 'react';
import { Box, Typography, Chip, Skeleton, Avatar } from '@mui/material';
import { Link } from 'react-router-dom';
import { getMediaUrl } from '../../utils/media';

/**
 * BrandStrip — horizontal brand chip strip for the homepage.
 * Links each brand to the filtered product list page.
 */
const BrandStrip = ({ title, brands = [], loading = false }) => {
    if (!loading && brands.length === 0) return null;

    return (
        <Box sx={{ mb: 6 }}>
            <Typography variant="h5" fontWeight={800} mb={3}>{title}</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} variant="rounded" width={90} height={36} />
                    ))
                    : brands.map((brand) => (
                        <Chip
                            key={brand.id}
                            label={brand.name}
                            component={Link}
                            to={`/products?brand=${brand.slug}`}
                            clickable
                            avatar={
                                <Avatar 
                                    src={brand.image ? getMediaUrl(brand.image) : ''} 
                                    alt={brand.name}
                                    sx={{ 
                                        bgcolor: 'primary.light', 
                                        color: 'primary.contrastText',
                                        fontWeight: 800,
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    {brand.name?.[0]?.toUpperCase()}
                                </Avatar>
                            }
                            variant="outlined"
                            size="medium"
                            sx={{
                                fontSize: '0.875rem',
                                py: 2.5,
                                px: 0.5,
                                fontWeight: 700,
                                borderRadius: '12px',
                                bgcolor: 'background.paper',
                                borderColor: 'divider',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    borderColor: 'primary.main',
                                    transform: 'translateY(-2px)',
                                    boxShadow: 2,
                                },
                            }}
                        />
                    ))
                }
            </Box>
        </Box>
    );
};

export default BrandStrip;
