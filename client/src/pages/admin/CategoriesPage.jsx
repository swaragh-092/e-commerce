import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Tooltip,
  Divider,
  Stack,
  MenuItem,
  CardMedia,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../services/categoryService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import MediaUploader from '../../components/common/MediaUploader';
import { getMediaUrl } from '../../utils/media';

/* ─── helpers ─────────────────────────────────────────────────── */
const flattenTree = (nodes, result = []) => {
  nodes.forEach((n) => {
    result.push(n);
    if (n.children?.length) flattenTree(n.children, result);
  });
  return result;
};

/* ─── CategoryRow ──────────────────────────────────────────────── */
const CategoryRow = ({ node, level, onEdit, onDelete, onAddChild, canManage }) => {
  const hasChildren = node.children?.length > 0;

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          pl: 2 + level * 3,
          gap: 1.5,
          bgcolor: level === 0 ? 'action.hover' : 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:hover': { bgcolor: 'action.selected' },
          transition: 'background-color 0.15s',
        }}
      >
        {/* icon */}
        <Box sx={{ color: level === 0 ? 'primary.main' : 'text.secondary', display: 'flex' }}>
          {hasChildren ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
        </Box>

        {/* image thumbnail */}
        {node.image && level === 0 && (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <img src={getMediaUrl(node.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
        )}

        {/* name */}
        <Typography
          sx={{
            flexGrow: 1,
            fontWeight: level === 0 ? 600 : 400,
            fontSize: level === 0 ? '0.95rem' : '0.875rem',
            color: level === 0 ? 'text.primary' : 'text.secondary',
          }}
        >
          {node.name}
        </Typography>

        {/* sub-count badge */}
        {hasChildren && (
          <Chip
            label={`${node.children.length} sub`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
        )}

        {/* description hint */}
        {node.description && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{
              display: { xs: 'none', md: 'block' },
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.description}
          </Typography>
        )}

        {/* actions */}
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Add sub-category">
            <IconButton size="small" onClick={() => onAddChild(node)} disabled={!canManage}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEdit(node)} disabled={!canManage}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => onDelete(node.id)} disabled={!canManage}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* recurse for children */}
      {node.children?.map((child) => (
        <CategoryRow
          key={child.id}
          node={child}
          level={level + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          canManage={canManage}
        />
      ))}
    </>
  );
};

/* ─── Main page ────────────────────────────────────────────────── */
const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', parentId: '', image: '' });
  const [formErrors, setFormErrors] = useState({});
  const notify = useNotification();
  const { hasPermission } = useAuth();
  const canManageCategories = hasPermission(PERMISSIONS.CATEGORIES_MANAGE);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await getCategoryTree();
      setCategories(res?.data?.categories || []);
    } catch {
      notify('Failed to load categories.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreate = (parent = null) => {
    if (!canManageCategories) {
      notify('You do not have permission to manage categories.', 'error');
      return;
    }

    setEditingCat(null);
    setFormData({ name: '', description: '', parentId: parent?.id || '', image: '' });
    setFormErrors({});
    setOpen(true);
  };

  const openEdit = (cat) => {
    if (!canManageCategories) {
      notify('You do not have permission to manage categories.', 'error');
      return;
    }

    setEditingCat(cat);
    setFormData({
      name: cat.name,
      description: cat.description || '',
      parentId: cat.parentId || '',
      image: cat.image || '',
    });
    setFormErrors({});
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCat(null);
  };

  const handleSave = async () => {
    if (!canManageCategories) {
      notify('You do not have permission to manage categories.', 'error');
      return;
    }

    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required.';
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const data = { ...formData, parentId: formData.parentId || null };
      if (!data.image) data.image = null; // Clean up empty strings

      if (editingCat) {
        await updateCategory(editingCat.id, data);
        notify('Category updated successfully.', 'success');
      } else {
        await createCategory(data);
        notify('Category created successfully.', 'success');
      }
      handleClose();
      fetchCategories();
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canManageCategories) {
      notify('You do not have permission to manage categories.', 'error');
      return;
    }

    if (!window.confirm('Delete this category? Sub-categories may also be affected.')) return;
    try {
      await deleteCategory(id);
      notify('Category deleted successfully.', 'success');
      fetchCategories();
    } catch (err) {
      notify(`Cannot delete: ${getApiErrorMessage(err)}`, 'error');
    }
  };

  const flatCategories = flattenTree(categories);
  const totalCount = flatCategories.length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Categories
          </Typography>
          {!loading && (
            <Typography variant="body2" color="text.secondary">
              {totalCount} {totalCount === 1 ? 'category' : 'categories'} total
            </Typography>
          )}
        </Box>
        {canManageCategories && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate()}>
            Add Category
          </Button>
        )}
      </Box>

      {/* Tree */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : categories.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <FolderOpenIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography>No categories yet.</Typography>
            <Button sx={{ mt: 1 }} onClick={() => openCreate()} disabled={!canManageCategories}>
              Create your first category
            </Button>
          </Box>
        ) : (
          categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              node={cat}
              level={0}
              onEdit={openEdit}
              onDelete={handleDelete}
              onAddChild={openCreate}
              canManage={canManageCategories}
            />
          ))
        )}
      </Paper>

      {/* Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>{editingCat ? 'Edit Category' : 'New Category'}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Category Image</Typography>
            {formData.image ? (
              <Box sx={{ position: 'relative', width: '100%', height: 160, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                <CardMedia
                    component="img"
                    image={getMediaUrl(formData.image)}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <IconButton 
                  size="small" 
                  onClick={() => setFormData(f => ({ ...f, image: '' }))}
                  sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <MediaUploader 
                multiple={false} 
                onUploadSuccess={(media) => {
                  setFormData(f => ({ ...f, image: media.url }));
                }} 
              />
            )}
          </Box>

          <TextField
            autoFocus
            label="Name *"
            fullWidth
            size="small"
            value={formData.name}
            error={!!formErrors.name}
            helperText={formErrors.name}
            onChange={(e) => {
              setFormData((f) => ({ ...f, name: e.target.value }));
              if (formErrors.name) setFormErrors((f) => ({ ...f, name: undefined }));
            }}
          />
          <TextField
            label="Description"
            fullWidth
            size="small"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
          />
          <TextField
            select
            label="Parent Category"
            fullWidth
            size="small"
            value={formData.parentId}
            onChange={(e) => setFormData((f) => ({ ...f, parentId: e.target.value }))}
            helperText="Leave empty to create a top-level category"
          >
            <MenuItem value="">— None (top level) —</MenuItem>
            {flatCategories
              .filter((c) => c.id !== editingCat?.id)
              .map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.parentId ? `↳ ${c.name}` : c.name}
                </MenuItem>
              ))}
          </TextField>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !canManageCategories}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CategoriesPage;
