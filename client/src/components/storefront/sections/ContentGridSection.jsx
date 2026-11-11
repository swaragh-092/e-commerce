import React, { useRef, useState } from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Box, Card, CardContent, Grid, IconButton, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { Link as RouterLink } from 'react-router-dom';
import { getOptimizedMediaUrl, imageLoadingProps } from '../../../utils/media';
import { isExternalUrl } from '../../../utils/urls';
import { CanvasEditableText, CanvasEditableImage } from './SectionFallback';

const imageUrl = (image) => getOptimizedMediaUrl(image || '', { width: 360, quality: 78 }) || '';

const buildFallbackItems = (fallbackTitle, count, preview) => {
  const max = Math.min(Number.parseInt(count || 3, 10) || 3, preview ? 6 : 8);
  return Array.from({ length: max }).map((_, index) => ({
    title: `${fallbackTitle} ${index + 1}`,
    text: preview ? 'Template-ready content block.' : 'Template-ready storefront content.',
  }));
};

const FaqAccordion = ({ section, items, preview, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus, seedPatch }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Box>
      {items.map((item, index) => (
        <Accordion
          key={item.title || index}
          expanded={preview ? false : expanded === index}
          onChange={(_, isExpanded) => !preview && setExpanded(isExpanded ? index : false)}
          disableGutters
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', '&:not(:last-child)': { borderBottom: 0 }, '&::before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <CanvasEditableText section={section} field={`items.${index}.title`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant="subtitle2" sx={{ fontWeight: 800 }}>
              {item.title}
            </CanvasEditableText>
          </AccordionSummary>
          <AccordionDetails>
            <CanvasEditableText section={section} field={`items.${index}.text`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant="body2" color="text.secondary">
              {item.text}
            </CanvasEditableText>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

const ContentGridSection = ({ section = {}, fallbackTitle = 'Content', kind = 'card', mode = 'live', onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const carouselRef = useRef(null);
  const preview = mode === 'preview';
  const logo = kind === 'logo';
  const isFaq = section.type === 'faq' || kind === 'faq';
  const isTestimonial = section.type === 'testimonials';
  const variant = isTestimonial && ['quote-wall', 'carousel'].includes(section.variant) ? section.variant : 'cards';
  const items = Array.isArray(section.items) && section.items.length
    ? section.items
    : (preview || isFaq) ? buildFallbackItems(fallbackTitle, section.count, preview) : [];

  if (!items.length) return null;

  const limit = logo ? (preview ? 6 : 8) : 6;
  const align = section.textAlign || 'left';
  const seedPatch = { items };
  const scrollCarousel = (direction) => carouselRef.current?.scrollBy({ left: direction * carouselRef.current.clientWidth, behavior: 'smooth' });

  const renderItem = (item, index) => {
    const link = typeof item.link === 'string' ? item.link.trim() : '';
    const external = isExternalUrl(link) || link.startsWith('//');
    const internal = !/[\\\s]/.test(link) && /^(\/(?!\/)|\?|#|\.\/|\.\.\/)/.test(link);
    const linkProps = logo && !preview && link && (external || internal)
      ? external
        ? { component: 'a', href: link.startsWith('//') ? `https:${link}` : link, ...(/^https?:\/\//i.test(link) || link.startsWith('//') ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }
        : { component: RouterLink, to: link }
      : {};
    const quoteWall = variant === 'quote-wall';
    const editProps = { preview, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus, seedPatch };

    return (
      <Card key={item.title || index} variant="outlined" {...linkProps} aria-label={linkProps.component ? item.title : undefined} sx={{ height: '100%', boxShadow: 'none', ...(linkProps.component ? { color: 'inherit', textDecoration: 'none', display: 'block', '&:hover': { borderColor: 'text.secondary' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } } : {}), ...(quoteWall ? { breakInside: 'avoid', mb: 2 } : {}) }}>
        <CardContent sx={{ height: '100%', textAlign: logo ? 'center' : 'left', p: preview ? 2 : 2.5 }}>
          {logo && (
            <Box sx={{ height: preview ? 36 : 48, mb: 1.5, borderRadius: 2, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', overflow: 'hidden', position: 'relative' }}>
              {preview ? (
                <CanvasEditableImage section={section} field={`items.${index}.image`} {...editProps} sx={{ width: '100%', height: '100%' }}>
                  {item.image ? <Box component="img" src={imageUrl(item.image)} alt={item.title || 'Logo'} {...imageLoadingProps()} sx={{ maxWidth: '86%', maxHeight: '86%', objectFit: 'contain' }} /> : <Typography variant="caption" color="text.secondary">Logo</Typography>}
                </CanvasEditableImage>
              ) : item.image ? <Box component="img" src={imageUrl(item.image)} alt={item.title || 'Logo'} {...imageLoadingProps()} sx={{ maxWidth: '86%', maxHeight: '86%', objectFit: 'contain' }} /> : null}
            </Box>
          )}
          {!logo && (item.image || preview) && (
            <Box sx={{ width: 52, height: 52, borderRadius: '50%', mb: 1.5, overflow: 'hidden', position: 'relative' }}>
              {preview ? (
                <CanvasEditableImage section={section} field={`items.${index}.image`} {...editProps} sx={{ width: '100%', height: '100%' }}>
                  <Box component="img" src={imageUrl(item.image) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} alt={item.title || ''} {...imageLoadingProps()} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </CanvasEditableImage>
              ) : <Box component="img" src={imageUrl(item.image)} alt={item.title || ''} {...imageLoadingProps()} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </Box>
          )}
          {quoteWall && <Typography aria-hidden="true" component="span" sx={{ display: 'block', fontSize: '2.5rem', lineHeight: 1, color: 'primary.main', fontFamily: 'Georgia, serif' }}>“</Typography>}
          <CanvasEditableText section={section} field={`items.${index}.title`} {...editProps} variant={preview ? 'body2' : 'subtitle2'} sx={{ fontWeight: preview ? 800 : 900 }}>{item.title}</CanvasEditableText>
          {(item.text || preview) && (quoteWall
            ? (
              <Box component="blockquote" sx={{ m: 0, mt: 1 }}>
                <CanvasEditableText section={section} field={`items.${index}.text`} {...editProps} variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {item.text || 'Add testimonial text'}
                </CanvasEditableText>
              </Box>
            )
            : <CanvasEditableText section={section} field={`items.${index}.text`} {...editProps} variant={preview ? 'caption' : 'body2'} color="text.secondary" sx={{ mt: 1, display: 'block' }}>{item.text || 'Add item text'}</CanvasEditableText>)}
          {(item.author || preview) && <CanvasEditableText section={section} field={`items.${index}.author`} {...editProps} variant="caption" sx={{ display: 'block', mt: 1.5, fontWeight: 800 }}>{preview ? `- ${item.author || 'Author'}` : quoteWall ? `— ${item.author}` : item.author}</CanvasEditableText>}
          {(item.role || preview) && <CanvasEditableText section={section} field={`items.${index}.role`} {...editProps} variant="caption" color="text.secondary">{item.role || 'Role'}</CanvasEditableText>}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box component="section" sx={{ textAlign: align }}>
      <CanvasEditableText section={section} field="title" preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} variant="h6" sx={{ mb: 1.5, fontWeight: preview ? 800 : 900 }}>{section.title || fallbackTitle}</CanvasEditableText>
      {(section.subtitle || preview) && <CanvasEditableText section={section} field="subtitle" preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} variant="body2" color="text.secondary" sx={{ mb: 2, display: 'block', minHeight: preview ? 20 : undefined }}>{section.subtitle || 'Add a short description'}</CanvasEditableText>}
      {isFaq ? (
        <FaqAccordion section={section} items={items.slice(0, 12)} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} />
      ) : isTestimonial && variant === 'carousel' ? (
        <Box>
          <Box ref={carouselRef} role="region" aria-label="Customer testimonials" tabIndex={0} sx={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollBehavior: 'smooth', pb: 1, scrollbarWidth: 'thin' }}>
            {items.slice(0, limit).map((item, index) => <Box key={item.title || index} sx={{ flex: '0 0 100%', minWidth: 0, scrollSnapAlign: 'start' }}>{renderItem(item, index)}</Box>)}
          </Box>
          {items.length > 1 && <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
            <IconButton aria-label="Previous testimonials" size="small" onClick={() => scrollCarousel(-1)}><ArrowBackIosNewIcon fontSize="inherit" /></IconButton>
            <IconButton aria-label="Next testimonials" size="small" onClick={() => scrollCarousel(1)}><ArrowForwardIosIcon fontSize="inherit" /></IconButton>
          </Box>}
        </Box>
      ) : isTestimonial && variant === 'quote-wall' ? (
        <Box role="region" aria-label="Customer quotes" sx={{ columnCount: { xs: 1, sm: 2, md: 3 }, columnGap: 2 }}>{items.slice(0, limit).map(renderItem)}</Box>
      ) : (
        <Grid container spacing={2}>
          {items.slice(0, limit).map((item, index) => <Grid item xs={12} sm={logo ? (preview ? 4 : 6) : 6} md={logo ? (preview ? 2 : 3) : 4} key={item.title || index}>{renderItem(item, index)}</Grid>)}
        </Grid>
      )}
    </Box>
  );
};

export default React.memo(ContentGridSection);
