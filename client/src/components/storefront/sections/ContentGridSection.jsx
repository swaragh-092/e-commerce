import React from 'react';
import { useState } from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Box, Card, CardContent, Grid, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getOptimizedMediaUrl, imageLoadingProps } from '../../../utils/media';
import { CanvasEditableText, CanvasEditableImage } from './SectionFallback';

const imageUrl = (image) => getOptimizedMediaUrl(image || '', { width: 360, quality: 78 }) || '';

const buildFallbackItems = (fallbackTitle, count, mode) => {
  const max = Math.min(Number.parseInt(count || 3, 10) || 3, mode === 'preview' ? 6 : 8);
  return Array.from({ length: max }).map((_, index) => ({
    title: `${fallbackTitle} ${index + 1}`,
    text: mode === 'preview' ? 'Template-ready content block.' : 'Template-ready storefront content.',
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
  const preview = mode === 'preview';
  const logo = kind === 'logo';
  const isFaq = section.type === 'faq' || kind === 'faq';
  const items = Array.isArray(section.items) && section.items.length
    ? section.items
    : buildFallbackItems(fallbackTitle, section.count, mode);

  if (!items.length) return null;

  const limit = logo ? (preview ? 6 : 8) : 6;
  const align = section.textAlign || 'left';
  const seedPatch = { items };

  return (
    <Box component="section" sx={{ textAlign: align }}>
      <CanvasEditableText
        section={section}
        field="title"
        preview={preview}
        onInlineFieldChange={onInlineFieldChange}
        onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
        variant={preview ? 'h6' : 'h6'}
        sx={{ mb: 1.5, fontWeight: preview ? 800 : 900 }}
      >
        {section.title || fallbackTitle}
      </CanvasEditableText>
      {(section.subtitle || preview) && (
        <CanvasEditableText
          section={section}
          field="subtitle"
          preview={preview}
          onInlineFieldChange={onInlineFieldChange}
          onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, display: 'block', minHeight: preview ? 20 : undefined }}
        >
          {section.subtitle || 'Add a short description'}
        </CanvasEditableText>
      )}
      {isFaq ? (
        <FaqAccordion section={section} items={items.slice(0, 12)} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} />
      ) : (
      <Grid container spacing={2}>
        {items.slice(0, limit).map((item, index) => (
          <Grid item xs={12} sm={logo ? (preview ? 4 : 6) : 6} md={logo ? (preview ? 2 : 3) : 4} key={item.title || index}>
            <Card variant="outlined" sx={{ height: '100%', boxShadow: 'none' }}>
              <CardContent sx={{ height: '100%', textAlign: logo ? 'center' : 'left', p: preview ? 2 : 2.5 }}>
                {logo && (
                  <Box sx={{ height: preview ? 36 : 48, mb: 1.5, borderRadius: 2, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', overflow: 'hidden', position: 'relative' }}>
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
                        {item.image ? (
                          <Box component="img" src={imageUrl(item.image)} alt={item.title || 'Logo'} {...imageLoadingProps()} sx={{ maxWidth: '86%', maxHeight: '86%', objectFit: 'contain' }} />
                        ) : (
                          <Typography variant="caption" color="text.secondary">Logo</Typography>
                        )}
                      </CanvasEditableImage>
                    ) : (
                      item.image && (
                        <Box component="img" src={imageUrl(item.image)} alt={item.title || 'Logo'} {...imageLoadingProps()} sx={{ maxWidth: '86%', maxHeight: '86%', objectFit: 'contain' }} />
                      )
                    )}
                  </Box>
                )}
                {!logo && (item.image || preview) && (
                  <Box sx={{ width: 52, height: 52, borderRadius: '50%', mb: 1.5, overflow: 'hidden', position: 'relative' }}>
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
                        <Box component="img" src={imageUrl(item.image) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} alt={item.title || ''} {...imageLoadingProps()} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </CanvasEditableImage>
                    ) : (
                      <Box component="img" src={imageUrl(item.image)} alt={item.title || ''} {...imageLoadingProps()} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </Box>
                )}
                <CanvasEditableText section={section} field={`items.${index}.title`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant={preview ? 'body2' : 'subtitle2'} sx={{ fontWeight: preview ? 800 : 900 }}>
                  {item.title}
                </CanvasEditableText>
                {(item.text || preview) && (
                  <CanvasEditableText section={section} field={`items.${index}.text`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant={preview ? 'caption' : 'body2'} color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {item.text || 'Add item text'}
                  </CanvasEditableText>
                )}
                {(item.author || preview) && (
                  <CanvasEditableText section={section} field={`items.${index}.author`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant="caption" sx={{ display: 'block', mt: 1.5, fontWeight: 800 }}>
                    {preview ? `- ${item.author || 'Author'}` : item.author}
                  </CanvasEditableText>
                )}
                {(item.role || preview) && <CanvasEditableText section={section} field={`items.${index}.role`} preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant="caption" color="text.secondary">{item.role || 'Role'}</CanvasEditableText>}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      )}
    </Box>
  );
};

export default React.memo(ContentGridSection);
