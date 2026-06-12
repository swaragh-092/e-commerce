import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableBody, TableCell, TableHead, TableRow,
  Typography, Chip, Pagination, Skeleton,
} from '@mui/material';
import { useCurrency } from '../../../hooks/useSettings';
import { getDrillDown } from '../../../services/adminService';

const STATUS_COLORS = {
  pending_payment: 'default',
  confirmed: 'info',
  processing: 'warning',
  ready_for_shipment: 'primary',
  closed: 'success',
  cancelled: 'error',
};

const DrillDownDialog = ({ open, onClose, metric, filterValue, label, period = '30d' }) => {
  const { formatPrice } = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!open || !metric) return;
    setLoading(true);
    getDrillDown({ metric, filterValue, period, page, limit: 15 })
      .then((res) => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, metric, filterValue, period, page]);

  useEffect(() => {
    if (open) setPage(1);
  }, [open, metric, filterValue]);

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        {label || 'Drill Down'} — Orders
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Skeleton variant="rectangular" height={300} />
        ) : data?.orders?.length > 0 ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {data.total} order{data.total !== 1 ? 's' : ''} found
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order #</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.orders.map((o) => (
                  <TableRow key={o.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{o.orderNumber}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{o.customer}</Typography>
                      <Typography variant="caption" color="text.secondary">{o.customerEmail}</Typography>
                    </TableCell>
                    <TableCell>{fmtDate(o.createdAt)}</TableCell>
                    <TableCell>{o.paymentMethod}</TableCell>
                    <TableCell><Chip label={o.status} size="small" color={STATUS_COLORS[o.status] || 'default'} /></TableCell>
                    <TableCell align="right">{formatPrice(o.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.totalPages > 1 && (
              <Pagination
                count={data.totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                size="small"
                sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}
              />
            )}
          </>
        ) : (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No orders found for this filter.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DrillDownDialog;
