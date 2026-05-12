import React, { useState, useEffect } from 'react';
import { Box, CardMedia, Grid, Typography } from '@mui/material';
import { getMediaUrl } from '../../utils/media';

const ProductImages = ({ images, variantImages = [], selectedVariantId, thumbnailAlignment = 'horizontal' }) => {
  const clamp = (value) => Math.min(100, Math.max(0, value));
  const imageKey = (img) => img.id || img.mediaId || img.media?.id || img.url;
  const isVertical = thumbnailAlignment === 'vertical';
  const thumbnailSize = isVertical ? 64 : 74;

  // Global product images should always remain visible for every selected variant.
  const productImages = [...(images || [])];
  const globalImages = productImages
    .filter((img) => !img.variantId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((img) => ({ ...img, scope: 'global', url: getMediaUrl(img.url || img.media?.url) || '/placeholder.png' }));

  const productLevelVariantImages = selectedVariantId
    ? productImages.filter((img) => img.variantId === selectedVariantId)
    : [];
  const rawVariantImages = variantImages?.length ? variantImages : productLevelVariantImages;
  const selectedVariantImages = [...rawVariantImages]
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((img) => ({ ...img, scope: 'variant', url: getMediaUrl(img.url || img.media?.url) || '/placeholder.png' }));
  const sortedImages = [...globalImages, ...selectedVariantImages]
    .filter((img, index, allImages) => allImages.findIndex((candidate) => imageKey(candidate) === imageKey(img)) === index);
  
  const variantDisplayImage = selectedVariantImages.find((i) => i.isPrimary) || selectedVariantImages[0];
  const globalDisplayImage = globalImages.find((i) => i.isPrimary) || globalImages[0];
  const primaryImage = variantDisplayImage || globalDisplayImage || sortedImages[0];
  const defaultImage = primaryImage?.url || '/placeholder.png';

  const [selectedImage, setSelectedImage] = useState(defaultImage);
  const [zoom, setZoom] = useState({ active: false, x: 50, y: 50 });

  useEffect(() => {
    setSelectedImage(defaultImage);
    setZoom({ active: false, x: 50, y: 50 });
  }, [defaultImage, selectedVariantId]); 

  const handleZoomMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100);
    setZoom({ active: true, x, y });
  };

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: { xs: 'column', md: isVertical ? 'row' : 'column' },
        gap: { xs: 1.25, md: isVertical ? 1.5 : 1.25 },
        alignItems: { xs: 'stretch', md: isVertical ? 'flex-start' : 'stretch' },
      }}
    >
      {sortedImages.length > 0 && isVertical && (
        <Box
          sx={{
            order: { xs: 2, md: 1 },
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            gap: 1,
            overflowX: { xs: 'auto', md: 'visible' },
            overflowY: { xs: 'visible', md: 'auto' },
            maxHeight: { md: 560 },
            pr: { md: 0.25 },
            pb: { xs: 0.5, md: 0 },
          }}
        >
          {sortedImages.map((img) => (
            <Box
              key={`${img.scope}-${img.id || img.url}`}
              onClick={() => setSelectedImage(img.url)}
              sx={{
                width: thumbnailSize,
                height: thumbnailSize,
                flex: '0 0 auto',
                position: 'relative',
                cursor: 'pointer',
                border: selectedImage === img.url ? '2px solid' : '1px solid',
                borderColor: selectedImage === img.url ? 'primary.main' : 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                backgroundColor: 'action.hover',
                boxShadow: selectedImage === img.url ? '0 0 0 3px rgba(108, 99, 255, 0.16)' : 'none',
              }}
            >
              <CardMedia
                component="img"
                image={img.url}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </Box>
          ))}
        </Box>
      )}
      <Box
        onMouseEnter={() => setZoom((prev) => ({ ...prev, active: true }))}
        onMouseMove={handleZoomMove}
        onMouseLeave={() => setZoom((prev) => ({ ...prev, active: false }))}
        sx={{
          order: { xs: 1, md: isVertical ? 2 : 1 },
          flex: 1,
          width: '100%',
          aspectRatio: '1 / 1',
          minHeight: { xs: 320, sm: 460, md: 560 },
          position: 'relative',
          backgroundColor: 'background.paper',
          borderRadius: 1.5,
          overflow: 'hidden',
          cursor: { xs: 'default', md: 'zoom-in' },
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 18px 48px rgba(15, 23, 42, 0.12)',
        }}
      >
        <CardMedia
          component="img"
          image={selectedImage}
          sx={{
            position: 'absolute',
            top: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            p: { xs: 1, md: 2 },
            transition: 'transform 180ms ease',
            transform: { xs: 'none', md: zoom.active ? 'scale(1.035)' : 'scale(1)' },
          }}
        />
        <Box
          sx={{
            display: { xs: 'none', md: zoom.active ? 'block' : 'none' },
            position: 'absolute',
            width: 128,
            height: 128,
            left: `calc(${zoom.x}% - 64px)`,
            top: `calc(${zoom.y}% - 64px)`,
            border: '2px solid',
            borderColor: 'primary.main',
            bgcolor: 'rgba(124, 92, 255, 0.12)',
            boxShadow: '0 0 0 999px rgba(0,0,0,0.02)',
            pointerEvents: 'none',
          }}
        />
        <Typography
          variant="caption"
          sx={{
            display: { xs: 'none', md: zoom.active ? 'none' : 'block' },
            position: 'absolute',
            left: '50%',
            bottom: 12,
            transform: 'translateX(-50%)',
            px: 1.25,
            py: 0.5,
            borderRadius: 99,
            bgcolor: 'rgba(0,0,0,0.58)',
            color: '#fff',
            pointerEvents: 'none',
          }}
        >
          Hover to zoom
        </Typography>
      </Box>
      <Box
        sx={{
          display: { xs: 'none', md: zoom.active ? 'block' : 'none' },
          position: 'absolute',
          left: isVertical ? 'calc(100% + 20px)' : 'calc(100% + 20px)',
          top: 0,
          width: { md: 360, lg: 480 },
          height: { md: 420, lg: 520 },
          zIndex: 30,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          backgroundImage: `url(${selectedImage})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '260% 260%',
          backgroundPosition: `${zoom.x}% ${zoom.y}%`,
          boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
        }}
      />
      {sortedImages.length > 0 && !isVertical && (
        <Grid container spacing={1} sx={{ order: 2 }}>
          {sortedImages.map((img) => (
            <Grid item key={`${img.scope}-${img.id || img.url}`}>
              <Box
                onClick={() => setSelectedImage(img.url)}
                sx={{
                  width: { xs: 68, sm: thumbnailSize, md: thumbnailSize },
                  height: { xs: 68, sm: thumbnailSize, md: thumbnailSize },
                  position: 'relative',
                  cursor: 'pointer',
                  border: selectedImage === img.url ? '2px solid' : '1px solid',
                  borderColor: selectedImage === img.url ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                  backgroundColor: 'action.hover',
                  boxShadow: selectedImage === img.url ? '0 0 0 3px rgba(108, 99, 255, 0.16)' : 'none',
                }}
              >
                <CardMedia
                  component="img"
                  image={img.url}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default ProductImages;
