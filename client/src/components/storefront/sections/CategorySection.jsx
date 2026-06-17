import React from 'react';
import { Box, Button, Card, CardActionArea, Skeleton, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link } from 'react-router-dom';
import { getOptimizedMediaUrl, imageLoadingProps } from '../../../utils/media';
import { useComponentStyles } from '../../../hooks/useSettings';
import { resolveRadius, resolveShadow } from '../../../utils/styleMaps';
import { CanvasEditableText, CanvasEditableImage } from './SectionFallback';


const imageUrl = (image) => getOptimizedMediaUrl(image || '', { width: 420, quality: 78 }) || '';

const ratioToCss = (ratio, fallback) => String(ratio || fallback).replace('/', ' / ');

const normalizeVariant = (variant) => {
  if (variant === 'image-tile') return 'image-tiles';
  return variant || 'image-tiles';
};

const hoverStyles = (effect, preview) => {
  if (preview || effect === 'none') return {};
  if (effect === 'zoom') return { '&:hover img': { transform: 'scale(1.06)' } };
  if (effect === 'fade') return { '&:hover': { opacity: 0.9 } };
  return { '&:hover': { transform: 'translateY(-4px)' }, '&:hover img': { transform: 'scale(1.035)' } };
};

const num = (value, fallback = 10) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const SectionHeader = ({ section, title, subtitle, actionLabel, actionLink, preview, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  if (!title && !subtitle && !(actionLabel && actionLink)) return null;
  const align = section?.textAlign || 'left';
  const stacked = align === 'center' || align === 'right';

  return (
    <Box sx={{ display: 'flex', flexDirection: stacked ? 'column' : 'row', alignItems: align === 'center'  ? 'center' : align === 'right'  ? 'flex-end' : { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 2.5, textAlign: align }}>
      <Box sx={{ width: stacked ? '100%' : undefined, textAlign: align }}>
        {title && (
          <CanvasEditableText section={section} field="title" preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} variant={preview ? 'h6' : 'h5'} sx={{ fontWeight: preview ? 800 : 900 }}>
            {title}
          </CanvasEditableText>
        )}
        {subtitle && (
          <CanvasEditableText section={section} field="subtitle" preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </CanvasEditableText>
        )}
      </Box>
      {actionLabel && actionLink && (
        <Button component={preview ? 'button' : Link} to={preview ? undefined : actionLink} endIcon={<ArrowForwardIcon />} size="small" type={preview ? 'button' : undefined}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

const placeholderTiles = (count) => Array.from({ length: count }).map((_, index) => ({
  id: `preview-category-${index}`,
  title: `Cat ${index + 1}`,
  link: '/products',
}));

const normalizeCategoryTiles = ({ categories = [], configuredTiles = [], count, preview }) => {
  if (Array.isArray(configuredTiles) && configuredTiles.length) return configuredTiles.slice(0, count);
  if (preview) return placeholderTiles(Math.min(count, 8));
  return (Array.isArray(categories) ? categories : []).slice(0, count).map((cat) => ({
    id: cat.id,
    title: cat.name,
    subtitle: cat.description,
    productCount: cat.productCount || cat.productsCount || cat.product_count,
    image: cat.image,
    link: `/category/${cat.slug}`,
  }));
};

const CategorySection = ({
  section = {},
  categories = [],
  configuredTiles = [],
  loading = false,
  mode = 'live',
  titleOverride = null,
  onSelectComponent,
  onInlineFieldChange,
  onInlineFieldCommit, onInlineBlockFocus,
}) => {
  const preview = mode === 'preview';
  const categoryCardStyle = useComponentStyles('categoryCard');
  const count = Math.min(num(section.count, preview ? 6 : 10), preview ? 8 : 16);
  const tiles = normalizeCategoryTiles({ categories, configuredTiles, count, preview });
  const variant = normalizeVariant(section.variant || categoryCardStyle.variant);
  const isChips = variant === 'compact-chips';
  const imageRatio = ratioToCss(categoryCardStyle.imageRatio, '1/1');
  const cardRadius = resolveRadius(categoryCardStyle.radius);
  const cardShadow = resolveShadow(categoryCardStyle.shadow);
  const titlePlacement = categoryCardStyle.titlePlacement || 'below';
  const isOverlay = titlePlacement === 'overlay' || titlePlacement === 'centered';
  const densityPadding = categoryCardStyle.density === 'compact' ? 0.75 : categoryCardStyle.density === 'spacious' ? 1.75 : 1.25;

  if (!loading && tiles.length === 0) return null;

  const seedPatch = { items: tiles };

  const gridSx = isChips
    ? { display: 'flex', flexWrap: 'wrap', gap: 1 }
    : variant === 'icon-grid'
      ? { display: 'grid', gridTemplateColumns: preview ? 'repeat(6, minmax(56px, 1fr))' : { xs: 'repeat(5, minmax(64px, 1fr))', sm: 'repeat(6, minmax(80px, 1fr))', md: 'repeat(12, minmax(72px, 1fr))' }, gap: categoryCardStyle.density === 'compact' ? { xs: 0.75, md: 1 } : { xs: 1, md: 1.25 } }
      : { display: 'grid', gridTemplateColumns: preview ? { xs: 'repeat(4, minmax(64px, 1fr))', sm: 'repeat(6, minmax(72px, 1fr))' } : { xs: 'repeat(4, minmax(76px, 1fr))', sm: 'repeat(5, minmax(110px, 1fr))', md: 'repeat(10, minmax(96px, 1fr))' }, gap: categoryCardStyle.density === 'spacious' ? { xs: 1.75, md: 2 } : { xs: 1.25, md: 1.5 }, overflowX: { xs: 'auto', md: 'visible' }, pb: { xs: 1, md: 0 } };

  return (
    <Box component="section">
      <SectionHeader
        section={section}
        title={titleOverride !== null ? titleOverride : section.title}
        subtitle={section.subtitle}
        actionLabel={section.actionLabel || section.viewAllLabel}
        actionLink={section.actionLink || section.viewAllLink}
        preview={preview}
        onInlineFieldChange={onInlineFieldChange}
        onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
      />
      <Box sx={gridSx}>
        {loading && !preview
          ? Array.from({ length: count }).map((_, index) => (
            <Box key={index}>
              <Skeleton variant="rounded" height={isChips ? 32 : 96} width={isChips ? 80 : undefined} sx={{ borderRadius: isChips ? 4 : 2 }} />
            </Box>
          ))
          : tiles.slice(0, count).map((tile, index) => {
            if (isChips) {
              const chipProps = preview ? {} : { component: Link, to: tile.link || '/products' };
              return (
                <Box
                  key={tile.id || `${tile.title}-${index}`}
                  {...chipProps}
                  onClick={(event) => {
                    if (!onSelectComponent) return;
                    event.stopPropagation();
                    onSelectComponent('categoryCard');
                  }}
                  sx={{ px: 2, py: 0.75, borderRadius: 5, bgcolor: 'action.hover', textDecoration: 'none', color: 'text.primary', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', cursor: onSelectComponent ? 'pointer' : undefined, '&:hover': preview ? (onSelectComponent ? { outline: '2px dashed #1976d2', outlineOffset: 2 } : {}) : { bgcolor: 'primary.main', color: 'primary.contrastText' } }}>
                  <CanvasEditableText section={section} field={`items.${index}.title`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} component="span">
                    {tile.title}
                  </CanvasEditableText>
                </Box>
              );
            }
            const actionProps = preview ? { component: 'div' } : { component: Link, to: tile.link || '/products' };
            return (
              <Card
                key={tile.id || `${tile.title}-${index}`}
                data-component="category-card"
                data-variant={variant}
                onClick={(event) => {
                  if (!onSelectComponent) return;
                  event.stopPropagation();
                  onSelectComponent('categoryCard');
                }}
                sx={{
                  boxShadow: cardShadow,
                  height: '100%',
                  borderRadius: cardRadius,
                  overflow: 'hidden',
                  transition: 'transform 0.22s ease, box-shadow 0.22s ease, opacity 0.22s ease',
                  cursor: onSelectComponent ? 'pointer' : undefined,
                  ...hoverStyles(categoryCardStyle.hoverEffect, preview),
                  '&:hover': onSelectComponent ? { outline: '2px dashed #1976d2', outlineOffset: 2 } : undefined,
                }}
              >
                <CardActionArea {...actionProps} sx={{ height: '100%', p: isOverlay ? 0 : densityPadding, textAlign: 'center', cursor: preview ? 'default' : 'pointer' }}>
                  <Box sx={{ width: '100%', aspectRatio: imageRatio, borderRadius: isOverlay ? 0 : cardRadius, overflow: 'hidden', bgcolor: tile.color || 'action.hover', display: 'grid', placeItems: 'center', position: 'relative' }}>
                    {preview ? (
                      <CanvasEditableImage
                        section={section}
                        field={`items.${index}.image`}
                        preview={preview}
                        onInlineFieldChange={onInlineFieldChange}
                        onInlineFieldCommit={onInlineFieldCommit}
                        onInlineBlockFocus={onInlineBlockFocus}
                        seedPatch={seedPatch}
                        sx={{ width: '100%', height: '100%' }}
                      >
                        {tile.image ? (
                          <Box component="img" src={imageUrl(tile.image)} alt={tile.title} {...imageLoadingProps()} sx={{ width: '100%', height: '100%', objectFit: categoryCardStyle.imageFit || 'cover', transition: 'transform 0.35s ease' }} />
                        ) : (
                          <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}>
                            <Typography variant="caption" sx={{ fontWeight: 950, color: 'text.secondary', visibility: isOverlay ? 'hidden' : 'visible' }}>
                              {tile.title}
                            </Typography>
                          </Box>
                        )}
                      </CanvasEditableImage>
                    ) : (
                      tile.image ? (
                        <Box component="img" src={imageUrl(tile.image)} alt={tile.title} {...imageLoadingProps()} sx={{ width: '100%', height: '100%', objectFit: categoryCardStyle.imageFit || 'cover', transition: 'transform 0.35s ease' }} />
                      ) : (
                        <Typography variant="h4" sx={{ fontWeight: 950, color: 'primary.main', visibility: isOverlay ? 'hidden' : 'visible' }}>
                          {tile.title?.[0] || '?'}
                        </Typography>
                      )
                    )}
                    {isOverlay && (
                      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: titlePlacement === 'centered' ? 'center' : 'flex-end', justifyContent: 'center', p: 1.25, background: 'linear-gradient(180deg, transparent 0%, var(--store-overlay-dark, rgba(15, 23, 42, 0.72)) 100%)' }}>
                        <CanvasEditableText section={section} field={`items.${index}.title`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant="body2" sx={{ fontWeight: 900, color: '#fff', textAlign: 'center' }}>
                          {tile.title}
                        </CanvasEditableText>
                      </Box>
                    )}
                  </Box>
                  {!isOverlay && (
                    <>
                      <CanvasEditableText section={section} field={`items.${index}.title`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant="body2" sx={{ mt: 1, fontWeight: 800, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: categoryCardStyle.showSubtitle ? 22 : 40 }}>
                        {tile.title}
                      </CanvasEditableText>
                      {categoryCardStyle.showSubtitle && (tile.subtitle || preview) && (
                        <CanvasEditableText section={section} field={`items.${index}.subtitle`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} noWrap>
                          {tile.subtitle || 'Shop collection'}
                        </CanvasEditableText>
                      )}
                      {categoryCardStyle.showProductCount && (tile.productCount != null || preview) && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                          {tile.productCount ?? 12} products
                        </Typography>
                      )}
                    </>
                  )}
                </CardActionArea>
              </Card>
            );
          })}
      </Box>
    </Box>
  );
};

export default React.memo(CategorySection);
