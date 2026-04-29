import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  IconButton,
  Divider,
  Tabs,
  Tab,
  Breadcrumbs,
  Alert,
  Chip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  OpenInNew as OpenInNewIcon,
  Code as CodeIcon,
  FormatColorText as VisualIcon,
  Visibility as PreviewIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import PageService from '../../services/pageService';
import MediaPicker from '../../components/common/MediaPicker';
import { getMediaUrl } from '../../utils/media';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import RichTextEditor from '../../components/editor/RichTextEditor';
import { getApiErrorMessage } from '../../utils/apiErrors';

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, 4, false] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ align: [] }],
    ['link', 'image'],
    [{ color: [] }, { background: [] }],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list', 'bullet', 'indent', 'align', 'link', 'image', 'color', 'background',
];

// Inline Preview: renders the current HTML content in a sandboxed iframe with styles
const ContentPreview = ({ content, bannerUrl }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 16px;
              line-height: 1.7;
              color: #333;
              margin: 0;
              padding: 24px;
              max-width: 900px;
            }
            h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 700; }
            p { margin-bottom: 1em; }
            ul, ol { margin-bottom: 1em; padding-left: 2em; }
            li { margin-bottom: 0.3em; }
            a { color: #1976d2; }
            img { max-width: 100%; height: auto; border-radius: 4px; }
            blockquote {
              border-left: 4px solid #1976d2;
              margin: 1em 0;
              padding: 0.5em 1em;
              background: #f5f9ff;
              color: #444;
            }
            pre, code { background: #f4f4f4; border-radius: 4px; padding: 2px 6px; font-family: monospace; }
            pre { padding: 1em; overflow-x: auto; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; }
            th { background: #f5f5f5; font-weight: 600; }
            .banner {
              width: 100%;
              height: 200px;
              object-fit: cover;
              border-radius: 4px;
              margin-bottom: 24px;
            }
          </style>
        </head>
        <body>
          ${bannerUrl ? `<img class="banner" src="${getMediaUrl(bannerUrl)}" alt="Page Banner" />` : ''}
          ${content || '<p style="color:#999;font-style:italic">No content yet. Start writing in the Visual or Code tab.</p>'}
        </body>
      </html>
    `);
    doc.close();
  }, [content, bannerUrl]);

  return (
    <iframe
      ref={iframeRef}
      title="Page Preview"
      style={{
        width: '100%',
        minHeight: '500px',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        background: '#fff',
      }}
    />
  );
};

const PageEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const isNew = !id || id === 'new';
  const canManagePages = hasPermission(PERMISSIONS.PAGES_MANAGE);
  const canUploadMedia = hasPermission(PERMISSIONS.MEDIA_UPLOAD);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0: Visual, 1: Code, 2: Preview
  const [saveError, setSaveError] = useState('');
  const [slug, setSlug] = useState('');
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    linkPosition: 'none',
    linkPlacement: '',
    metaTitle: '',
    metaDescription: '',
    bannerUrl: '',
    status: 'draft',
    sortOrder: 0,
    isSystem: false,
  });

  useEffect(() => {
    if (!isNew) {
      const fetchPage = async () => {
        setLoading(true);
        try {
          const response = await PageService.adminGetPageById(id);
          const page = response.data;
          setSlug(page.slug);
          setFormData({
            title: page.title,
            content: page.content,
            linkPosition: page.linkPosition || 'none',
            linkPlacement: page.linkPlacement || '',
            metaTitle: page.metaTitle || '',
            metaDescription: page.metaDescription || '',
            bannerUrl: page.bannerUrl || '',
            status: page.status || 'draft',
            sortOrder: page.sortOrder || 0,
            isSystem: page.isSystem || false,
          });
        } catch (error) {
          notify('Error fetching page details', 'error');
          console.error(error);
        } finally {
          setLoading(false);
        }
      };
      fetchPage();
    }
  }, [id, isNew]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleContentChange = (content) => {
    setFormData((prev) => ({ ...prev, content }));
  };

  const handleBannerUpload = (media) => {
    if (!canUploadMedia) {
      notify('You do not have permission to upload media.', 'error');
      return;
    }

    setFormData((prev) => ({ ...prev, bannerUrl: media.url }));
    setMediaPickerOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');

    if (!canManagePages) {
      setSaveError('You do not have permission to manage pages.');
      return;
    }

    if (!formData.title.trim()) {
      setSaveError('Page title is required.');
      return;
    }
    if (!formData.content.trim() || formData.content === '<p><br></p>') {
      setSaveError('Page content cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const res = await PageService.adminCreatePage(formData);
        notify('Page created successfully.', 'success');
        // Navigate to edit view so slug and ID are available
        const newId = res.data?.id;
        if (newId) {
          navigate(`/admin/pages/${newId}/edit`, { replace: true });
        } else {
          navigate('/admin/pages');
        }
      } else {
        const res = await PageService.adminUpdatePage(id, formData);
        setSlug(res.data?.slug || slug);
        notify('Page updated successfully.', 'success');
      }
    } catch (error) {
      const msg = getApiErrorMessage(error, 'Error saving page');
      setSaveError(msg);
      notify(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link to="/admin/pages" style={{ textDecoration: 'none', color: 'inherit' }}>
          Pages
        </Link>
        <Typography color="text.primary">{isNew ? 'New Page' : 'Edit Page'}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={() => navigate('/admin/pages')}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {isNew ? 'Create New Page' : `Edit: ${formData.title}`}
            </Typography>
            {slug && (
              <Typography variant="caption" color="text.secondary">
                Slug: <code>/p/{slug}</code>
              </Typography>
            )}
          </Box>
        </Box>
        <Box display="flex" gap={1.5} alignItems="center">
          {formData.status === 'published' && (
            <Chip label="Published" color="success" size="small" />
          )}
          {!isNew && slug && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNewIcon />}
              onClick={() => window.open(`/p/${slug}`, '_blank')}
            >
              View Live
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || !canManagePages}
          >
            {saving ? 'Saving…' : 'Save Page'}
          </Button>
        </Box>
      </Box>

      {saveError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* ── Main content area ── */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <TextField
              fullWidth
              label="Page Title *"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              sx={{ mb: 3 }}
              error={!formData.title.trim() && saving}
              helperText={!formData.title.trim() && saving ? 'Title is required' : ''}
            />

            {/* Editor Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)}>
                <Tab icon={<VisualIcon />} iconPosition="start" label="Visual" />
                <Tab icon={<CodeIcon />} iconPosition="start" label="HTML Code" />
                <Tab icon={<PreviewIcon />} iconPosition="start" label="Preview" />
              </Tabs>
            </Box>

            {/* Visual Editor */}
            {activeTab === 0 && (
              <Box sx={{ mb: 2 }}>
                <RichTextEditor
                  value={formData.content}
                  onChange={handleContentChange}
                  modules={QUILL_MODULES}
                  formats={QUILL_FORMATS}
                  minHeight={450}
                />
              </Box>
            )}

            {/* Code Editor */}
            {activeTab === 1 && (
              <TextField
                fullWidth
                multiline
                rows={22}
                label="Raw HTML Content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                inputProps={{ style: { fontFamily: 'monospace', fontSize: '13px' } }}
              />
            )}

            {/* Live Preview */}
            {activeTab === 2 && (
              <ContentPreview content={formData.content} bannerUrl={formData.bannerUrl} />
            )}
          </Paper>

          {/* SEO */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              SEO
            </Typography>
            <TextField
              fullWidth
              label="Meta Title"
              name="metaTitle"
              value={formData.metaTitle}
              onChange={handleInputChange}
              placeholder={formData.title || 'Leave blank to use page title'}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Meta Description"
              name="metaDescription"
              value={formData.metaDescription}
              onChange={handleInputChange}
              placeholder="Brief description for search engines (150–160 chars recommended)"
            />
          </Paper>
        </Grid>

        {/* ── Sidebar ── */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              Settings
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={formData.status}
                label="Status"
                onChange={handleInputChange}
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="published">Published</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="Sort Order"
              name="sortOrder"
              value={formData.sortOrder}
              onChange={handleInputChange}
              sx={{ mb: 2 }}
              helperText="Lower numbers appear first"
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Storefront Link Placement
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Position</InputLabel>
              <Select
                name="linkPosition"
                value={formData.linkPosition}
                label="Position"
                onChange={handleInputChange}
              >
                <MenuItem value="none">None (Hidden from menus)</MenuItem>
                <MenuItem value="top">Header / Top Navigation</MenuItem>
                <MenuItem value="bottom">Footer</MenuItem>
              </Select>
            </FormControl>

            {formData.linkPosition === 'bottom' && (
              <TextField
                fullWidth
                label="Footer Group / Section"
                name="linkPlacement"
                value={formData.linkPlacement}
                onChange={handleInputChange}
                placeholder="e.g. Customer Support, Company"
                helperText="Groups this link under a footer section heading"
              />
            )}
          </Paper>

          {/* Banner */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              Page Banner
            </Typography>
            {formData.bannerUrl && (
              <Box mb={2}>
                <img
                  src={getMediaUrl(formData.bannerUrl)}
                  alt="Banner Preview"
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    maxHeight: '180px',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <Button
                  size="small"
                  color="error"
                  sx={{ mt: 1 }}
                  onClick={() => setFormData((prev) => ({ ...prev, bannerUrl: '' }))}
                  disabled={!canManagePages}
                >
                  Remove Banner
                </Button>
              </Box>
            )}
            {canUploadMedia ? (
              <Box>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => setMediaPickerOpen(true)}
                  sx={{ py: 2, borderStyle: 'dashed', borderWidth: 2 }}
                >
                  {formData.bannerUrl ? 'Change Banner' : 'Select or Upload Banner'}
                </Button>
                <MediaPicker
                  open={mediaPickerOpen}
                  onClose={() => setMediaPickerOpen(false)}
                  onSelect={handleBannerUpload}
                  multiple={false}
                  title="Select Page Banner"
                />
              </Box>
            ) : (
              <Alert severity="info" sx={{ mt: 1 }}>
                Banner uploads require the media upload permission.
              </Alert>
            )}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Recommended: 1920×400px. Shown as a full-width hero on the page.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PageEditPage;
