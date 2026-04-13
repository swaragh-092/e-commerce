import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import PageService from '../../services/pageService';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

const PagesManagePage = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [rowCount, setRowCount] = useState(0);
  const navigate = useNavigate();
  const notify = useNotification();
  const { hasPermission } = useAuth();
  const canManagePages = hasPermission(PERMISSIONS.PAGES_MANAGE);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const response = await PageService.adminGetPages({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      });
      setPages(response.data);
      setRowCount(response.meta?.total || 0);
    } catch (error) {
      console.error('Error fetching pages:', error);
      notify(getApiErrorMessage(error, 'Failed to load pages.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, [paginationModel.page, paginationModel.pageSize]);

  const handleDeleteClick = (page) => {
    setSelectedPage(page);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedPage?.id || !canManagePages) {
      setDeleteDialogOpen(false);
      return;
    }

    try {
      await PageService.adminDeletePage(selectedPage.id);
      notify('Page deleted successfully.', 'success');
      fetchPages();
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting page:', error);
      notify(getApiErrorMessage(error, 'Failed to delete page.'), 'error');
    }
  };

  const columns = [
    { field: 'title', headerName: 'Title', flex: 1 },
    { field: 'slug', headerName: 'Slug', flex: 1 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === 'published' ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'linkPosition',
      headerName: 'Position',
      width: 120,
    },
    {
        field: 'isSystem',
        headerName: 'System',
        width: 100,
        renderCell: (params) => (
          params.value ? <Chip label="System" size="small" color="secondary" /> : null
        ),
      },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="View Storefront">
            <IconButton onClick={() => window.open(`/p/${params.row.slug}`, '_blank')}>
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <span>
            <IconButton onClick={() => navigate(`/admin/pages/${params.row.id}/edit`)} disabled={!canManagePages}>
              <EditIcon />
            </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={params.row.isSystem ? "Cannot Delete System Page" : "Delete"}>
            <span>
              <IconButton
                onClick={() => handleDeleteClick(params.row)}
                disabled={params.row.isSystem || !canManagePages}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Dynamic Static Pages</Typography>
        {canManagePages && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/pages/new')}
          >
            Add New Page
          </Button>
        )}
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={pages}
          columns={columns}
          loading={loading}
          rowCount={rowCount}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 20, 50]}
          disableSelectionOnClick
        />
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Page</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the page "{selectedPage?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PagesManagePage;
