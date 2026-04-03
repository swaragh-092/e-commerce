import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tooltip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts, deleteProduct } from '../../services/productService';
import { useNotification } from '../../context/NotificationContext';

const ProductsManagePage = () => {
  const navigate = useNavigate();
  const notify = useNotification();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });

  // filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchProducts = useCallback(() => {
    setLoading(true);
    const params = {
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      ...(search && { search }),
      ...(status && { status }),
    };
    getProducts(params)
      .then((res) => {
        setRows(res?.data || []);
        setTotal(res?.meta?.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [paginationModel, search, status]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Debounce search: only fire when user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleStatusChange = (val) => {
    setStatus(val);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteProduct(id);
      notify('Product deleted.', 'success');
      fetchProducts();
    } catch (err) {
      notify('Failed to delete product: ' + err.message, 'error');
    }
  };

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    {
      field: 'price',
      headerName: 'Price',
      width: 100,
      renderCell: ({ value }) => `$${parseFloat(value).toFixed(2)}`,
    },
    {
      field: 'salePrice',
      headerName: 'Sale Price',
      width: 110,
      renderCell: ({ value }) => (value ? `$${parseFloat(value).toFixed(2)}` : '—'),
    },
    { field: 'quantity', headerName: 'Stock', width: 80 },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" color={value === 'published' ? 'success' : 'default'} />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 90,
      sortable: false,
      renderCell: ({ row }) => (
        <>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => navigate(`/admin/products/${row.id}/edit`)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Manage Products
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          component={Link}
          to="/admin/products/new"
        >
          Add Product
        </Button>
      </Box>

      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
        <TextField
          size="small"
          label="Search name / description"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={status}
            label="Status"
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="published">Published</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Box
        sx={{
          height: 600,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 20, 50]}
          disableRowSelectionOnClick
          rowHeight={56}
        />
      </Box>
    </Box>
  );
};

export default ProductsManagePage;
