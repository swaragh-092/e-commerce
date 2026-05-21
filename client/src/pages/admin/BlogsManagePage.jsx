import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Visibility as ViewIcon } from '@mui/icons-material';
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

  const navigate = useNavigate();
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const canManageBlogs = hasPermission(PERMISSIONS.BLOGS_MANAGE);

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

  const columns = useMemo(() => ([
    { field: 'title', headerName: 'Title', flex: 1.2, minWidth: 220 },
    { field: 'slug', headerName: 'Slug', flex: 1, minWidth: 180 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => <Chip size="small" label={params.value} color={params.value === 'published' ? 'success' : 'default'} />,
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
          <Tooltip title="View">
            <IconButton onClick={() => window.open(`/blogs/${params.row.slug}`, '_blank')}>
              <ViewIcon />
            </IconButton>
          </Tooltip>
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
  ]), [canManageBlogs, navigate]);

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Typography variant="h4">Blog Posts</Typography>
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

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Blog Post</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete "{selected?.title}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BlogsManagePage;
