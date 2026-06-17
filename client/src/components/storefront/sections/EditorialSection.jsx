import React from 'react';
import { Box, Button, Card, Chip, Grid, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link } from 'react-router-dom';
import { getOptimizedMediaUrl } from '../../../utils/media';
import { CanvasEditableText, CanvasEditableImage } from './SectionFallback';

const imageUrl = (image) => getOptimizedMediaUrl(image || '', { width: 1200, quality: 82 }) || '';

const EditorialSection = ({ section = {}, mode = 'live', onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const preview = mode === 'preview';
  const image = imageUrl(section.image);
  const variant = section.variant || (section.imagePosition === 'left' ? 'image-left' : 'image-right');
  const reverse = variant === 'image-left' || section.imagePosition === 'left';
  const overlap = variant === 'overlap-card';
  const cta = section.ctaText || section.buttonText;
  const link = section.ctaLink || section.buttonLink || '/products';
  const align = section.textAlign || 'left';
  const alignItems = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

  const imageSx = {
    aspectRatio: preview ? '4 / 3' : undefined,
    minHeight: preview ? undefined : { xs: 280, md: overlap ? 520 : 420 },
    borderRadius: preview ? 3 : 4,
    overflow: 'hidden',
    bgcolor: 'action.hover',
    backgroundImage: image ? 'url(' + image + ')' : 'linear-gradient(135deg, rgba(0,0,0,0.06), rgba(0,0,0,0.14))',
    backgroundSize: 'cover',
    backgroundPosition: section.imageFocus || 'center',
  };

  const copy = (
    <Box sx={{ textAlign: align, display: 'flex', flexDirection: 'column', alignItems }}>
      {section.eyebrow && <Chip label={section.eyebrow} color="primary" variant="outlined" size={preview ? 'small' : 'medium'} sx={{ mb: 2 }} />}
      <CanvasEditableText
        section={section}
        field="title"
        preview={preview}
        onInlineFieldChange={onInlineFieldChange}
        onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
        variant={preview ? 'h5' : 'h3'}
        sx={{ fontWeight: preview ? 900 : 950, lineHeight: 1.05, width: '100%' }}
      >
        {section.title || 'A Better Way To Shop'}
      </CanvasEditableText>
      {(section.subtitle || preview) && (
        <CanvasEditableText
          section={section}
          field="subtitle"
          preview={preview}
          onInlineFieldChange={onInlineFieldChange}
          onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
          variant={preview ? 'body2' : 'body1'}
          color="text.secondary"
          sx={{ mt: preview ? 1 : 2, maxWidth: 620, width: '100%' }}
        >
          {section.subtitle || 'Add a short editorial description'}
        </CanvasEditableText>
      )}
      {cta && (
        <Button
          component={preview ? 'button' : Link}
          to={preview ? undefined : link}
          variant="contained"
          size={preview ? 'small' : 'large'}
          endIcon={<ArrowForwardIcon />}
          onClick={preview && onSelectComponent ? (event) => { event.stopPropagation(); onSelectComponent('designTokens'); } : undefined}
          sx={{ mt: preview ? 2 : 3, ...(preview && onSelectComponent ? { outline: '1px dashed transparent', '&:hover': { outlineColor: '#1976d2' } } : {}) }}
          type={preview ? 'button' : undefined}
        >
          {cta}
        </Button>
      )}
    </Box>
  );

  if (overlap) {
    return (
      <Box component="section" sx={{ position: 'relative', py: preview ? 0 : { xs: 2, md: 4 } }}>
        <CanvasEditableImage
          section={section}
          field="image"
          preview={preview}
          onInlineFieldChange={onInlineFieldChange}
          onInlineFieldCommit={onInlineFieldCommit}
          onInlineBlockFocus={onInlineBlockFocus}
          sx={imageSx}
          role={image ? 'img' : undefined}
          aria-label={section.title || 'Editorial image'}
        />
        <Card
          sx={{
            mt: { xs: -4, md: 0 },
            ml: { xs: 2, md: 'auto' },
            mr: { xs: 2, md: 6 },
            p: preview ? 2.5 : { xs: 2.5, md: 4 },
            maxWidth: { xs: 'calc(100% - 32px)', md: 520 },
            position: { md: 'absolute' },
            right: { md: 0 },
            top: { md: '50%' },
            transform: { md: 'translateY(-50%)' },
            borderRadius: preview ? 3 : 4,
            boxShadow: preview ? 2 : 8,
          }}
        >
          {copy}
        </Card>
      </Box>
    );
  }

  return (
    <Box component="section">
      <Grid container spacing={{ xs: 3, md: preview ? 3 : 5 }} alignItems="center" direction={reverse ? 'row-reverse' : 'row'}>
        <Grid item xs={12} md={6}>
          <CanvasEditableImage
            section={section}
            field="image"
            preview={preview}
            onInlineFieldChange={onInlineFieldChange}
            onInlineFieldCommit={onInlineFieldCommit}
            onInlineBlockFocus={onInlineBlockFocus}
            sx={imageSx}
            role={image ? 'img' : undefined}
            aria-label={section.title || 'Editorial image'}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          {copy}
        </Grid>
      </Grid>
    </Box>
  );
};

export default React.memo(EditorialSection);
