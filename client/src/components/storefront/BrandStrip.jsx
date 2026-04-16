import React from 'react';
import { Box, Typography, Chip, Skeleton } from '@mui/material';
import { Link } from 'react-router-dom';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';

/**
 * BrandStrip — horizontal brand chip strip for the homepage.
 * Links each brand to the filtered product list page.
 */
const BrandStrip = ({ title, brands = [], loading = false }) => {
    if (!loading && brands.length === 0) return null;

    return (
        <Box sx={{ mb: 6 }}>
            <Typography variant="h5" fontWeight={700} mb={3}>{title}</Typography>
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
                            icon={<LocalOfferOutlinedIcon fontSize="small" />}
                            variant="outlined"
                            size="medium"
                            sx={{
                                fontSize: '0.875rem',
                                py: 2,
                                px: 0.5,
                                fontWeight: 500,
                                transition: 'all 0.2s',
                                '&:hover': {
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    borderColor: 'primary.main',
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
