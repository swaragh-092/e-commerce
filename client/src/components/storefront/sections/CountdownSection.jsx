import React, { useState, useEffect } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { CanvasEditableText } from './SectionFallback';

const calcTimeLeft = (endDate) => {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
};

const pad = (n) => String(n).padStart(2, '0');

const CountdownSection = ({ section = {}, mode = 'live', onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const preview = mode === 'preview';
  const endDate = section.endDate;
  const [timeLeft, setTimeLeft] = useState(() => endDate ? calcTimeLeft(endDate) : null);
  const saleLink = section.ctaLink || '/products?onSale=true';
  const align = section.textAlign || 'left';
  const stacked = align === 'center';

  useEffect(() => {
    if (preview || !endDate) return;
    const timer = setInterval(() => {
      const tl = calcTimeLeft(endDate);
      setTimeLeft(tl);
      if (!tl) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [endDate, preview]);

  // If expired and not preview, hide section
  if (!preview && endDate && !timeLeft) return null;

  const displayItems = timeLeft
    ? [
        { label: 'D', value: pad(timeLeft.days) },
        { label: 'H', value: pad(timeLeft.hours) },
        { label: 'M', value: pad(timeLeft.minutes) },
        { label: 'S', value: pad(timeLeft.seconds) },
      ]
    : [{ label: 'D', value: '00' }, { label: 'H', value: '00' }, { label: 'M', value: '00' }, { label: 'S', value: '00' }];

  const Wrapper = preview ? Box : Link;
  const wrapperProps = preview ? {} : { to: saleLink, style: { textDecoration: 'none', color: 'inherit' } };

  return (
    <Wrapper {...wrapperProps}>
      <Box
        component="section"
        sx={{
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 4,
          bgcolor: 'secondary.main',
          color: 'secondary.contrastText',
          display: 'flex',
          flexDirection: stacked ? 'column' : 'row',
          alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'center',
          justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'space-between',
          textAlign: align,
          gap: 2,
          flexWrap: 'wrap',
          cursor: preview ? 'default' : 'pointer',
          transition: 'transform 0.15s, box-shadow 0.15s',
          '&:hover': preview ? {} : { transform: 'translateY(-2px)', boxShadow: 6 },
        }}
      >
        <Box sx={{ flex: stacked ? undefined : 1, width: stacked ? '100%' : undefined }}>
          <CanvasEditableText
            section={section}
            field="title"
            preview={preview}
            onInlineFieldChange={onInlineFieldChange}
            onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
            variant={preview ? 'h6' : 'h4'}
            sx={{ fontWeight: 950 }}
          >
            {section.title || 'Limited Time Offer'}
          </CanvasEditableText>
          <CanvasEditableText
            section={section}
            field="subtitle"
            preview={preview}
            onInlineFieldChange={onInlineFieldChange}
            onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
            variant="body2"
            sx={{ mt: 0.5, opacity: 0.86, display: 'block' }}
          >
            {section.subtitle || 'Hurry - this deal ends soon.'}
          </CanvasEditableText>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          onClick={preview && onSelectComponent ? (event) => { event.stopPropagation(); onSelectComponent('designTokens'); } : undefined}
          sx={preview && onSelectComponent ? { cursor: 'pointer', outline: '1px dashed transparent', '&:hover': { outlineColor: '#1976d2' } } : undefined}
        >
          {displayItems.map((item) => (
            <Chip
              key={item.label}
              label={`${item.value}${item.label}`}
              sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 900, fontSize: '0.9rem', minWidth: 48 }}
            />
          ))}
          <Button variant="contained" size="small" sx={{ pointerEvents: 'none' }}>
            {section.ctaText || 'Shop Sale'}
          </Button>
        </Stack>
      </Box>
    </Wrapper>
  );
};

export default React.memo(CountdownSection);

