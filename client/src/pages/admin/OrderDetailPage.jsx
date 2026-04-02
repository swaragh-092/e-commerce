import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Paper, Chip, Divider, Button, MenuItem,
  Select, FormControl, InputLabel, Alert, CircularProgress, Tooltip,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderById, updateOrderStatus, refundOrder } from '../../services/adminService';

const STATUS_ORDER = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

const statusColor = {
  pending_payment: 'warning', paid: 'info', processing: 'info',
  shipped: 'primary', delivered: 'success', cancelled: 'error', refunded: 'default',
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [updating, setUpdating] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    getOrderById(id)
      .then((res) => {
        setOrder(res.data.data);
        setNewStatus(res.data.data.status);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusUpdate = async () => {
    setUpdating(true);
    try {
      await updateOrderStatus(id, newStatus);
      setOrder((o) => ({ ...o, status: newStatus }));
      setAlert({ type: 'success', msg: 'Order status updated.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.error?.message || 'Failed to update status.' });
    } finally {
      setUpdating(false);
    }
  };

  const handleRefund = async () => {
    if (!window.confirm('Issue a full refund for this order?')) return;
    setUpdating(true);
    try {
      await refundOrder(id);
      setAlert({ type: 'success', msg: 'Refund initiated successfully.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.error?.message || 'Failed to initiate refund.' });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!order) return <Alert severity="error">Order not found.</Alert>;

  const addr = order.shippingAddressSnapshot;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button variant="outlined" size="small" onClick={() => navigate('/admin/orders')}>← Back</Button>
        <Typography variant="h5" fontWeight={700}>{order.orderNumber}</Typography>
        <Chip label={order.status} color={statusColor[order.status] || 'default'} />
      </Box>

      {alert && <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>{alert.msg}</Alert>}

      <Grid container spacing={3}>
        {/* Order Items */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={600} mb={2}>Items</Typography>
            {(order.OrderItems || []).map((item) => (
              <Box key={item.id} sx={{ display: 'flex', gap: 2, mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                {item.snapshotImage && (
                  <Box component="img" src={item.snapshotImage} alt={item.snapshotName}
                    sx={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 1 }} />
                )}
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{item.snapshotName}</Typography>
                  <Typography variant="caption" color="text.secondary">SKU: {item.snapshotSku}</Typography>
                  {item.variantInfo && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {Object.entries(item.variantInfo).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </Typography>
                  )}
                </Box>
                <Box textAlign="right">
                  <Typography variant="body2">${parseFloat(item.snapshotPrice).toFixed(2)} × {item.quantity}</Typography>
                  <Typography variant="body2" fontWeight={600}>${parseFloat(item.total).toFixed(2)}</Typography>
                </Box>
              </Box>
            ))}
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box>
                {[['Subtotal', order.subtotal], ['Tax', order.tax], ['Shipping', order.shippingCost], ['Discount', order.discountAmount]].map(([label, val]) => (
                  parseFloat(val) > 0 && (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2">{label === 'Discount' ? '-' : ''}${parseFloat(val).toFixed(2)}</Typography>
                    </Box>
                  )
                ))}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 4, mt: 1 }}>
                  <Typography fontWeight={700}>Total</Typography>
                  <Typography fontWeight={700}>${parseFloat(order.total).toFixed(2)}</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Shipping Address */}
          {addr && (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
              <Typography variant="h6" fontWeight={600} mb={1}>Shipping Address</Typography>
              <Typography variant="body2">{addr.fullName}</Typography>
              <Typography variant="body2">{addr.addressLine1}</Typography>
              {addr.addressLine2 && <Typography variant="body2">{addr.addressLine2}</Typography>}
              <Typography variant="body2">{addr.city}, {addr.state} {addr.postalCode}</Typography>
              <Typography variant="body2">{addr.country}</Typography>
              {addr.phone && <Typography variant="body2">{addr.phone}</Typography>}
            </Paper>
          )}

          {/* Status Update */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>Update Status</Typography>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select value={newStatus} label="Status" onChange={(e) => setNewStatus(e.target.value)}>
                {STATUS_ORDER.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="contained" fullWidth disabled={updating || newStatus === order.status} onClick={handleStatusUpdate}>
              {updating ? 'Saving…' : 'Save Status'}
            </Button>
          </Paper>

          {/* Refund — backend endpoint not yet implemented */}
          {['paid', 'processing', 'shipped', 'delivered'].includes(order.status) && (
            <Tooltip title="Refund processing not yet available" placement="top">
              <span>
                <Button variant="outlined" color="error" fullWidth disabled>
                  Issue Refund (Coming Soon)
                </Button>
              </span>
            </Tooltip>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default OrderDetailPage;
