import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate, useParams } from 'react-router-dom';
import { getUserById } from '../../services/adminService';
import { useCurrency } from '../../hooks/useSettings';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { getOrderStatusColor, getOrderStatusLabel } from '../../utils/orderWorkflow';

const DetailCard = ({ title, children }) => (
  <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
    <Typography variant="h6" fontWeight={700} mb={2}>
      {title}
    </Typography>
    {children}
  </Paper>
);

const Field = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={600}>
      {value || '-'}
    </Typography>
  </Box>
);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const CustomerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    getUserById(id)
      .then((res) => {
        if (!active) return;
        setCustomer(res.data.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(getApiErrorMessage(err, 'Failed to load customer details.'));
        setCustomer(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const fullName = useMemo(() => {
    if (!customer) return '';
    return [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email;
  }, [customer]);

  const addresses = customer?.Addresses || customer?.addresses || [];
  const orders = customer?.Orders || customer?.orders || [];
  const totalSpend = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!customer) {
    return <Alert severity="error">{error || 'Customer not found.'}</Alert>;
  }

  return (
    <Box>
      <Button
        variant="outlined"
        size="small"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
        onClick={() => navigate('/admin/customers')}
      >
        Back to Customers
      </Button>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start', mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            {fullName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {customer.email}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip label={customer.status || 'unknown'} color={customer.status === 'active' ? 'success' : customer.status === 'banned' ? 'error' : 'default'} />
          <Chip label={customer.emailVerified ? 'Verified' : 'Unverified'} color={customer.emailVerified ? 'success' : 'default'} variant="outlined" />
        </Stack>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            <DetailCard title="Customer Profile">
              <Stack spacing={1.5}>
                <Field label="Customer ID" value={customer.id} />
                <Field label="First name" value={customer.firstName} />
                <Field label="Last name" value={customer.lastName} />
                <Field label="Role" value={customer.role} />
                <Field label="Joined" value={formatDateTime(customer.createdAt)} />
                <Field label="Last login" value={formatDateTime(customer.lastLoginAt)} />
              </Stack>
            </DetailCard>

            <DetailCard title="Contact">
              <Stack spacing={1.5}>
                <Field label="Email" value={customer.email} />
                <Field label="Phone" value={customer.profile?.phone} />
                <Field label="Gender" value={customer.profile?.gender} />
                <Field label="Date of birth" value={customer.profile?.dateOfBirth} />
              </Stack>
            </DetailCard>
          </Stack>
        </Grid>

        <Grid item xs={12} md={8}>
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Recent orders</Typography>
                  <Typography variant="h6" fontWeight={800}>{orders.length}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Recent spend</Typography>
                  <Typography variant="h6" fontWeight={800}>{formatPrice(totalSpend)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Addresses</Typography>
                  <Typography variant="h6" fontWeight={800}>{addresses.length}</Typography>
                </Paper>
              </Grid>
            </Grid>

            <DetailCard title="Recent Orders">
              {orders.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No recent orders found.</Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {orders.map((order) => (
                    <Box key={order.id} sx={{ py: 1.5, display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700}>{order.orderNumber}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatDateTime(order.createdAt)}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={getOrderStatusLabel(order.status)} color={getOrderStatusColor(order.status)} />
                        <Typography variant="body2" fontWeight={700}>{formatPrice(order.total || 0)}</Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          endIcon={<OpenInNewIcon fontSize="small" />}
                          onClick={() => window.open(`/admin/orders/${order.id}`, '_blank', 'noopener,noreferrer')}
                        >
                          Order
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </DetailCard>

            <DetailCard title="Addresses">
              {addresses.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No saved addresses.</Typography>
              ) : (
                <Grid container spacing={2}>
                  {addresses.map((address) => (
                    <Grid item xs={12} sm={6} key={address.id}>
                      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="body2" fontWeight={700}>{address.label || 'Address'}</Typography>
                          {address.isDefault && <Chip label="Default" size="small" color="primary" />}
                        </Stack>
                        <Typography variant="body2">{address.fullName}</Typography>
                        <Typography variant="body2" color="text.secondary">{address.addressLine1}</Typography>
                        {address.addressLine2 && <Typography variant="body2" color="text.secondary">{address.addressLine2}</Typography>}
                        <Typography variant="body2" color="text.secondary">
                          {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">{address.country}</Typography>
                        {address.phone && <Typography variant="body2" color="text.secondary">{address.phone}</Typography>}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </DetailCard>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CustomerDetailPage;
