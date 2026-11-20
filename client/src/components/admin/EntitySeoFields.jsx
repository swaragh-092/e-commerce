import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import MediaPicker from '../common/MediaPicker';
import { getMediaUrl } from '../../utils/media';

export default function EntitySeoFields({ value, onChange, title, description, canSelectMedia = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const setField = (key, next) => onChange({ ...value, [key]: next });
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" fontWeight={700}>SEO Configuration</Typography>
      <Typography variant="body2" color="text.secondary">Customize search results and social sharing. Leave fields empty to use the name, description and cover image.</Typography>
      <TextField label="Meta title" value={value.metaTitle || ''} onChange={e => setField('metaTitle', e.target.value)} inputProps={{ maxLength: 255 }} helperText="Recommended: 50–60 characters" fullWidth />
      <TextField label="Meta description" value={value.metaDescription || ''} onChange={e => setField('metaDescription', e.target.value)} inputProps={{ maxLength: 500 }} helperText="Recommended: 150–160 characters" multiline minRows={3} fullWidth />
      <TextField label="Meta keywords" value={value.metaKeywords || ''} onChange={e => setField('metaKeywords', e.target.value)} inputProps={{ maxLength: 500 }} helperText="Separate keywords with commas" fullWidth />
      <Typography variant="subtitle2">Social sharing image</Typography>
      {value.ogImage && <Box component="img" src={getMediaUrl(value.ogImage)} alt="Social sharing preview" sx={{ width: '100%', maxHeight: 180, objectFit: 'contain' }} />}
      <Stack direction="row" spacing={1}>
        {canSelectMedia && <Button variant="outlined" onClick={() => setPickerOpen(true)}>Choose SEO image</Button>}
        {value.ogImage && <Button onClick={() => setField('ogImage', '')}>Use default image</Button>}
      </Stack>
      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">Search result preview</Typography>
        <Typography fontWeight={600} color="primary">{value.metaTitle || title || 'Page title'}</Typography>
        <Typography variant="body2" color="text.secondary">{value.metaDescription || description || 'Your page description will appear here.'}</Typography>
      </Box>
      <MediaPicker open={pickerOpen && canSelectMedia} onClose={() => setPickerOpen(false)} title="Choose SEO image" onSelect={media => {
        const image = Array.isArray(media) ? media[0] : media;
        if (image?.url && image.mimeType?.startsWith('image/')) setField('ogImage', image.url);
        setPickerOpen(false);
      }} />
    </Stack>
  );
}
