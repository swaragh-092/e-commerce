import React, { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  Container,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import BoltIcon from '@mui/icons-material/Bolt';
import { Link } from 'react-router-dom';
import { getOptimizedMediaUrl } from '../../../utils/media';
import { resolveHeroGradient } from '../../../utils/styleMaps';
import StorefrontButton from '../StorefrontButton';
import { CanvasEditableText, CanvasEditableImage } from './SectionFallback';

const DEFAULT_HERO_IMAGE = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=80';

const imageUrl = (image, width = 1600) => getOptimizedMediaUrl(image || '', { width, quality: 82 }) || '';
const num = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const defaultSlides = [{
  eyebrow: 'Fresh drops, sharper prices',
  title: 'Shop the Latest',
  subtitle: 'Discover thousands of products at great prices.',
  buttonText: 'Shop Now',
  buttonLink: '/products',
  image: DEFAULT_HERO_IMAGE,
  color: '#ffffff',
}];

const buttonProps = ({ preview, link }) => (
  preview ? { component: 'button', type: 'button' } : { component: Link, to: link || '/products' }
);

const flexAlign = (align) => align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

const previewSelectionSx = (preview, onSelectComponent) => (
  preview && onSelectComponent
    ? { outline: '1px dashed transparent', '&:hover': { outlineColor: '#1976d2' } }
    : undefined
);

const HeroButtons = ({ slide, preview, overImage = false, size = 'large', align = 'left', onSelectComponent }) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4, justifyContent: flexAlign(align), alignItems: { xs: flexAlign(align), sm: 'center' } }}>
    {slide.buttonText && (preview || slide.buttonLink) && (
      <StorefrontButton
        {...buttonProps({ preview, link: slide.buttonLink })}
        role="primary"
        overImage={overImage}
        size={preview ? 'small' : size}
        endIcon={<ArrowForwardIcon />}
        onClick={preview && onSelectComponent ? (event) => { event.stopPropagation(); onSelectComponent('designTokens'); } : undefined}
        sx={previewSelectionSx(preview, onSelectComponent)}
      >
        {slide.buttonText}
      </StorefrontButton>
    )}
    {slide.secondaryButtonText && (preview || slide.secondaryButtonLink) && (
      <StorefrontButton
        {...buttonProps({ preview, link: slide.secondaryButtonLink })}
        role="secondary"
        overImage={overImage}
        size={preview ? 'small' : size}
        onClick={preview && onSelectComponent ? (event) => { event.stopPropagation(); onSelectComponent('designTokens'); } : undefined}
        sx={previewSelectionSx(preview, onSelectComponent)}
      >
        {slide.secondaryButtonText}
      </StorefrontButton>
    )}
  </Stack>
);

const HeroEyebrow = ({ slide, preview }) => (
  slide.eyebrow ? (
    <Chip
      label={slide.eyebrow}
      icon={<BoltIcon />}
      size={preview ? 'small' : 'medium'}
      sx={{
        mb: preview ? 1.5 : 2,
        bgcolor: 'rgba(255,255,255,0.18)',
        color: 'inherit',
        border: '1px solid rgba(255,255,255,0.25)',
        backdropFilter: 'blur(12px)',
      }}
    />
  ) : null
);

