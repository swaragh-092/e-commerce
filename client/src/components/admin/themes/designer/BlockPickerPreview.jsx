import { Box, Stack, Typography } from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { HERO_CARD_SOURCES } from '../../../storefront/sections/ComposedHero';

const media = <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 44, bgcolor: 'action.hover', color: 'text.secondary', borderRadius: 1 }}><ImageOutlinedIcon fontSize="small" /></Box>;
const heading = (text) => <Typography variant="subtitle1" fontWeight={700}>{text}</Typography>;
const button = (text) => <Box component="span" sx={{ alignSelf: 'flex-start', px: 1.25, py: 0.5, borderRadius: 1, bgcolor: 'primary.main', color: 'primary.contrastText', typography: 'caption' }}>{text}</Box>;

function sample(type, label) {
  if (type in HERO_CARD_SOURCES) return <>{media}{heading(HERO_CARD_SOURCES[type].fallback)}<Typography variant="caption">Explore →</Typography></>;
  switch (type) {
    case 'heading': return heading('Introduce your story');
    case 'text': return <Typography variant="body2">Share a few details with your customers.</Typography>;
    case 'button': return button('Shop now');
    case 'media': return media;
    case 'group': return <Box sx={{ border: 1, borderColor: 'divider', p: 1, borderRadius: 1 }}>{heading('Grouped heading')}<Typography variant="caption">Related content</Typography></Box>;
    case 'newsletter': return <>{heading('Stay in touch')}<Typography variant="caption">Email address</Typography>{button('Subscribe')}</>;
    case 'enquiry': return <>{heading('Ask a question')}{button('Send enquiry')}</>;
    case 'product-rating': return <Typography color="primary.main">★★★★★ <Typography component="span" variant="caption">4.8 / 5</Typography></Typography>;
    case 'availability': return <Typography variant="body2" color="success.main">● In stock</Typography>;
    case 'fulfillment': return <Typography variant="body2">Ships from Example Store</Typography>;
    case 'care': case 'delivery': case 'product-attribute': return <>{heading(label)}<Typography variant="caption">Example product details</Typography></>;
    default: return heading(label);
  }
}

export default function BlockPickerPreview({ type, label }) {
  return <Stack component="aside" aria-label="Block preview" spacing={0.75} sx={{ bgcolor: 'action.hover', p: 1.25, borderRadius: 1.5, minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary">Sample preview</Typography>
    <Stack aria-hidden="true" spacing={0.5} justifyContent="center" sx={{ minHeight: 90, p: 1.25, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
      {sample(type, label)}
    </Stack>
    <Typography component="h3" variant="subtitle2">{label}</Typography>
  </Stack>;
}
