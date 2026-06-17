import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReplayIcon from '@mui/icons-material/Replay';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import VerifiedIcon from '@mui/icons-material/Verified';
import { useComponentStyles } from '../../../hooks/useSettings';
import { getOptimizedMediaUrl } from '../../../utils/media';
import { resolveRadius, resolveShadow } from '../../../utils/styleMaps';
import { CanvasEditableImage, CanvasEditableText } from './SectionFallback';

const iconMap = {
  shipping: LocalShippingIcon,
  offers: LocalOfferIcon,
  secure: ShieldOutlinedIcon,
  support: SupportAgentIcon,
  fast: BoltIcon,
  payment: CreditCardIcon,
  verified: VerifiedIcon,
  LocalShipping: LocalShippingIcon,
  Replay: ReplayIcon,
  Verified: VerifiedIcon,
};


const imageUrl = (image) => getOptimizedMediaUrl(image || '', { width: 480, quality: 80 }) || '';

const DEFAULT_ITEMS = [
  { icon: 'shipping', title: 'Fast Delivery', text: 'Reliable shipping on every order' },
  { icon: 'offers', title: 'Daily Offers', text: 'Fresh deals across top categories' },
  { icon: 'secure', title: 'Secure Payments', text: 'Protected checkout experience' },
  { icon: 'support', title: 'Easy Support', text: 'Help when shoppers need it' },
];

const TrustSection = ({ section = {}, items = DEFAULT_ITEMS, mode = 'live', onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const resolvedItems = Array.isArray(items) && items.length ? items : DEFAULT_ITEMS;
  const trustCardStyle = useComponentStyles('trustCard');
  const compact = mode === 'preview';
  const variant = section.variant || trustCardStyle.variant || 'icon-row';
  const cardGrid = variant === 'card-grid';
  const cardRadius = resolveRadius(trustCardStyle.radius);
  const cardShadow = resolveShadow(trustCardStyle.shadow);
  const titleVariant = trustCardStyle.titleSize === 'large' ? 'h6' : trustCardStyle.titleSize === 'small' ? 'body2' : 'subtitle1';

  const align = section.textAlign || 'left';
  const seedPatch = { items: resolvedItems };

  const sectionImage = imageUrl(section.backgroundImage);

  return (
    <Box component="section" sx={{
      textAlign: align,
      borderRadius: section.backgroundColor || sectionImage ? 3 : undefined,
      p: section.backgroundColor || sectionImage ? (compact ? 2 : { xs: 2, md: 3 }) : undefined,
      backgroundColor: section.backgroundColor || undefined,
      backgroundImage: sectionImage ? `linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.82)), url(${sectionImage})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: section.backgroundPosition || 'center',
    }}>
      {(section.title || section.subtitle || compact) && (
        <Box sx={{ mb: compact ? 1.5 : 2.5 }}>
          <CanvasEditableText
            section={section}
            field="title"
            preview={compact}
            onInlineFieldChange={onInlineFieldChange}
            onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
            variant={compact ? 'h6' : 'h5'}
            sx={{ fontWeight: 900 }}
          >
            {section.title || 'Store Benefits'}
          </CanvasEditableText>
          {(section.subtitle || compact) && (
            <CanvasEditableText
              section={section}
              field="subtitle"
              preview={compact}
              onInlineFieldChange={onInlineFieldChange}
              onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
              variant="body2"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.5 }}
            >
              {section.subtitle || 'Add a short promise for shoppers'}
            </CanvasEditableText>
          )}
        </Box>
      )}
      <Grid container spacing={cardGrid ? (compact ? 1.5 : 2) : 1.5}>
      {resolvedItems.map((item, index) => {
        const Icon = iconMap[item.icon] || VerifiedIcon;
        const itemImage = imageUrl(item.image);
        return (
          <Grid item xs={6} md={3} key={`${item.title || 'trust'}-${index}`}>
            <Box
              data-component="trust-card"
              data-variant={variant}
              onClick={(event) => {
                if (!onSelectComponent) return;
                event.stopPropagation();
                onSelectComponent('trustCard');
              }}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: cardGrid ? 'column' : 'row',
                alignItems: cardGrid ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start') : 'center',
                gap: cardGrid ? 1.25 : 1.5,
                p: cardGrid ? (compact ? 1.5 : { xs: 2, sm: 2.5 }) : (compact ? 1.5 : { xs: 1.5, sm: 2 }),
                bgcolor: item.backgroundColor || 'background.paper',
                border: '1px solid',
                borderColor: item.accentColor || 'var(--store-color-border)',
                borderRadius: cardRadius,
                boxShadow: cardShadow,
                cursor: onSelectComponent ? 'pointer' : undefined,
                '&:hover': onSelectComponent ? { outline: '2px dashed #1976d2', outlineOffset: 2 } : undefined,
              }}
            >
              <Box
                sx={{
                  width: cardGrid ? (compact ? 40 : 48) : (compact ? 36 : 40),
                  height: cardGrid ? (compact ? 40 : 48) : (compact ? 36 : 40),
                  borderRadius: cardGrid ? 999 : 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: item.accentColor ? `${item.accentColor}22` : 'var(--store-color-primary-light)',
                  color: item.accentColor || 'var(--store-color-primary-dark)',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {itemImage ? (
                  <CanvasEditableImage section={section} field={`items.${index}.image`} preview={compact} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} sx={{ width: '100%', height: '100%' }}>
                    <Box component="img" src={itemImage} alt={item.title || 'Trust image'} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </CanvasEditableImage>
                ) : (
                  <Icon fontSize="small" />
                )}
              </Box>
              <Box sx={{ minWidth: 0, textAlign: cardGrid ? align : 'inherit' }}>
                <CanvasEditableText section={section} field={`items.${index}.title`} preview={compact} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant={compact ? 'caption' : titleVariant} sx={{ fontWeight: compact ? 700 : 900 }} noWrap={!cardGrid}>
                  {item.title}
                </CanvasEditableText>
                <CanvasEditableText section={section} field={`items.${index}.text`} preview={compact} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} seedPatch={seedPatch} variant={cardGrid && !compact ? 'body2' : 'caption'} color="text.secondary" sx={{ display: 'block', mt: cardGrid ? 0.5 : 0 }}>
                  {item.text}
                </CanvasEditableText>
              </Box>
            </Box>
          </Grid>
        );
      })}
      </Grid>
    </Box>
  );
};

export default React.memo(TrustSection);
