import React, { useRef } from 'react';
import { Avatar, Box, ButtonBase, IconButton, Skeleton, Stack, Typography, alpha } from '@mui/material';
import { Link } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { getMediaUrl } from '../../utils/media';
import { useScrollState } from '../../hooks/useScrollState';
import { useComponentStyles } from '../../hooks/useSettings';
import { resolveRadius, resolveShadow } from '../../utils/styleMaps';
import { CanvasEditableText } from './sections/SectionFallback';


/**
 * BrandStrip — horizontal brand chip strip for the homepage.
 * Links each brand to the filtered product list page.
 */
const BrandStrip = ({ title, section = {}, brands = [], loading = false, align = 'left', mode = 'live', onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
    const scrollerRef = useRef(null);
    const brandCardStyle = useComponentStyles('brandCard');
    const { canScrollLeft, canScrollRight } = useScrollState(scrollerRef, [brands.length, loading], { threshold: 4 });
    const canScroll = canScrollLeft || canScrollRight;
    const preview = mode === 'preview';
    const cardRadius = resolveRadius(brandCardStyle.radius);
    const cardShadow = resolveShadow(brandCardStyle.shadow);
    const isLogoOnly = brandCardStyle.variant === 'logo-only';
    const hoverEffect = brandCardStyle.hoverEffect || 'lift';

    if (!loading && brands.length === 0) return null;

    const scrollBrands = (direction) => {
        const node = scrollerRef.current;
        if (!node) return;
        node.scrollBy({
            left: direction * Math.max(260, node.clientWidth * 0.7),
            behavior: 'auto',
        });
    };

    return (
        <Box
            sx={{
                mb: 7,
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(200px, 260px) minmax(0, 1fr)' },
                    gap: { xs: 2, md: 2.5 },
                    alignItems: 'center',
                    bgcolor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.92 : 0.96),
                    borderRadius: 3,
                    px: { xs: 2, md: 3 },
                    py: { xs: 2.25, md: 3 },
                    overflow: 'hidden',
                    boxShadow: '0 18px 45px rgba(31, 26, 18, 0.06)',
                    border: '1px solid rgba(29, 92, 72, 0.08)',
                }}
            >
                <Box sx={{ 
                    pr: { md: 1 }, 
                    textAlign: align,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
                    width: '100%'
                }}>
                    <Typography
                        variant="overline"
                        sx={{
                            color: 'primary.main',
                            fontWeight: 900,
                            letterSpacing: 0,
                            lineHeight: 1,
                        }}
                    >
                        Trusted & loved
                    </Typography>
                    <CanvasEditableText
                        section={section}
                        field="title"
                        preview={preview}
                        onInlineFieldChange={onInlineFieldChange}
                        onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
                        variant="h5"
                        sx={{ mt: 0.6, lineHeight: 1.12, width: '100%', fontWeight: 900 }}
                    >
                        {title}
                    </CanvasEditableText>
                    <CanvasEditableText
                        section={section}
                        field="subtitle"
                        preview={preview}
                        onInlineFieldChange={onInlineFieldChange}
                        onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1.4, maxWidth: 210, lineHeight: 1.65, width: '100%' }}
                    >
                        {section.subtitle || 'Shop from our handpicked brands you can trust.'}
                    </CanvasEditableText>
                    <Stack
                        component={Link}
                        to="/brands"
                        direction="row"
                        alignItems="center"
                        spacing={0.8}
                        sx={{
                            mt: 2.2,
                            width: 'fit-content',
                            color: 'primary.contrastText',
                            bgcolor: 'primary.main',
                            borderRadius: 999,
                            px: 2,
                            py: 1,
                            textDecoration: 'none',
                            boxShadow: '0 10px 20px rgba(0, 121, 107, 0.18)',
                            '&:hover': { bgcolor: 'primary.dark' },
                        }}
                    >
                        <Typography variant="body2" fontWeight={900}>Explore All Brands</Typography>
                        <ArrowForwardIcon sx={{ fontSize: 17 }} />
                    </Stack>
                </Box>
                <Box sx={(theme) => ({ 
                    position: 'relative', 
                    minWidth: 0, 
                    px: { xs: 0, md: canScroll ? 4 : 0 },
                    '&::after': canScroll ? { 
                        content: '""', 
                        display: 'block', 
                        position: 'absolute', 
                        top: 0, 
                        bottom: 0, 
                        right: 0, 
                        width: theme.spacing(4), 
                        background: `linear-gradient(to left, ${alpha(theme.palette.background.paper, 0.95)}, transparent)`, 
                        pointerEvents: 'none', 
                        zIndex: 1 
                    } : {},
                })}>
                {canScroll && (
                    <IconButton
                        size="small"
                        aria-label="Previous brands"
                        onClick={() => scrollBrands(-1)}
                        sx={{
                            display: { xs: 'none', md: 'inline-flex' },
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 2,
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            bgcolor: 'background.paper',
                            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.10)',
                            '&:hover': { bgcolor: 'rgba(0, 121, 107, 0.06)' },
                        }}
                    >
                        <ChevronLeftIcon />
                    </IconButton>
                )}
                <Box
                    ref={scrollerRef}
                    sx={{
                        display: 'flex',
                        gap: { xs: 1.5, md: 2 },
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        scrollSnapType: 'x proximity',
                        py: 0.5,
                        px: { xs: 0, md: 0.5 },
                        scrollbarWidth: 'none',
                        '&::-webkit-scrollbar': { display: 'none' },
                    }}
                >
                {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <Box key={i} sx={{ width: isLogoOnly ? 118 : 150, flex: '0 0 auto' }}>
                            <Skeleton variant="rounded" width="100%" height={126} sx={{ borderRadius: 2 }} />
                        </Box>
                    ))
                    : brands.map((brand) => {
                        const actionProps = preview
                            ? { component: 'div' }
                            : { component: Link, to: `/products?brand=${brand.slug}` };
                        return (
                        <ButtonBase
                            key={brand.id}
                            {...actionProps}
                            data-component="brand-card"
                            data-variant={isLogoOnly ? 'logo-only' : 'standard'}
                            sx={{
                                width: isLogoOnly ? { xs: 116, sm: 124, md: 132 } : { xs: 142, sm: 150, md: 154 },
                                flex: '0 0 auto',
                                scrollSnapAlign: 'start',
                                display: 'block',
                                textAlign: 'center',
                                color: 'text.primary',
                                textDecoration: 'none',
                                borderRadius: cardRadius,
                                p: isLogoOnly ? 1 : 1.4,
                                minHeight: isLogoOnly ? 96 : 126,
                                bgcolor: 'background.paper',
                                boxShadow: cardShadow,
                                position: 'relative',
                                overflow: 'hidden',
                                border: '1px solid rgba(29, 92, 72, 0.06)',
                                transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, opacity 0.22s ease',
                                '&:hover': {
                                    borderColor: 'rgba(29, 92, 72, 0.16)',
                                    transform: hoverEffect === 'lift' ? 'translateY(-4px)' : 'none',
                                    opacity: hoverEffect === 'fade' ? 0.9 : 1,
                                },
                            }}
                        >
                            <Box
                                className="brand-stage"
                                sx={{
                                    width: '100%',
                                    height: isLogoOnly ? 54 : 70,
                                    borderRadius: Math.max(1, cardRadius - 0.5),
                                    bgcolor: 'transparent',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                <Avatar
                                    className="brand-logo"
                                    src={brand.image ? getMediaUrl(brand.image) : ''}
                                    alt={brand.name}
                                    variant="square"
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        position: 'absolute',
                                        left: '50%',
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        bgcolor: 'transparent',
                                        color: 'primary.main',
                                        fontWeight: 900,
                                        fontSize: '2rem',
                                        '& img': {
                                            objectFit: 'contain',
                                        },
                                    }}
                                >
                                    {brand.name?.[0]?.toUpperCase()}
                                </Avatar>
                            </Box>
                            {!isLogoOnly && (
                                <Box sx={{ minWidth: 0, px: 0.25, pt: 1.15 }}>
                                    <Typography
                                        fontWeight={800}
                                        noWrap
                                        sx={{ fontSize: '0.82rem', lineHeight: 1.2 }}
                                    >
                                        {brand.name}
                                    </Typography>
                                </Box>
                            )}
                        </ButtonBase>
                        );
                    })
                }
                </Box>
                {canScroll && (
                    <IconButton
                        size="small"
                        aria-label="Next brands"
                        onClick={() => scrollBrands(1)}
                        sx={{
                            display: { xs: 'none', md: 'inline-flex' },
                            position: 'absolute',
                            right: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 2,
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            bgcolor: 'background.paper',
                            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.10)',
                            '&:hover': { bgcolor: 'rgba(0, 121, 107, 0.06)' },
                        }}
                    >
                        <ChevronRightIcon />
                    </IconButton>
                )}
                </Box>
            </Box>
        </Box>
    );
};

export default BrandStrip;
