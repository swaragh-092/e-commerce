import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert, Box, Chip, Stack, Divider } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SaveIcon from '@mui/icons-material/Save';
import themeService from '../../../services/themeService';

const STEPS = { UPLOAD: 0, SUMMARY: 1 };

const ThemeImportDialog = ({ open, onClose, onImport, onPreview, loading }) => {
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
    setParsed(null);
    setStep(STEPS.UPLOAD);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.schemaVersion || !data.meta?.slug) {
          setError('Invalid template package: missing schemaVersion or meta.slug');
          return;
        }
        // Server-side validation
        setValidating(true);
        try {
          await themeService.validateTheme(data);
          setParsed(data);
          setStep(STEPS.SUMMARY);
        } catch (err) {
          console.error('[ThemeImport] Validation error:', err);
          const rawMessage = err.response?.data?.message || err.message || '';
          let userMessage = 'An error occurred while importing the theme';
          if (rawMessage) {
            const rawLower = rawMessage.toLowerCase();
            if (rawLower.includes('format') || rawLower.includes('invalid file')) {
              userMessage = 'Invalid file format';
            } else if (rawLower.includes('upload') || rawLower.includes('failed')) {
              userMessage = 'Upload failed';
            } else if (rawLower.includes('validation') || rawLower.includes('schema')) {
              userMessage = 'Validation failed';
            } else {
              userMessage = rawMessage;
            }
          }
          setError(userMessage);
        } finally {
          setValidating(false);
        }
      } catch {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(f);
  };

  const handleSaveToLibrary = () => {
    if (parsed) onImport(parsed);
  };

  const handlePreview = () => {
    if (parsed && onPreview) onPreview(parsed);
  };

  const handleClose = () => {
    setFile(null);
    setParsed(null);
    setError('');
    setStep(STEPS.UPLOAD);
    onClose();
  };

  const meta = parsed?.meta || {};
  const sections = parsed?.layout?.homepageSections || [];
  const hasDemo = !!(parsed?.demoContent?.heroSlides?.length || parsed?.demoContent?.promoBanners?.length || parsed?.demoContent?.valueProps?.length);
  const pageTemplateCount = parsed?.pageTemplates ? Object.keys(parsed.pageTemplates).length : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Template Package</DialogTitle>
      <DialogContent>
        {step === STEPS.UPLOAD && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload a <code>.theme.json</code> file. It will be validated before you can preview or save it.
            </Typography>
            <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={validating}>
              {validating ? 'Validating...' : file ? file.name : 'Choose File'}
              <input type="file" accept=".json" hidden onChange={handleFileChange} />
            </Button>
            {error && <Alert severity="error" sx={{ mt: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{error}</Alert>}
          </>
        )}

        {step === STEPS.SUMMARY && parsed && (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>Package is valid and ready to use.</Alert>
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>{meta.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {meta.author || 'Unknown author'} • v{meta.version} • {meta.category || 'general'}
              </Typography>
              {meta.description && (
                <Typography variant="body2" sx={{ mt: 1 }}>{meta.description}</Typography>
              )}
              {meta.tags?.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                  {meta.tags.map(tag => <Chip key={tag} label={tag} size="small" variant="outlined" />)}
                </Stack>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Included content:</Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">• Design settings (colors, fonts, styles)</Typography>
              {sections.length > 0 && (
                <Typography variant="body2">• {sections.length} homepage section{sections.length > 1 ? 's' : ''}</Typography>
              )}
              {hasDemo && <Typography variant="body2">• Demo content (hero slides, banners, value props)</Typography>}
              {parsed?.layout?.nav && <Typography variant="body2">• Navigation layout</Typography>}
              {parsed?.layout?.footerStyle && <Typography variant="body2">• Footer styling</Typography>}
              {parsed?.layout?.announcementStyle && <Typography variant="body2">• Announcement bar styling</Typography>}
              {pageTemplateCount > 0 && <Typography variant="body2">• {pageTemplateCount} page template layout{pageTemplateCount > 1 ? 's' : ''}</Typography>}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {step === STEPS.SUMMARY && (
          <>
            {onPreview && (
              <Button startIcon={<VisibilityIcon />} onClick={handlePreview}>Preview</Button>
            )}
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveToLibrary} disabled={loading}>
              {loading ? 'Saving...' : 'Save to Library'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ThemeImportDialog;
