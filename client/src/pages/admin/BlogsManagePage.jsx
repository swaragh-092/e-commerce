import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import BlogService from '../../services/blogService';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

const BlogsManagePage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [rowCount, setRowCount] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [savingStatuses, setSavingStatuses] = useState(() => new Set());

  const navigate = useNavigate();
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const canManageBlogs = hasPermission(PERMISSIONS.BLOGS_MANAGE);

  useEffect(() => {
    if (!canManageBlogs) { setDeleteOpen(false); setSelected(null); }
  }, [canManageBlogs]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await BlogService.adminGetPosts({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      });
      setRows(res.data || []);
      setRowCount(res.meta?.total || 0);
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to load blog posts.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [paginationModel.page, paginationModel.pageSize]);

  const confirmDelete = async () => {
    if (!selected?.id || !canManageBlogs) return setDeleteOpen(false);
    try {
      await BlogService.adminDeletePost(selected.id);
      notify('Blog post deleted successfully.', 'success');
      setDeleteOpen(false);
      fetchData();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to delete blog post.'), 'error');
    }
  };

  const handleStatusChange = async (post, nextStatus) => {
    if (!canManageBlogs || !post?.id || nextStatus === post.status || savingStatuses.has(post.id)) return;

    const previousStatus = post.status;
    setSavingStatuses((current) => new Set(current).add(post.id));
    setRows((current) => current.map((row) => row.id === post.id ? { ...row, status: nextStatus } : row));
    try {
      const response = await BlogService.adminUpdatePost(post.id, { status: nextStatus });
      const savedPost = response?.data;
      if (savedPost) {
        setRows((current) => current.map((row) => row.id === post.id ? { ...row, ...savedPost } : row));
      }
      notify(`Blog post status updated to ${nextStatus}.`, 'success');
    } catch (error) {
      setRows((current) => current.map((row) => row.id === post.id ? { ...row, status: previousStatus } : row));
      notify(getApiErrorMessage(error, 'Failed to update blog post status.'), 'error');
    } finally {
      setSavingStatuses((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    }
  };

  const columns = useMemo(() => ([
    {
      field: 'title',
      headerName: 'Title',
      flex: 1.2,
      minWidth: 220,
      renderCell: (params) => (
        <Typography
          component="button"
          type="button"
          onClick={() => navigate(`/admin/blogs/${params.row.id}/edit`)}
          disabled={!canManageBlogs}
          aria-label={`Edit blog ${params.row.title}`}
          sx={{ p: 0, border: 0, background: 'none', color: canManageBlogs ? 'primary.main' : 'text.primary', font: 'inherit', textAlign: 'left', cursor: canManageBlogs ? 'pointer' : 'default', '&:hover': canManageBlogs ? { textDecoration: 'underline' } : {}, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}
        >
          {params.value}
        </Typography>
      ),
    },
    { field: 'slug', headerName: 'Slug', flex: 1, minWidth: 180 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const status = params.value || params.row.status || 'draft';
        if (!canManageBlogs) {
          return <Chip size="small" label={status} color={status === 'published' ? 'success' : 'default'} />;
        }

        return (
          <FormControl size="small" variant="standard" fullWidth>
            <Select
              value={status}
              onChange={(event) => handleStatusChange(params.row, event.target.value)}
              disabled={savingStatuses.has(params.row.id)}
              disableUnderline
              inputProps={{ 'aria-label': `Status for ${params.row.title}` }}
              sx={{ '& .MuiSelect-select': { py: 0.5 } }}
              renderValue={(value) => (
                <Chip size="small" label={value} color={value === 'published' ? 'success' : 'default'} />
              )}
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="published">Published</MenuItem>
            </Select>
          </FormControl>
        );
      },
    },
    {
      field: 'displayDate',
      headerName: 'Date',
      minWidth: 130,
      sortable: false,
      renderCell: (params) => {
        const dateValue = params?.row?.displayDate || params?.row?.publishedAt;
        return dateValue ? new Date(dateValue).toLocaleDateString() : '-';
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 170,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit">
            <span>
              <IconButton disabled={!canManageBlogs} onClick={() => navigate(`/admin/blogs/${params.row.id}/edit`)}>
                <EditIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete">
            <span>
              <IconButton
                color="error"
                disabled={!canManageBlogs}
                onClick={() => {
                  setSelected(params.row);
                  setDeleteOpen(true);
                }}
              >
                <DeleteIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ]), [canManageBlogs, navigate, savingStatuses]);

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Typography variant="h4" component="h1">Blog Posts</Typography>
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={() => navigate('/admin/blogs/categories')}>Manage Categories</Button>
          {canManageBlogs && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/admin/blogs/new')}>
              New Blog Post
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ height: 620, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          paginationMode="server"
          rowCount={rowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 20, 50]}
          disableRowSelectionOnClick
        />
      </Paper>

      <Dialog open={canManageBlogs && deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Blog Post</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete "{selected?.title}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BlogsManagePage;
