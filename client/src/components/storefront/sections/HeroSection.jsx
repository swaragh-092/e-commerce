import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import BoltIcon from '@mui/icons-material/Bolt';
import { Link } from 'react-router-dom';
import { getOptimizedMediaUrl } from '../../../utils/media';
import { useSettings } from '../../../hooks/useSettings';
import { resolveHeroGradient } from '../../../utils/styleMaps';
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

const HeroButtons = ({ slide, preview, primarySx, secondarySx, size = 'large', align = 'left', onSelectComponent }) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4, justifyContent: flexAlign(align), alignItems: { xs: flexAlign(align), sm: 'center' } }}>
    {slide.buttonText && (preview || slide.buttonLink) && (
      <Button
        {...buttonProps({ preview, link: slide.buttonLink })}
        variant="contained"
        size={preview ? 'small' : size}
        endIcon={<ArrowForwardIcon />}
        onClick={preview && onSelectComponent ? (event) => { event.stopPropagation(); onSelectComponent('designTokens'); } : undefined}
        sx={{ ...primarySx, ...(preview && onSelectComponent ? { outline: '1px dashed transparent', '&:hover': { outlineColor: '#1976d2' } } : {}) }}
      >
        {slide.buttonText}
      </Button>
    )}
    {slide.secondaryButtonText && (preview || slide.secondaryButtonLink) && (
      <Button
        {...buttonProps({ preview, link: slide.secondaryButtonLink })}
        variant="outlined"
        size={preview ? 'small' : size}
        onClick={preview && onSelectComponent ? (event) => { event.stopPropagation(); onSelectComponent('designTokens'); } : undefined}
        sx={{ ...secondarySx, ...(preview && onSelectComponent ? { outline: '1px dashed transparent', '&:hover': { outlineColor: '#1976d2' } } : {}) }}
      >
        {slide.secondaryButtonText}
      </Button>
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

const HeroCopy = ({ section, slide, preview, align = 'left', color = 'inherit', onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => (
  <Box sx={{ textAlign: align, color }}>
    <HeroEyebrow slide={slide} preview={preview} />
    <CanvasEditableText
      section={section}
      field="title"
      preview={preview}
      onInlineFieldChange={onInlineFieldChange}
      onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
      variant={preview ? 'h3' : 'h1'}
      sx={{
        // Hero title scales with the theme's --store-font-size-h1 token so
        // admins choosing a "compact" or "editorial" scale see a consistent
        // hierarchy. The clamp() expression is sized up ~10% for hero
        // emphasis, but is still driven by the admin-configured scale.
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
        field="subtitle"
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

const OverlayHero = ({ section, slide, visibleSlides, active, preview, theme, buttonStyle, onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const image = imageUrl(slide.image, preview ? 900 : 1800) || DEFAULT_HERO_IMAGE;
  const align = section.textAlign || section.align || section.contentAlign || 'left';
  const centered = align === 'center';
  const right = align === 'right';

  // Hero overlay sits on a dark image, so we keep contrast with white. The
  // admin's buttonStyle still controls fill/outline so the CTA matches the
  // rest of the store's button language — see issue M3.
  const primaryHeroSx = (() => {
    if (buttonStyle === 'outline') {
      return {
        bgcolor: 'transparent',
        color: '#ffffff',
        border: '2px solid #ffffff',
        px: 3,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
      };
    }
    if (buttonStyle === 'soft') {
      return {
        bgcolor: 'rgba(255,255,255,0.18)',
        color: '#ffffff',
        px: 3,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' },
      };
    }
    return {
      bgcolor: '#ffffff',
      color: theme.palette.primary.dark,
      px: 3,
      '&:hover': { bgcolor: theme.palette.secondary.light },
    };
  })();

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
            <HeroCopy section={section} slide={slide} preview={preview} align={align} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />
            <Box sx={{ display: 'flex', justifyContent: flexAlign(align) }}>
              <HeroButtons
                slide={slide}
                preview={preview}
                primarySx={primaryHeroSx}
                secondarySx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.55)', px: 3, '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.12)' } }}
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

const SplitHero = ({ section, slide, preview, theme, active, visibleSlides, onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const align = section.textAlign || section.align || section.contentAlign || 'left';
  return (
  <Box component="section" sx={{ bgcolor: 'background.paper', borderRadius: 5, overflow: 'hidden' }}>
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 7 } }}>
      <Grid container spacing={{ xs: 3, md: 6 }} alignItems="center" direction={slide.imagePosition === 'left' ? 'row-reverse' : 'row'}>
        <Grid item xs={12} md={6}>
          <HeroCopy section={section} slide={slide} preview={preview} align={align} color="text.primary" onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />
          <HeroButtons
            slide={slide}
            preview={preview}
            primarySx={{ px: 3 }}
            secondarySx={{ px: 3, borderColor: theme.palette.divider, color: 'text.primary' }}
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

const ProductSpotlightHero = ({ section, slide, preview, theme, active, visibleSlides, onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const align = section.textAlign || section.align || section.contentAlign || 'left';
  return (
  <Box component="section" sx={{ bgcolor: 'background.default', borderRadius: 5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 7 } }}>
      <Grid container spacing={{ xs: 3, md: 6 }} alignItems="center">
        <Grid item xs={12} md={6}>
          <HeroCopy section={section} slide={slide} preview={preview} align={align} color="text.primary" onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />
          <HeroButtons
            slide={slide}
            preview={preview}
            primarySx={{ px: 3 }}
            secondarySx={{ px: 3, borderColor: theme.palette.divider, color: 'text.primary' }}
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
  const theme = useTheme();
  const { settings } = useSettings();
  const preview = mode === 'preview';
  const visibleSlides = Array.isArray(slides) && slides.length ? slides : defaultSlides;
  const baseSlide = visibleSlides[active] || visibleSlides[0] || {};
  const slide = preview ? { ...baseSlide, title: section.title || baseSlide.title, subtitle: section.subtitle || baseSlide.subtitle } : baseSlide;
  const canRotate = !preview && visibleSlides.length > 1;
  const interval = num(section.interval, 6500);
  const variant = section.variant || section.heroVariant || slide.variant || 'overlay';
  const overlayLike = !['split', 'split-editorial', 'editorial', 'product-spotlight', 'spotlight'].includes(variant);
  const buttonStyle = settings?.theme?.buttonStyle || 'solid';

  useEffect(() => {
    if (!canRotate || section.autoPlay === false) return undefined;
    const timer = setInterval(() => setActive((current) => (current + 1) % visibleSlides.length), interval);
    return () => clearInterval(timer);
  }, [canRotate, interval, section.autoPlay, visibleSlides.length]);

  const goTo = (direction) => setActive((current) => (current + direction + visibleSlides.length) % visibleSlides.length);

  const hero = (() => {
    if (variant === 'split' || variant === 'split-editorial' || variant === 'editorial') {
      return <SplitHero section={section} slide={slide} preview={preview} theme={theme} active={active} visibleSlides={visibleSlides} onSelectComponent={onSelectComponent} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />;
    }
    if (variant === 'product-spotlight' || variant === 'spotlight') {
      return <ProductSpotlightHero section={section} slide={slide} preview={preview} theme={theme} active={active} visibleSlides={visibleSlides} onSelectComponent={onSelectComponent} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />;
    }
    if (variant === 'centered') {
      return <OverlayHero section={{ ...section, align: 'center' }} slide={slide} visibleSlides={visibleSlides} active={active} preview={preview} theme={theme} buttonStyle={buttonStyle} onSelectComponent={onSelectComponent} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />;
    }
    return <OverlayHero section={section} slide={slide} visibleSlides={visibleSlides} active={active} preview={preview} theme={theme} buttonStyle={buttonStyle} onSelectComponent={onSelectComponent} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} />;
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
