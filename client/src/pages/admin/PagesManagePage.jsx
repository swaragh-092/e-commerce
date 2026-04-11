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

const PagesManagePage = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const navigate = useNavigate();

  const fetchPages = async () => {
    setLoading(true);
    try {
      const response = await PageService.adminGetPages();
      setPages(response.data);
    } catch (error) {
      console.error('Error fetching pages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleDeleteClick = (page) => {
    setSelectedPage(page);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await PageService.adminDeletePage(selectedPage.id);
      fetchPages();
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting page:', error);
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
            <IconButton onClick={() => navigate(`/admin/pages/${params.row.id}/edit`)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={params.row.isSystem ? "Cannot Delete System Page" : "Delete"}>
            <span>
              <IconButton
                onClick={() => handleDeleteClick(params.row)}
                disabled={params.row.isSystem}
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/pages/new')}
        >
          Add New Page
        </Button>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={pages}
          columns={columns}
          loading={loading}
          pageSize={10}
          rowsPerPageOptions={[10, 20, 50]}
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
