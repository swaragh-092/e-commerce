import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  useMediaQuery,
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
import ResponsiveDataGrid from '../../components/admin/ResponsiveDataGrid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import useAdminListQuery from '../../hooks/useAdminListQuery';
import { getUsers, updateUserStatus } from '../../services/adminService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { formatDateOnly } from '../../utils/dates';

const CustomersPage = () => {
  const compact = useMediaQuery('(max-width: 1200px)');
  const narrow = useMediaQuery('(max-width: 850px)');
  const phone = useMediaQuery('(max-width: 600px)');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(-1);
  const [loading, setLoading] = useState(true);
  const { params, updateQuery, paginationModel, setPaginationModel, returnTo } = useAdminListQuery(20, 100);
  const search = params.get('search') || '';
  const navigate = useNavigate();
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
      await updateUserStatus(id, newStatus);
      notify(`User status updated to ${newStatus} successfully.`, 'success');
      fetchUsers();
    } catch {
      notify('Failed to update user status.', 'error');
    }
  };

  const columns = [
    {
      field: 'firstName',
      headerName: narrow ? 'Customer' : 'First',
      minWidth: 110,
      flex: narrow ? 1 : undefined,
      width: 120,
      renderCell: ({ row }) => (
        <Typography
          component="button"
          type="button"
          onClick={() => navigate(`/admin/customers/${row.id}`, { state: { returnTo } })}
          aria-label={`View customer ${[row.firstName, row.lastName].filter(Boolean).join(' ') || row.email}`}
          sx={{ p: 0, border: 0, background: 'none', color: 'primary.main', font: 'inherit', textAlign: 'left', cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}
        >
          {(narrow ? [row.firstName, row.lastName].filter(Boolean).join(' ') : row.firstName) || row.email}
        </Typography>
      ),
    },
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
      renderCell: ({ value }) => formatDateOnly(value),
    },
    {
      field: 'actions',
      headerName: '',
      width: 110,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="View customer">
            <IconButton size="small" color="primary" onClick={() => navigate(`/admin/customers/${row.id}`, { state: { returnTo } })}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" component="h1" fontWeight={700} mb={3}>
        Customers
      </Typography>

      <Stack direction="row" mb={2}>
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(e) => updateQuery({ search: e.target.value, page: null })}
          sx={{ width: 240 }}
        />
      </Stack>

      <Box
        sx={{
          height: 580,
          minWidth: 0,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          requiredColumns={['firstName', 'actions']}
          columnVisibilityModel={{ lastName: !narrow, email: !phone, emailVerified: !compact, createdAt: !compact, status: !phone }}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          pageSizeOptions={[10, 20, 50, 100]}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          onRowDoubleClick={(params) => navigate(`/admin/customers/${params.row.id}`, { state: { returnTo } })}
          disableRowSelectionOnClick
        />
      </Box>
    </Box>
  );
};

export default CustomersPage;