const HeroCopy = ({ section, slide, preview, align = 'left', color = 'inherit', active = 0, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const isCustomSlides = Array.isArray(section?.slides) && section.slides.length > active;
  const titleField = isCustomSlides ? `slides.${active}.title` : 'title';
  const subtitleField = isCustomSlides ? `slides.${active}.subtitle` : 'subtitle';

  return (
    <Box sx={{ textAlign: align, color }}>
      <HeroEyebrow slide={slide} preview={preview} />
      <CanvasEditableText
        section={section}
        field={titleField}
        preview={preview}
        onInlineFieldChange={onInlineFieldChange}
        onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
        variant={preview ? 'h3' : 'h1'}
        sx={{
          fontSize: preview
            ? { xs: '1.75rem', sm: '2rem' }
            : { xs: 'calc(var(--store-font-size-h1, 2.5rem) * 1.0)', md: 'calc(var(--store-font-size-h1, 2.5rem) * 1.1)' },
          lineHeight: 0.98,
          fontWeight: 950,
          maxWidth: align === 'center' ? 820 : 760,
          mx: align === 'center' ? 'auto' : 0,
        }}
      >
        {slide.title || 'Your Store Headline'}
      </CanvasEditableText>
      {(slide.subtitle || preview) && (
        <CanvasEditableText
          section={section}
          field={subtitleField}
          preview={preview}
          onInlineFieldChange={onInlineFieldChange}
          onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
          variant={preview ? 'body1' : 'h6'}
          sx={{
            mt: 2,
            maxWidth: align === 'center' ? 680 : 620,
            mx: align === 'center' ? 'auto' : 0,
            color: color === 'inherit' ? 'rgba(255,255,255,0.88)' : 'text.secondary',
            lineHeight: 1.55,
          }}
        >
          {slide.subtitle || 'Add supporting text'}
        </CanvasEditableText>
      )}
    </Box>
  );
};

const MediaPanel = ({
  slide,
  preview,
  section,
  field,
  onInlineFieldChange,
  onInlineFieldCommit,
  onInlineBlockFocus,
  seedPatch,
}) => {
  const content = (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: { xs: 260, md: 460 },
        backgroundImage: `url(${imageUrl(slide.image, preview ? 900 : 1400) || DEFAULT_HERO_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: slide.position || 'center',
      }}
      role="img"
      aria-label={slide.title || 'Hero image'}
    />
  );

  return (
    <CanvasEditableImage
      section={section}
      field={field}
      preview={preview}
      onInlineFieldChange={onInlineFieldChange}
      onInlineFieldCommit={onInlineFieldCommit}
      onInlineBlockFocus={onInlineBlockFocus}
      seedPatch={seedPatch}
      sx={{
        minHeight: { xs: 260, md: 460 },
        borderRadius: 5,
        overflow: 'hidden',
        bgcolor: 'action.hover',
        boxShadow: 8,
      }}
    >
      {content}
    </CanvasEditableImage>
  );
};

const OverlayHero = ({ section, slide, visibleSlides, active, preview, onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const image = imageUrl(slide.image, preview ? 900 : 1800) || DEFAULT_HERO_IMAGE;
  const align = section.textAlign || section.align || section.contentAlign || 'left';
  const centered = align === 'center';
  const right = align === 'right';

  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: { xs: 380, sm: 480, md: 560 },
        display: 'flex',
        alignItems: 'center',
        color: slide.color || '#ffffff',
      }}
    >
      {(preview ? [slide] : visibleSlides).map((s = {}, index) => (
        <Box key={index} sx={{ height: '100%', position: 'absolute', inset: 0, opacity: preview || active === index ? 1 : 0, transition: 'opacity 0.5s ease-in-out' }}>
          {preview ? (
            <CanvasEditableImage
              section={section}
              field={`slides.${active}.image`}
              preview={preview}
              onInlineFieldChange={onInlineFieldChange}
              onInlineFieldCommit={onInlineFieldCommit}
              onInlineBlockFocus={onInlineBlockFocus}
              seedPatch={{ slides: visibleSlides }}
              sx={{ position: 'absolute', inset: 0 }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: s.position || slide.position || 'center',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: resolveHeroGradient({
                      gradient: s.gradient ?? section.gradient,
                      aligned: centered ? 'center' : 'left',
                      overlayStart: s.overlayStart ?? section.overlayStart,
                      overlayMid:   s.overlayMid   ?? section.overlayMid,
                      overlayEnd:   s.overlayEnd   ?? section.overlayEnd,
                    }),
                  },
                }}
              />
            </CanvasEditableImage>
          ) : (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${imageUrl(s.image, 1800) || DEFAULT_HERO_IMAGE})`,
                backgroundSize: 'cover',
                backgroundPosition: s.position || slide.position || 'center',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background: resolveHeroGradient({
                    gradient: s.gradient ?? section.gradient,
                    aligned: centered ? 'center' : 'left',
                    overlayStart: s.overlayStart ?? section.overlayStart,
                    overlayMid:   s.overlayMid   ?? section.overlayMid,
                    overlayEnd:   s.overlayEnd   ?? section.overlayEnd,
                  }),
                },
              }}
            />
          )}
        </Box>
      ))}

      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, py: { xs: 6, md: 8 } }}>
        <Grid container spacing={4} alignItems="center" justifyContent={centered ? 'center' : right ? 'flex-end' : 'flex-start'}>
          <Grid item xs={12} md={centered ? 9 : 7} lg={centered ? 8 : 6}>
            <HeroCopy section={section} slide={slide} preview={preview} align={align} active={active} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />
            <Box sx={{ display: 'flex', justifyContent: flexAlign(align) }}>
              <HeroButtons
                slide={slide}
                preview={preview}
                overImage
                align={align}
                onSelectComponent={onSelectComponent}
              />
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

