import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FormatColorText as VisualIcon,
  Preview as PreviewIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import RichTextEditor from '../../components/editor/RichTextEditor';
import BlogService from '../../services/blogService';
import MediaPicker from '../../components/common/MediaPicker';
import { getMediaUrl } from '../../utils/media';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

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
  'list', 'indent', 'align', 'link', 'image', 'color', 'background',
];

const getSelectedGalleryMediaIds = (images = []) => (
  [...new Set(images.map((item) => item?.id).filter(Boolean))]
);

const ContentPreview = ({ content, imageUrl, title, summary }) => {
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
              line-height: 1.8;
              color: #222;
              margin: 0;
              padding: 32px;
              max-width: 920px;
            }
            h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.6em; font-weight: 800; line-height: 1.2; }
            p { margin-bottom: 1em; }
            ul, ol { margin-bottom: 1em; padding-left: 2em; }
            li { margin-bottom: 0.35em; }
            a { color: #1976d2; }
            img { max-width: 100%; height: auto; border-radius: 10px; }
            blockquote {
              border-left: 4px solid #1976d2;
              margin: 1.25em 0;
              padding: 0.75em 1em;
              background: #f5f9ff;
              color: #444;
            }
            .hero {
              width: 100%;
              height: 260px;
              object-fit: cover;
              border-radius: 12px;
              margin-bottom: 24px;
            }
            .title {
              font-size: 2rem;
              font-weight: 800;
              margin-bottom: 12px;
            }
            .summary {
              color: #666;
              font-size: 1.05rem;
              margin-bottom: 28px;
            }
          </style>
        </head>
        <body>
          ${imageUrl ? `<img class="hero" src="${getMediaUrl(imageUrl)}" alt="Featured image" />` : ''}
          ${title ? `<div class="title">${title}</div>` : ''}
          ${summary ? `<div class="summary">${summary}</div>` : ''}
          ${content || '<p style="color:#999;font-style:italic">No content yet. Start writing in the Visual tab.</p>'}
        </body>
      </html>
    `);
    doc.close();
  }, [content, imageUrl, title, summary]);

  return (
    <iframe
      ref={iframeRef}
      title="Blog Preview"
      style={{
        width: '100%',
        minHeight: '560px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        background: '#fff',
      }}
    />
  );
};

const BlogEditPage = () => {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const canManageBlogs = hasPermission(PERMISSIONS.BLOGS_MANAGE);
  const canUploadMedia = hasPermission(PERMISSIONS.MEDIA_UPLOAD);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [categories, setCategories] = useState([]);
  const [slug, setSlug] = useState('');
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [featuredImagePreview, setFeaturedImagePreview] = useState('');
  const [galleryImages, setGalleryImages] = useState([]);
  const galleryImagesRef = useRef([]);
  const [form, setForm] = useState({
    title: '',
    content: '',
    summary: '',
    status: 'draft',
    categoryIds: [],
    featuredImageId: '',
    displayDate: '',
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
  });

  const categoryOptions = useMemo(() => categories.map((c) => ({ id: c.id, name: c.name })), [categories]);

  useEffect(() => {
    galleryImagesRef.current = galleryImages;
  }, [galleryImages]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [catsRes] = await Promise.all([
          BlogService.getPublicCategories(),
        ]);
        setCategories(catsRes.data || []);

        if (!isNew) {
          const postRes = await BlogService.adminGetPostById(id);
          const post = postRes.data;
          setSlug(post.slug || '');
          setForm({
            title: post.title || '',
            content: post.content || '',
            summary: post.summary || '',
            status: post.status || 'draft',
            categoryIds: (post.categories || []).map((c) => c.id),
            featuredImageId: post.featuredImageId || '',
            displayDate: post.displayDate ? post.displayDate.slice(0, 10) : '',
            metaTitle: post.metaTitle || '',
            metaDescription: post.metaDescription || '',
            metaKeywords: post.metaKeywords || '',
          });
          setFeaturedImagePreview(post.featuredImage?.url || '');
          const nextGalleryImages = (post.gallery?.items || []).map((item) => item.media).filter(Boolean);
          galleryImagesRef.current = nextGalleryImages;
          setGalleryImages(nextGalleryImages);
        }
      } catch (error) {
        notify(getApiErrorMessage(error, 'Failed to load blog editor.'), 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isNew, navigate, notify]);

  const toPayload = () => ({
    ...form,
    galleryMediaIds: getSelectedGalleryMediaIds(galleryImagesRef.current),
    displayDate: form.displayDate || null,
  });

  const handleFeaturedImageSelect = (media = []) => {
    const selected = media?.[0];
    if (!selected) return;
    setForm((prev) => ({ ...prev, featuredImageId: selected.id }));
    setFeaturedImagePreview(selected.url || '');
    setMediaPickerOpen(false);
  };

  const handleGalleryImagesSelect = (media = []) => {
    const merged = [...galleryImagesRef.current];
    const existingIds = new Set(merged.map((item) => item.id));

    media.forEach((item) => {
      if (!existingIds.has(item.id)) {
        merged.push(item);
      }
    });

    galleryImagesRef.current = merged;
    setGalleryImages(merged);
    setGalleryPickerOpen(false);
  };

  const removeGalleryImage = (mediaId) => {
    const nextImages = galleryImagesRef.current.filter((item) => item.id !== mediaId);
    galleryImagesRef.current = nextImages;
    setGalleryImages(nextImages);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!canManageBlogs) return setSaveError('You do not have permission to manage blogs.');
    if (!form.title.trim()) return setSaveError('Title is required.');
    if (!form.content.trim() || form.content === '<p><br></p>') return setSaveError('Content is required.');

    setSaving(true);
    try {
      if (isNew) {
        const res = await BlogService.adminCreatePost(toPayload());
        const newId = res.data?.id;
        notify('Blog post created.', 'success');
        if (newId) navigate(`/admin/blogs/${newId}/edit`, { replace: true });
        else navigate('/admin/blogs');
      } else {
        const res = await BlogService.adminUpdatePost(id, toPayload());
        setSlug(res.data?.slug || slug);
        notify('Blog post updated.', 'success');
      }
    } catch (error) {
      const msg = getApiErrorMessage(error, 'Failed to save blog post.');
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
        <Link to="/admin/blogs" style={{ textDecoration: 'none', color: 'inherit' }}>Blogs</Link>
        <Typography color="text.primary">{isNew ? 'New Post' : 'Edit Post'}</Typography>
      </Breadcrumbs>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={() => navigate('/admin/blogs')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" fontWeight={700}>{isNew ? 'Create Blog Post' : `Edit: ${form.title}`}</Typography>
          {slug ? <Typography variant="caption" color="text.secondary">Slug: <code>{slug}</code></Typography> : null}
        </Box>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || !canManageBlogs}>
          {saving ? 'Saving...' : 'Save Post'}
        </Button>
      </Box>

      {saveError ? <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert> : null}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <TextField fullWidth label="Title" sx={{ mb: 2 }} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <TextField fullWidth label="Summary" multiline rows={3} sx={{ mb: 2 }} value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} />

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
                <Tab icon={<VisualIcon />} iconPosition="start" label="Visual" />
                <Tab icon={<PreviewIcon />} iconPosition="start" label="Preview" />
              </Tabs>
            </Box>

            <Box sx={{ display: activeTab === 0 ? 'block' : 'none' }}>
              <RichTextEditor
                value={form.content}
                onChange={(content) => setForm((p) => ({ ...p, content }))}
                modules={QUILL_MODULES}
                formats={QUILL_FORMATS}
                minHeight={450}
              />
            </Box>

            <Box sx={{ display: activeTab === 1 ? 'block' : 'none' }}>
              <ContentPreview
                content={form.content}
                imageUrl={featuredImagePreview}
                title={form.title}
                summary={form.summary}
              />
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>SEO</Typography>
            <TextField fullWidth label="Meta Title" sx={{ mb: 2 }} value={form.metaTitle} onChange={(e) => setForm((p) => ({ ...p, metaTitle: e.target.value }))} />
            <TextField fullWidth label="Meta Description" multiline rows={3} sx={{ mb: 2 }} value={form.metaDescription} onChange={(e) => setForm((p) => ({ ...p, metaDescription: e.target.value }))} />
            <TextField fullWidth label="Meta Keywords" value={form.metaKeywords} onChange={(e) => setForm((p) => ({ ...p, metaKeywords: e.target.value }))} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Settings</Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="published">Published</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="date"
              label="Date"
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
              value={form.displayDate}
              onChange={(e) => setForm((p) => ({ ...p, displayDate: e.target.value }))}
            />

            <FormControl fullWidth>
              <InputLabel>Categories</InputLabel>
              <Select
                multiple
                value={form.categoryIds}
                onChange={(e) => setForm((p) => ({ ...p, categoryIds: e.target.value }))}
                input={<OutlinedInput label="Categories" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const cat = categoryOptions.find((c) => c.id === value);
                      return <Chip key={value} label={cat?.name || value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {categoryOptions.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Featured Image</Typography>
            {featuredImagePreview ? (
              <Box sx={{ mb: 1 }}>
                <img
                  src={getMediaUrl(featuredImagePreview)}
                  alt="Featured"
                  style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }}
                />
              </Box>
            ) : null}
            {canUploadMedia ? (
              <Button variant="outlined" fullWidth onClick={() => setMediaPickerOpen(true)} sx={{ mb: 1 }}>
                {featuredImagePreview ? 'Change Featured Image' : 'Select Featured Image'}
              </Button>
            ) : (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Media upload permission is required to set featured image.
              </Typography>
            )}
            {featuredImagePreview ? (
              <Button
                size="small"
                color="error"
                onClick={() => {
                  setForm((p) => ({ ...p, featuredImageId: '' }));
                  setFeaturedImagePreview('');
                }}
              >
                Remove Featured Image
              </Button>
            ) : null}

            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Blog Images</Typography>
            {canUploadMedia ? (
              <Button variant="outlined" fullWidth onClick={() => setGalleryPickerOpen(true)} sx={{ mb: 1.5 }}>
                Add Blog Images
              </Button>
            ) : (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                Media upload permission is required to add blog images.
              </Typography>
            )}

            {galleryImages.length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, 1fr)',
                    sm: 'repeat(3, 1fr)',
                    md: 'repeat(4, 1fr)',
                  },
                  gap: 1,
                  mb: 1.5,
                }}
              >
                {galleryImages.map((image) => (
                  <Box key={image.id} sx={{ position: 'relative' }}>
                    <img
                      src={getMediaUrl(image.url)}
                      alt={image.alt || image.originalName || 'Blog image'}
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 8, display: 'block' }}
                    />
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      onClick={() => removeGalleryImage(image.id)}
                      sx={{ position: 'absolute', right: 6, top: 6, minWidth: 'auto', px: 1 }}
                    >
                      X
                    </Button>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                No blog images selected yet.
              </Typography>
            )}

            <MediaPicker
              open={mediaPickerOpen}
              onClose={() => setMediaPickerOpen(false)}
              onSelect={handleFeaturedImageSelect}
              multiple={false}
              title="Select Featured Image"
            />
            <MediaPicker
              open={galleryPickerOpen}
              onClose={() => setGalleryPickerOpen(false)}
              onSelect={handleGalleryImagesSelect}
              multiple
              title="Add Blog Images"
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BlogEditPage;
