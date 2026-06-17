import React from 'react';
import { Box, Button, Card, CardActionArea, Grid, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link } from 'react-router-dom';
import { getOptimizedMediaUrl, imageLoadingProps } from '../../../utils/media';
import { useComponentStyles } from '../../../hooks/useSettings';
import { resolveRadius, resolveShadow } from '../../../utils/styleMaps';
import { CanvasEditableText, CanvasEditableImage } from './SectionFallback';

const DEFAULT_PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=600&q=80';

const DEFAULT_BANNERS = [
  { title: 'Limited Offer', subtitle: 'Fresh deals and curated picks.', ctaText: 'Shop Now', link: '/products', color: '#fff7ed', accentColor: '#f97316' },
  { title: 'New Arrivals', subtitle: 'Browse what just landed.', ctaText: 'Explore', link: '/products?sort=newest', color: '#ecfeff', accentColor: '#0891b2' },
  { title: 'Featured Edit', subtitle: 'Handpicked products for your shoppers.', ctaText: 'View Edit', link: '/products?featured=true', color: '#f0fdf4', accentColor: '#16a34a' },
];

const imageUrl = (image) => getOptimizedMediaUrl(image || '', { width: 520, quality: 80 }) || '';


const SectionHeader = ({ section, title, subtitle, align = 'left', preview, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  if (!title && !subtitle && !preview) return null;
  return (
    <Box sx={{ mb: 2, textAlign: align }}>
      <CanvasEditableText section={section} field="title" preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} variant="h6" sx={{ fontWeight: 900 }}>
        {title || 'Promotions'}
      </CanvasEditableText>
      {(subtitle || preview) && (
        <CanvasEditableText section={section} field="subtitle" preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} variant="body2" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {subtitle || 'Add a short promotion description'}
        </CanvasEditableText>
      )}
    </Box>
  );
};

const PromoBannerSection = ({ section = {}, banners = DEFAULT_BANNERS, mode = 'live', onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const items = Array.isArray(section.items) && section.items.length
    ? section.items
    : (Array.isArray(banners) && banners.length ? banners : DEFAULT_BANNERS);

  if (!items.length) return null;

  const preview = mode === 'preview';
  const promoCardStyle = useComponentStyles('promoCard');
  const variant = section.variant || promoCardStyle.variant || 'cards';
  const cardRadius = resolveRadius(promoCardStyle.radius, resolveRadius('large'));
  const cardShadow = resolveShadow(promoCardStyle.shadow, resolveShadow('soft'));
  const imagePlacement = promoCardStyle.imagePlacement || 'right';
  const titleVariant = promoCardStyle.titleSize === 'small' ? 'subtitle1' : promoCardStyle.titleSize === 'medium' ? 'h6' : 'h5';
  const showButton = promoCardStyle.ctaStyle !== 'hidden';
  const align = section.textAlign || 'left';
  const seedPatch = { items };

  const getGridSize = (index) => {
    if (variant === 'banner-stack') return 12;
    if (variant === 'asymmetric') return index === 0 ? 12 : 6;
    return items.length === 2 ? 6 : 4;
  };

  return (
    <Box component="section" sx={{ textAlign: align }}>
      <SectionHeader section={section} title={section.title} subtitle={section.subtitle} align={align} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />
      <Grid container spacing={2}>
        {items.map((banner, index) => {
          const actionProps = preview
            ? { component: 'div' }
            : { component: Link, to: banner.link || '/products' };

          return (
            <Grid item xs={12} md={getGridSize(index)} key={`${banner.title || 'promo'}-${index}`}>
              <Card
                data-component="promo-card"
                data-variant={variant}
                onClick={(event) => {
                  if (!onSelectComponent) return;
                  event.stopPropagation();
                  onSelectComponent('promoCard');
                }}
                sx={{
                  height: '100%',
                  overflow: 'hidden',
                  borderRadius: cardRadius,
                  boxShadow: preview ? cardShadow : cardShadow,
                  bgcolor: banner.color || 'background.paper',
                  backgroundImage: banner.image && imagePlacement === 'background' ? `linear-gradient(rgba(255,255,255,0.78), rgba(255,255,255,0.78)), url(${imageUrl(banner.image)})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: banner.position || 'center',
                  border: '1px solid',
                  borderColor: banner.accentColor || 'var(--store-color-border)',
                  cursor: onSelectComponent ? 'pointer' : undefined,
                  '&:hover': onSelectComponent ? { outline: '2px dashed #1976d2', outlineOffset: 2 } : undefined,
                }}
              >
                <CardActionArea
                  {...actionProps}
                  sx={{
                    minHeight: preview ? 140 : 190,
                    p: preview ? 2 : 2.5,
                    display: 'flex',
                    flexDirection: imagePlacement === 'left' ? 'row-reverse' : imagePlacement === 'top' ? 'column-reverse' : 'row',
                    alignItems: 'stretch',
                    justifyContent: 'space-between',
                    gap: 2,
                    color: 'inherit',
                    cursor: preview ? 'default' : 'pointer',
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, textAlign: align, alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
                    <Box>
                      {banner.kicker && (
                        <CanvasEditableText section={section} field={`items.${index}.kicker`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant="caption" sx={{ color: banner.accentColor || 'primary.main', fontWeight: 900 }}>
                          {banner.kicker}
                        </CanvasEditableText>
                      )}
                      <CanvasEditableText section={section} field={`items.${index}.title`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant={preview ? 'subtitle1' : titleVariant} sx={{ mt: 0.5, fontWeight: preview ? 800 : 950, color: 'text.primary' }}>
                        {banner.title}
                      </CanvasEditableText>
                      {(banner.subtitle || preview) && (
                        <CanvasEditableText section={section} field={`items.${index}.subtitle`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant={preview ? 'caption' : 'body2'} color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          {banner.subtitle || 'Add promotion text'}
                        </CanvasEditableText>
                      )}
                    </Box>
                    {showButton && (
                      <Button
                        component="span"
                        size="small"
                        endIcon={promoCardStyle.ctaStyle === 'text-link' ? <ArrowForwardIcon /> : undefined}
                        variant={promoCardStyle.ctaStyle === 'button' ? 'contained' : 'text'}
                        sx={{ mt: 2, alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start', color: promoCardStyle.ctaStyle === 'button' ? undefined : banner.accentColor || 'primary.main' }}
                      >
                        <CanvasEditableText section={section} field={`items.${index}.ctaText`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} component="span">
                          {banner.ctaText || 'Shop Now'}
                        </CanvasEditableText>
                      </Button>
                    )}
                  </Box>
                  {imagePlacement !== 'background' && (banner.image || preview) && (
                    <CanvasEditableImage
                      section={section}
                      field={`items.${index}.image`}
                      preview={preview}
                      onInlineFieldChange={onInlineFieldChange}
                      onInlineFieldCommit={onInlineFieldCommit}
                      onInlineBlockFocus={onInlineBlockFocus}
                      seedPatch={seedPatch}
                      sx={{
                        width: imagePlacement === 'top' ? '100%' : 112,
                        height: imagePlacement === 'top' ? 120 : 140,
                        alignSelf: 'center',
                      }}
                    >
                      <Box
                        component="img"
                        src={imageUrl(banner.image) || DEFAULT_PLACEHOLDER_IMAGE}
                        alt={banner.title || 'Promotion'}
                        {...imageLoadingProps()}
                        sx={{
                          width: '100%',
                          height: '100%',
                          borderRadius: cardRadius,
                          objectFit: 'cover',
                        }}
                      />
                    </CanvasEditableImage>
                  )}
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default React.memo(PromoBannerSection);
