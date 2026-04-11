import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PageSEO from '../../components/common/PageSEO';
import AppliedDiscountsSummary from '../../components/orders/AppliedDiscountsSummary';
import { useCurrency } from '../../hooks/useSettings';
import { userService } from '../../services/userService';

const ORDER_STATUS_COLOR = {
  pending_payment: 'warning',
  paid: 'info',
  processing: 'info',
  shipped: 'primary',
  delivered: 'success',
  cancelled: 'error',
  refunded: 'default',
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
      try {
        const orderData = await userService.getMyOrderById(id);
        setOrder(orderData || null);
      } catch (fetchError) {
        setError(fetchError?.response?.data?.error?.message || 'Failed to load order details.');
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    setActionLoading(true);
    try {
      await userService.cancelOrder(id);
      setOrder((current) => (current ? { ...current, status: 'cancelled' } : current));
    } catch (cancelError) {
      setError(cancelError?.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setActionLoading(false);
    }
  };

  const orderItems = useMemo(
    () => (order?.items || order?.OrderItems || []).filter(Boolean),
    [order]
  );
  const appliedDiscounts = Array.isArray(order?.appliedDiscounts) ? order.appliedDiscounts : [];
  const address = order?.shippingAddressSnapshot;
  const canCancel = ['pending_payment', 'processing'].includes(order?.status);

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!order) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Order not found.'}</Alert>
        <Button variant="outlined" onClick={() => navigate('/account')}>
          Back to account
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <PageSEO title={`Order ${order.orderNumber}`} type="noindex" />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box>
          <Button variant="outlined" size="small" sx={{ mb: 1.5 }} onClick={() => navigate('/account')}>
            ← Back to account
          </Button>
          <Typography variant="h4" fontWeight={700}>
            {order.orderNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Placed on {new Date(order.createdAt).toLocaleString()}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={order.status} color={ORDER_STATUS_COLOR[order.status] || 'default'} />
          {canCancel && (
            <Button color="error" variant="outlined" onClick={handleCancel} disabled={actionLoading}>
              {actionLoading ? 'Cancelling…' : 'Cancel order'}
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ReceiptLongIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>Items</Typography>
            </Box>
            {orderItems.map((item) => (
              <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography variant="body1" fontWeight={600}>{item.snapshotName}</Typography>
                  <Typography variant="body2" color="text.secondary">SKU: {item.snapshotSku || '—'}</Typography>
                  {item.variantInfo && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {Object.entries(item.variantInfo)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ')}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">Qty: {item.quantity}</Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="body2" color="text.secondary">
                    {formatPrice(item.snapshotPrice || 0)} each
                  </Typography>
                  <Typography variant="body1" fontWeight={700}>
                    {formatPrice(item.total || 0)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Paper>

          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Promotions & totals</Typography>
            <AppliedDiscountsSummary discounts={appliedDiscounts} formatPrice={formatPrice} showEmpty />
            <Divider sx={{ my: 2 }} />
            {[
              ['Subtotal', order.subtotal],
              ['Tax', order.tax],
              ['Shipping', order.shippingCost],
              ['Discount', order.discountAmount],
            ].map(([label, value]) => (
              Number(value || 0) > 0 && (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography color="text.secondary">{label}</Typography>
                  <Typography color={label === 'Discount' ? 'success.main' : 'text.primary'}>
                    {label === 'Discount' ? '-' : ''}{formatPrice(value || 0)}
                  </Typography>
                </Box>
              )
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5 }}>
              <Typography variant="h6" fontWeight={700}>Total</Typography>
              <Typography variant="h6" fontWeight={700} color="primary.main">
                {formatPrice(order.total || 0)}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <LocalShippingIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>Shipping address</Typography>
            </Box>
            {address ? (
              <>
                <Typography variant="body2">{address.fullName}</Typography>
                <Typography variant="body2">{address.addressLine1}</Typography>
                {address.addressLine2 && <Typography variant="body2">{address.addressLine2}</Typography>}
                <Typography variant="body2">{address.city}, {address.state} {address.postalCode}</Typography>
                <Typography variant="body2">{address.country}</Typography>
                {address.phone && <Typography variant="body2">{address.phone}</Typography>}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">No shipping address snapshot available.</Typography>
            )}
          </Paper>

          {order.notes && (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700} mb={1.5}>Order notes</Typography>
              <Typography variant="body2" color="text.secondary">{order.notes}</Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default OrderDetailPage;