const SplitHero = ({ section, slide, preview, active, visibleSlides, onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const align = section.textAlign || section.align || section.contentAlign || 'left';
  return (
  <Box component="section" sx={{ bgcolor: 'background.paper', borderRadius: 5, overflow: 'hidden' }}>
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 7 } }}>
      <Grid container spacing={{ xs: 3, md: 6 }} alignItems="center" direction={slide.imagePosition === 'left' ? 'row-reverse' : 'row'}>
        <Grid item xs={12} md={6}>
          <HeroCopy section={section} slide={slide} preview={preview} align={align} active={active} color="text.primary" onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />
          <HeroButtons
            slide={slide}
            preview={preview}
            align={align}
            onSelectComponent={onSelectComponent}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <MediaPanel
            slide={slide}
            preview={preview}
            section={section}
            field={`slides.${active}.image`}
            onInlineFieldChange={onInlineFieldChange}
            onInlineFieldCommit={onInlineFieldCommit}
            onInlineBlockFocus={onInlineBlockFocus}
            seedPatch={{ slides: visibleSlides }}
          />
        </Grid>
      </Grid>
    </Container>
  </Box>
  );
};

const ProductSpotlightHero = ({ section, slide, preview, active, visibleSlides, onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const align = section.textAlign || section.align || section.contentAlign || 'left';
  return (
  <Box component="section" sx={{ bgcolor: 'background.default', borderRadius: 5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 7 } }}>
      <Grid container spacing={{ xs: 3, md: 6 }} alignItems="center">
        <Grid item xs={12} md={6}>
          <HeroCopy section={section} slide={slide} preview={preview} align={align} active={active} color="text.primary" onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />
          <HeroButtons
            slide={slide}
            preview={preview}
            align={align}
            onSelectComponent={onSelectComponent}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ position: 'relative', maxWidth: 520, mx: 'auto' }}>
            <MediaPanel
              slide={slide}
              preview={preview}
              section={section}
              field={`slides.${active}.image`}
              onInlineFieldChange={onInlineFieldChange}
              onInlineFieldCommit={onInlineFieldCommit}
              onInlineBlockFocus={onInlineBlockFocus}
              seedPatch={{ slides: visibleSlides }}
            />
            <Box sx={{ position: 'absolute', left: 18, bottom: 18, right: 18, p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', boxShadow: 4 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={800}>
                {slide.productLabel || 'Featured Product'}
              </Typography>
              <Typography variant="subtitle1" fontWeight={950}>
                {slide.productName || slide.title || 'Spotlight Item'}
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Container>
  </Box>
  );
};

