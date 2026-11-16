import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useFeature } from '../../../hooks/useSettings';
import { galleryService } from '../../../services/galleryService';
import { getOptimizedMediaUrl } from '../../../utils/media';
import { CanvasEditableText, SectionFrame } from './SectionFallback';

const GallerySection = ({ frameProps }) => {
  const { section, preview, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus } = frameProps;
  const enabled = useFeature('gallery');
  const slug = section.gallerySlug;
  const count = Math.min(50, Math.max(1, Number.parseInt(section.count, 10) || 8));
  const [result, setResult] = useState(null);
  const current = result?.slug === slug && result?.count === count ? result : null;

  useEffect(() => {
    if (!enabled || !slug) return undefined;
    let cancelled = false;
    galleryService.getPublic(slug, { limit: count })
      .then(({ items }) => {
        if (!cancelled) setResult({ slug, count, items: items.filter(({ media }) => media?.url) });
      })
      .catch(() => {
        if (!cancelled) setResult({ slug, count, items: [], unavailable: true });
      });
    return () => { cancelled = true; };
  }, [enabled, slug, count]);

  if (!enabled || !slug || !current?.items.length) {
    if (!preview) return null;
    let message = 'Choose an album in the section settings.';
    if (!enabled) message = 'Enable Gallery in Features to display this section.';
    else if (slug && !current) message = 'Loading album…';
    else if (current?.unavailable) message = 'Album unavailable. Choose an active album in the section settings.';
    else if (slug) message = 'Add images to this album to display it on the storefront.';
    return <SectionFrame {...frameProps}><Typography color="text.secondary" role="status">{message}</Typography></SectionFrame>;
  }

  return (
    <SectionFrame {...frameProps}>
      <CanvasEditableText
        section={section}
        field="title"
        preview={preview}
        onInlineFieldChange={onInlineFieldChange}
        onInlineFieldCommit={onInlineFieldCommit}
        onInlineBlockFocus={onInlineBlockFocus}
        variant="h5"
        sx={{ mb: 2 }}
      >
        {section.title || 'Gallery'}
      </CanvasEditableText>
      {section.subtitle && <Typography color="text.secondary" sx={{ mb: 2 }}>{section.subtitle}</Typography>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
        {current.items.map(({ id, media }) => (
          <Box
            key={id}
            component="img"
            src={getOptimizedMediaUrl(media.url, { width: 640, quality: 80 })}
            alt={media.alt || media.caption || ''}
            loading="lazy"
            decoding="async"
            sx={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 1 }}
          />
        ))}
      </Box>
    </SectionFrame>
  );
};

export default GallerySection;
