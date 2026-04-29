import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getUsers, getUserById } from '../../services/adminService';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

const CustomersPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [search, setSearch] = useState('');
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const canManageCustomers = hasPermission(PERMISSIONS.CUSTOMERS_MANAGE);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    getUsers({
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      role: 'customer',
      ...(search && { search }),
    })
      .then((res) => {
        setRows(res.data.data?.rows || res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [paginationModel, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleBan = async (id, currentStatus) => {
    if (!canManageCustomers) {
      notify('You do not have permission to manage customers.', 'error');
      return;
    }

    const newStatus = currentStatus === 'banned' ? 'active' : 'banned';
    try {
      await api.put(`/users/${id}/status`, { status: newStatus });
      notify(`User status updated to ${newStatus} successfully.`, 'success');
      fetchUsers();
    } catch {
      notify('Failed to update user status.', 'error');
    }
  };

  const columns = [
    { field: 'firstName', headerName: 'First', width: 120 },
    { field: 'lastName', headerName: 'Last', width: 120 },
    { field: 'email', headerName: 'Email', flex: 1 },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: ({ value }) => (
        <Chip
          label={value}
          size="small"
          color={value === 'active' ? 'success' : value === 'banned' ? 'error' : 'default'}
        />
      ),
    },
    {
      field: 'emailVerified',
      headerName: 'Verified',
      width: 90,
      renderCell: ({ value }) =>
        value ? (
          <Chip label="Yes" size="small" color="success" />
        ) : (
          <Chip label="No" size="small" />
        ),
    },
    {
      field: 'createdAt',
      headerName: 'Joined',
      width: 120,
      renderCell: ({ value }) => new Date(value).toLocaleDateString(),
    },
    {
      field: 'actions',
      headerName: '',
      width: 90,
      sortable: false,
      renderCell: ({ row }) => (
        <Tooltip title={row.status === 'banned' ? 'Activate' : 'Suspend'}>
          <IconButton
            size="small"
            color={row.status === 'banned' ? 'success' : 'error'}
            onClick={() => handleBan(row.id, row.status)}
            disabled={!canManageCustomers}
          >
            {row.status === 'banned' ? (
              <CheckCircleIcon fontSize="small" />
            ) : (
              <BlockIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Customers
      </Typography>

      <Stack direction="row" mb={2}>
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 240 }}
        />
      </Stack>

      <Box
        sx={{
          height: 580,
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
          disableRowSelectionOnClick
        />
      </Box>
    </Box>
  );
};

export default CustomersPage;
