import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, FormControl, InputLabel, Select, MenuItem, Stack,
  FormControlLabel, Checkbox, Alert, CircularProgress,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import themeService from '../../../services/themeService';
import { useAuth } from '../../../hooks/useAuth';

const CATEGORIES = [
  'general', 'fashion', 'electronics', 'grocery', 'beauty',
  'luxury', 'kids', 'books', 'sports', 'handmade', 'b2b',
];

const slugify = (text) => {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return slug || 'template-' + Date.now();
};

const SaveAsTemplateDialog = ({ open, onClose, onSaved }) => {
  const { user } = useAuth();
  const authorName = user?.name || user?.email || 'Unknown User';
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [description, setDescription] = useState('');
  const [includeHomepage, setIncludeHomepage] = useState(true);
  const [includeDemoContent, setIncludeDemoContent] = useState(false);
  const [includeComponentStyles, setIncludeComponentStyles] = useState(true);
  const [includeSectionPresets, setIncludeSectionPresets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const exported = await themeService.exportTheme({
        includeHomepageSections: includeHomepage,
        includeDemoContent,
        includeComponentStyles,
        includeSectionPresets,
      });
      // Override meta with user input
      exported.meta = {
        ...exported.meta,
        slug: slugify(name),
        name: name.trim(),
        description: description.trim(),
        category,
        author: authorName,
        version: '1.0.0',
        tags: [category],
      };
      await themeService.importTheme(exported);
      onSaved?.();
      onClose();
      setName(''); setDescription(''); setCategory('general'); setIncludeHomepage(true); setIncludeDemoContent(false); setIncludeComponentStyles(true); setIncludeSectionPresets(true);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Save Current Store as Template</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Template Name" value={name} onChange={(e) => setName(e.target.value)} size="small" fullWidth required placeholder="My Custom Template" />
          <FormControl size="small" fullWidth>
            <InputLabel>Category</InputLabel>
            <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} size="small" fullWidth multiline rows={2} placeholder="What makes this template unique?" />
          <FormControlLabel control={<Checkbox checked={includeHomepage} onChange={(e) => setIncludeHomepage(e.target.checked)} />} label="Include homepage section structure" />
          <FormControlLabel control={<Checkbox checked={includeDemoContent} onChange={(e) => setIncludeDemoContent(e.target.checked)} />} label="Include current hero slides, banners, and value props" />
          <FormControlLabel control={<Checkbox checked={includeComponentStyles} onChange={(e) => setIncludeComponentStyles(e.target.checked)} />} label="Include card/component styles" />
          <FormControlLabel control={<Checkbox checked={includeSectionPresets} onChange={(e) => setIncludeSectionPresets(e.target.checked)} />} label="Include reusable section presets" />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save to Library'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveAsTemplateDialog;
