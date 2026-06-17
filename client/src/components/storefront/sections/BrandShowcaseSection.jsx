import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BrandStrip from '../BrandStrip';
import { useComponentStyles } from '../../../hooks/useSettings';
import { resolveRadius, resolveShadow } from '../../../utils/styleMaps';

const previewBrands = ['NOVA', 'ATLAS', 'AURA', 'MONO', 'LUXE', 'CRAFT', 'FRESH', 'CORE'];


const num = (value, fallback = 8) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const PreviewBrandCard = ({ title, style, onSelectComponent }) => {
  const radius = resolveRadius(style.radius);
  const shadow = resolveShadow(style.shadow);
  const isLogoOnly = style.variant === 'logo-only';

  return (
    <Box
      data-component="brand-card"
      data-variant={isLogoOnly ? 'logo-only' : 'standard'}
      onClick={(event) => {
        if (!onSelectComponent) return;
        event.stopPropagation();
        onSelectComponent('brandCard');
      }}
      sx={{
        width: isLogoOnly ? 92 : 112,
        height: isLogoOnly ? 54 : 72,
        borderRadius: radius,
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: shadow,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease',
        cursor: onSelectComponent ? 'pointer' : undefined,
        '&:hover': onSelectComponent ? { outline: '2px dashed #1976d2', outlineOffset: 2 } : (style.hoverEffect === 'lift' ? { transform: 'translateY(-3px)' } : {}),
      }}
    >
      <Typography variant="caption" fontWeight={900} color="text.secondary">
        {title}
      </Typography>
    </Box>
  );
};

const BrandShowcaseSection = ({
  section = {},
  brands = [],
  loading = false,
  mode = 'live',
  onSelectComponent,
  onInlineFieldChange,
  onInlineFieldCommit, onInlineBlockFocus,
}) => {
  const preview = mode === 'preview';
  const count = Math.min(num(section.count, preview ? 6 : 12), preview ? 8 : 24);
  const align = section.textAlign || 'left';

  if (!preview) {
    return (
      <BrandStrip
        title={section.title || 'Featured Brands'}
        section={section}
        brands={brands.slice(0, count)}
        loading={loading}
        align={align}
        mode={mode}
        onInlineFieldChange={onInlineFieldChange}
        onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
      />
    );
  }

  const items = Array.isArray(section.items) && section.items.length
    ? section.items.slice(0, count)
    : previewBrands.slice(0, count).map((name) => ({ name }));

  const mockBrands = items.map((item, index) => ({
    id: item.id || `preview-brand-${index}`,
    name: item.name || item.title || item,
    slug: item.slug || `preview-brand-${index}`,
    image: item.image || item.logo || '',
  }));

  return (
    <Box
      onClick={(event) => {
        if (!onSelectComponent) return;
        event.stopPropagation();
        onSelectComponent('brandCard');
      }}
      sx={{
        cursor: 'pointer',
        position: 'relative',
        '&:hover': onSelectComponent ? {
          outline: '2px dashed #1976d2',
          outlineOffset: 2,
        } : undefined,
      }}
    >
      <BrandStrip
        title={section.title || 'Featured Brands'}
        section={section}
        brands={mockBrands}
        loading={false}
        align={align}
        mode={mode}
        onInlineFieldChange={onInlineFieldChange}
        onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
      />
    </Box>
  );
};

export default React.memo(BrandShowcaseSection);
