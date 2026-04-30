import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Tooltip,
  Divider,
  Stack,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Public as PublicIcon,
  VisibilityOff as VisibilityOffIcon,
  HelpOutline as HelpOutlineIcon
} from '@mui/icons-material';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import api from '../../services/api';

const SeoOverridesPage = () => {
  const { notify, confirm } = useNotification();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.SETTINGS_MANAGE);

  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    path: '',
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
    ogImage: '',
    canonicalUrl: '',
    noIndex: false
  });

  const fetchOverrides = async () => {
    try {
      setLoading(true);
      const response = await api.get('/seo/overrides');
      setOverrides(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch SEO overrides:', err);
      notify('Failed to load SEO overrides', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverrides();
  }, []);

  const handleOpenDialog = (override = null) => {
    if (override) {
      setEditingId(override.id);
      setFormData({
        path: override.path,
        metaTitle: override.metaTitle || '',
        metaDescription: override.metaDescription || '',
        metaKeywords: override.metaKeywords || '',
        ogImage: override.ogImage || '',
        canonicalUrl: override.canonicalUrl || '',
        noIndex: !!override.noIndex
      });
    } else {
      setEditingId(null);
      setFormData({
        path: '/',
        metaTitle: '',
        metaDescription: '',
        metaKeywords: '',
        ogImage: '',
        canonicalUrl: '',
        noIndex: false
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingId) {
        await api.put(`/seo/overrides/${editingId}`, formData);
        notify('SEO override updated successfully', 'success');
      } else {
        await api.post('/seo/overrides', formData);
        notify('SEO override created successfully', 'success');
      }
      handleCloseDialog();
      fetchOverrides();
    } catch (err) {
      notify(err.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (await confirm('Are you sure you want to delete this SEO override?')) {
      try {
        await api.delete(`/seo/overrides/${id}`);
        notify('SEO override deleted successfully', 'success');
        fetchOverrides();
      } catch (err) {
        notify('Failed to delete SEO override', 'error');
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>SEO URL Overrides</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage custom metadata for specific URL paths (e.g., Homepage, About Us, Custom Search).
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ borderRadius: 2 }}
          >
            Add Override
          </Button>
        )}
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600 }}>URL Path</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Meta Title</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Directives</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Last Updated</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>Loading...</TableCell>
              </TableRow>
            ) : overrides.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>No overrides found. Add one to get started.</TableCell>
              </TableRow>
            ) : (
              overrides.map((override) => (
                <TableRow key={override.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinkIcon fontSize="small" color="action" />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{override.path}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{override.metaTitle || <Typography variant="caption" color="text.secondary">Default</Typography>}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {override.noIndex ? (
                        <Chip size="small" label="NoIndex" color="error" variant="outlined" icon={<VisibilityOffIcon fontSize="inherit" />} />
                      ) : (
                        <Chip size="small" label="Index" color="success" variant="outlined" icon={<PublicIcon fontSize="inherit" />} />
                      )}
                      {override.canonicalUrl && <Tooltip title={`Canonical: ${override.canonicalUrl}`}><Chip size="small" label="Canonical" variant="outlined" /></Tooltip>}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(override.updatedAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {canManage && (
                      <>
                        <IconButton size="small" onClick={() => handleOpenDialog(override)} color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(override.id)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingId ? 'Edit SEO Override' : 'Add SEO Override'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Stack spacing={2.5}>
              <TextField
                label="URL Path"
                required
                fullWidth
                size="small"
                placeholder="/about-us"
                disabled={submitting}
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                helperText="Must start with / (e.g., /, /about, /search)"
              />
              
              <Divider sx={{ my: 1 }}>Metadata</Divider>

              <TextField
                label="Meta Title"
                fullWidth
                size="small"
                value={formData.metaTitle}
                onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
              />
              <TextField
                label="Meta Description"
                fullWidth
                multiline
                rows={3}
                size="small"
                value={formData.metaDescription}
                onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
              />
              <TextField
                label="Keywords"
                fullWidth
                size="small"
                value={formData.metaKeywords}
                onChange={(e) => setFormData({ ...formData, metaKeywords: e.target.value })}
                helperText="Comma separated"
              />

              <Divider sx={{ my: 1 }}>Directives</Divider>

              <TextField
                label="Canonical URL Override"
                fullWidth
                size="small"
                placeholder="https://example.com/other-page"
                value={formData.canonicalUrl}
                onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
                helperText="Only use if this page is a duplicate of another."
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.noIndex}
                    onChange={(e) => setFormData({ ...formData, noIndex: e.target.checked })}
                    color="error"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2">NoIndex (Hide from Search Engines)</Typography>
                    <Tooltip title="Tells search engines not to index this page.">
                      <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </Tooltip>
                  </Box>
                }
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleCloseDialog} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="contained" sx={{ borderRadius: 2 }} disabled={submitting}>
              {submitting ? 'Processing...' : (editingId ? 'Save Changes' : 'Create Override')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default SeoOverridesPage;
