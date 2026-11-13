import React, { useEffect, useState } from 'react';
import { Box, Card, CardMedia, Grid, Skeleton, Typography } from '@mui/material';
import { galleryService } from '../../../services/galleryService';

const unwrap = (value) => value?.data ?? value;
export default function GalleryGridSection({ section = {}, mode = 'live' }) {
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!section.gallerySlug || mode === 'preview') return undefined;
    let active = true;
    setLoading(true);
    galleryService.getPublic(section.gallerySlug)
      .then((result) => { if (active) setGallery(unwrap(result)); })
      .catch(() => { if (active) setGallery(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section.gallerySlug, mode]);
  const items = (gallery?.items || gallery?.images || []).slice(0, Number(section.count) || 8);
  return <Box component="section" sx={{ py: 4 }}>
    <Typography variant="h4" sx={{ mb: 2 }}>{section.title || gallery?.title || 'Gallery'}</Typography>
    {!section.gallerySlug && mode !== 'preview' && <Typography color="text.secondary">Choose a published gallery in the section settings.</Typography>}
    <Grid container spacing={2}>
      {loading && Array.from({ length: Math.min(Number(section.count) || 8, 8) }, (_, index) =>
        <Grid item xs={6} sm={4} md={3} key={index}><Skeleton variant="rounded" height={180} /></Grid>)}
      {items.map((item, index) => {
        const image = item.media || item.image || item;
        const src = image.url || image.src || image.thumbnailUrl;
        return <Grid item xs={6} sm={4} md={3} key={item.id || src || index}>
          <Card elevation={0}><CardMedia component="img" image={src || ''} alt={image.alt || item.alt || ''}
            sx={{ aspectRatio: '1 / 1', objectFit: 'cover' }} /></Card>
        </Grid>;
      })}
    </Grid>
  </Box>;
}
