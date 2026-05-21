import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import BlogService from '../../services/blogService';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

const emptyForm = { name: '', description: '' };

const BlogCategoriesPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const canManageBlogs = hasPermission(PERMISSIONS.BLOGS_MANAGE);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await BlogService.getPublicCategories();
      setRows(res.data || []);
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to load categories.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) {
      notify('Category name is required.', 'error');
      return;
    }
    try {
      if (editing?.id) {
        await BlogService.adminUpdateCategory(editing.id, form);
        notify('Category updated.', 'success');
      } else {
        await BlogService.adminCreateCategory(form);
        notify('Category created.', 'success');
      }
      setOpen(false);
      setForm(emptyForm);
      setEditing(null);
      fetchData();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to save category.'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!editing?.id) return setDeleteOpen(false);
    try {
      await BlogService.adminDeleteCategory(editing.id);
      notify('Category deleted.', 'success');
      setDeleteOpen(false);
      setEditing(null);
      fetchData();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to delete category.'), 'error');
    }
  };

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
    { field: 'slug', headerName: 'Slug', flex: 1, minWidth: 180 },
    { field: 'description', headerName: 'Description', flex: 1.6, minWidth: 260 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 130,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit">
            <span>
              <IconButton
                size="small"
                disabled={!canManageBlogs}
                onClick={() => {
                  setEditing(params.row);
                  setForm({ name: params.row.name || '', description: params.row.description || '' });
                  setOpen(true);
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={!canManageBlogs}
                onClick={() => {
                  setEditing(params.row);
                  setDeleteOpen(true);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Blog Categories</Typography>
        {canManageBlogs && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setOpen(true);
            }}
          >
            Add Category
          </Button>
        )}
      </Box>

      <Paper sx={{ height: 620, width: '100%' }}>
        <DataGrid rows={rows} columns={columns} loading={loading} disableRowSelectionOnClick />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing?.id ? 'Edit Category' : 'Create Category'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Description"
            multiline
            minRows={3}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete "{editing?.name}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BlogCategoriesPage;