const HeroSection = ({ section = {}, slides = [], mode = 'live', onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const [active, setActive] = useState(0);
  const preview = mode === 'preview';
  const hasCustomSlides = Array.isArray(section?.slides);
  const visibleSlides = hasCustomSlides
    ? section.slides
    : (Array.isArray(slides) && slides.length ? slides : defaultSlides);

  const canRotate = !preview && visibleSlides.length > 1;
  const interval = num(section?.interval, 6500);

  useEffect(() => {
    if (!canRotate || section?.autoPlay === false || !visibleSlides.length) return undefined;
    const timer = setInterval(() => setActive((current) => (current + 1) % visibleSlides.length), interval);
    return () => clearInterval(timer);
  }, [canRotate, interval, section?.autoPlay, visibleSlides.length]);

  if (!visibleSlides.length) {
    if (preview) {
      return (
        <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover', border: '1px dashed', borderColor: 'divider', borderRadius: 2, m: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Hero Carousel has no slides. Add a slide or reset to default content in the sidebar.
          </Typography>
        </Box>
      );
    }
    return null;
  }

  const safeActive = active < visibleSlides.length ? active : 0;
  const baseSlide = visibleSlides[safeActive] || visibleSlides[0] || {};
  // Slide headings are authoritative. Fall back to section title only if the slide has no title/heading.
  const slideTitle = (baseSlide.title !== undefined && baseSlide.title !== '')
    ? baseSlide.title
    : (baseSlide.heading !== undefined && baseSlide.heading !== '')
      ? baseSlide.heading
      : (section.title || '');
  const slideSubtitle = (baseSlide.subtitle !== undefined && baseSlide.subtitle !== '')
    ? baseSlide.subtitle
    : (baseSlide.text !== undefined && baseSlide.text !== '')
      ? baseSlide.text
      : (section.subtitle || '');
  const slide = {
    ...baseSlide,
    title: slideTitle,
    subtitle: slideSubtitle,
  };
  const variant = section.variant || section.heroVariant || slide.variant || 'overlay';
  const overlayLike = !['split', 'split-editorial', 'editorial', 'product-spotlight', 'spotlight'].includes(variant);

  const goTo = (direction) => setActive((current) => (current + direction + visibleSlides.length) % visibleSlides.length);

  const hero = (() => {
    if (variant === 'split' || variant === 'split-editorial' || variant === 'editorial') {
      return <SplitHero section={section} slide={slide} preview={preview} active={active} visibleSlides={visibleSlides} onSelectComponent={onSelectComponent} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />;
    }
    if (variant === 'product-spotlight' || variant === 'spotlight') {
      return <ProductSpotlightHero section={section} slide={slide} preview={preview} active={active} visibleSlides={visibleSlides} onSelectComponent={onSelectComponent} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />;
    }
    if (variant === 'centered') {
      return <OverlayHero section={{ ...section, align: 'center' }} slide={slide} visibleSlides={visibleSlides} active={active} preview={preview} onSelectComponent={onSelectComponent} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />;
    }
    return <OverlayHero section={section} slide={slide} visibleSlides={visibleSlides} active={active} preview={preview} onSelectComponent={onSelectComponent} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />;
  })();

  return (
    <Box sx={{ position: 'relative' }}>
      {!preview && (
        <Typography
          component="p"
          aria-live="polite"
          aria-atomic="true"
          sx={{
            border: 0,
            clip: 'rect(0 0 0 0)',
            height: 1,
            margin: -1,
            overflow: 'hidden',
            padding: 0,
            position: 'absolute',
            whiteSpace: 'nowrap',
            width: 1,
          }}
        >
          {`Slide ${active + 1} of ${visibleSlides.length}: ${slide.title || 'Homepage promotion'}`}
        </Typography>
      )}

      {hero}

      {canRotate && overlayLike && (
        <>
          <IconButton aria-label="Previous banner" onClick={() => goTo(-1)} sx={{ position: 'absolute', left: { xs: 12, md: 24 }, bottom: { xs: 18, md: 28 }, color: '#fff', bgcolor: 'rgba(0,0,0,0.26)', '&:hover': { bgcolor: 'rgba(0,0,0,0.42)' } }}>
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
          <IconButton aria-label="Next banner" onClick={() => goTo(1)} sx={{ position: 'absolute', left: { xs: 60, md: 76 }, bottom: { xs: 18, md: 28 }, color: '#fff', bgcolor: 'rgba(0,0,0,0.26)', '&:hover': { bgcolor: 'rgba(0,0,0,0.42)' } }}>
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        </>
      )}
    </Box>
  );
};

export default React.memo(HeroSection);
