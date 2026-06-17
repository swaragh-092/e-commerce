import React, { useState } from 'react';
import { Box, Button, Stack, TextField, Typography, Alert } from '@mui/material';
import api from '../../../services/api';
import { useComponentStyles } from '../../../hooks/useSettings';
import { getFormControlSize, getFormControlSx } from '../../../utils/componentStyles';
import { CanvasEditableText } from './SectionFallback';

const NewsletterSection = ({ section = {}, mode = 'live', onSelectComponent, onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const preview = mode === 'preview';
  const variant = section.variant || 'banner';
  const inline = variant === 'inline-form';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // 'success' | 'error' | 'already'
  const [loading, setLoading] = useState(false);
  const align = section.textAlign || 'left';
  const formControlStyle = useComponentStyles('formControl');
  const inputSize = getFormControlSize(formControlStyle);
  const inputSx = getFormControlSx(formControlStyle);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || preview) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await api.post('/newsletter/subscribe', { email: email.trim(), source: 'homepage' });
      setStatus(res.data?.data?.alreadySubscribed ? 'already' : 'success');
      if (!res.data?.data?.alreadySubscribed) setEmail('');
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const form = (
    <Stack
      component={preview ? 'div' : 'form'}
      onSubmit={preview ? undefined : handleSubmit}
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.25}
      justifyContent={inline ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start') : 'center'}
      onClick={preview && onSelectComponent ? (event) => { event.stopPropagation(); onSelectComponent('formControl'); } : undefined}
      sx={{ mt: inline ? 0 : 3, maxWidth: inline ? 520 : 440, width: '100%', mx: inline ? (align === 'right' ? '0 0 0 auto' : align === 'center' ? 'auto' : 0) : 'auto', ...(preview && onSelectComponent ? { cursor: 'pointer', outline: '1px dashed transparent', '&:hover': { outlineColor: '#1976d2' } } : {}) }}
    >
      <TextField
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={preview || loading}
        required
        size={inputSize}
        variant={formControlStyle.variant === 'filled' ? 'filled' : 'outlined'}
        sx={{ flex: 1, ...inputSx, bgcolor: inline ? 'background.paper' : 'rgba(255,255,255,0.92)', '& .MuiOutlinedInput-notchedOutline': { border: inline ? undefined : 'none' } }}
        inputProps={{ 'aria-label': 'Email address' }}
      />
      <Button
        type={preview ? 'button' : 'submit'}
        variant="contained"
        disabled={preview || loading}
        sx={inline ? { fontWeight: 800 } : { bgcolor: 'background.paper', color: 'text.primary', fontWeight: 700, '&:hover': { bgcolor: 'background.default' } }}
      >
        {loading ? '...' : (section.ctaText || 'Subscribe')}
      </Button>
    </Stack>
  );

  const alerts = (
    <>
      {status === 'success' && <Alert severity="success" sx={{ mt: 2, maxWidth: 400, mx: inline ? 0 : 'auto' }}>You're subscribed!</Alert>}
      {status === 'already' && <Alert severity="info" sx={{ mt: 2, maxWidth: 400, mx: inline ? 0 : 'auto' }}>You're already subscribed.</Alert>}
      {status === 'error' && <Alert severity="error" sx={{ mt: 2, maxWidth: 400, mx: inline ? 0 : 'auto' }}>Something went wrong. Try again.</Alert>}
    </>
  );

  if (inline) {
    return (
      <Box
        component="section"
        sx={{
          p: preview ? 2.5 : { xs: 2.5, md: 3 },
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          textAlign: align,
        }}
      >
        <Stack direction={{ xs: 'column', md: align === 'center' ? 'column' : 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: align === 'center' ? 'center' : 'center' }} justifyContent={align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'space-between'}>
          <Box sx={{ maxWidth: 560, width: align === 'center' ? '100%' : undefined }}>
            <CanvasEditableText section={section} field="title" preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} variant={preview ? 'h6' : 'h4'} sx={{ fontWeight: 950 }}>
              {section.title || 'Join The List'}
            </CanvasEditableText>
            <CanvasEditableText section={section} field="subtitle" preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {section.subtitle || 'Get launches, offers, and storefront updates in your inbox.'}
            </CanvasEditableText>
            {alerts}
          </Box>
          {form}
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      component="section"
      sx={{
        p: { xs: 3, md: 5 },
        borderRadius: 4,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        textAlign: align,
        overflow: 'hidden',
      }}
    >
      <CanvasEditableText section={section} field="title" preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} variant={preview ? 'h5' : 'h3'} sx={{ fontWeight: 950 }}>
        {section.title || 'Join The List'}
      </CanvasEditableText>
      <CanvasEditableText section={section} field="subtitle" preview={preview} onInlineFieldChange={onInlineFieldChange} onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus} variant="body1" sx={{ mt: 1, opacity: 0.86, maxWidth: 680, mx: align === 'left' ? 0 : align === 'right' ? '0 0 0 auto' : 'auto' }}>
        {section.subtitle || 'Get launches, offers, and storefront updates in your inbox.'}
      </CanvasEditableText>

      {alerts}
      {form}
    </Box>
  );
};

export default React.memo(NewsletterSection);
