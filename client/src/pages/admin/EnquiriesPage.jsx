import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  TextField,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReplyIcon from '@mui/icons-material/Reply';
import api from '../../services/api';
import PageSEO from '../../components/common/PageSEO';
import { useNotification } from '../../context/NotificationContext';

const EnquiriesPage = () => {
  const { notify } = useNotification();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [replyMode, setReplyMode] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/enquiries/admin', {
        params: { status: statusFilter || undefined },
      });
      setEnquiries(data.data || []);
    } catch (err) {
      console.error('Failed to load enquiries', err);
      notify('Failed to load enquiries', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, notify]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.patch(`/enquiries/admin/${id}/status`, { status: newStatus });
      setEnquiries((prev) =>
        prev.map((eq) => (eq.id === id ? { ...eq, status: newStatus } : eq))
      );
      if (selectedEnquiry && selectedEnquiry.id === id) {
        setSelectedEnquiry((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to update status', err);
      notify('Failed to update status', 'error');
    }
  };

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedEnquiry) return;
    setReplyLoading(true);
    try {
      const { data } = await api.post(`/enquiries/admin/${selectedEnquiry.id}/reply`, {
        replyMessage: replyMessage.trim()
      });
      if (data && data.data && data.data.enquiry) {
        setEnquiries((prev) =>
          prev.map((eq) => (eq.id === selectedEnquiry.id ? data.data.enquiry : eq))
        );
        notify('Reply sent successfully', 'success');
      } else {
        notify('Reply sent, but received malformed data from server', 'warning');
      }
      setSelectedEnquiry(null);
      setReplyMode(false);
      setReplyMessage('');
    } catch (err) {
      console.error('Failed to send reply', err);
      notify('Failed to send reply', 'error');
    } finally {
      setReplyLoading(false);
    }
  };

  const closeDialog = () => {
    setSelectedEnquiry(null);
    setReplyMode(false);
    setReplyMessage('');
  };

  const handleDialogClose = (event, reason) => {
    if (replyLoading && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
      return;
    }
    closeDialog();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'responded': return 'info';
      case 'closed': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageSEO title="Enquiries | Admin" type="noindex" />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Enquiries</Typography>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="responded">Responded</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : enquiries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">No enquiries found.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              enquiries.map((enquiry) => (
                <TableRow key={enquiry.id} hover>
                  <TableCell>
                    {(() => {
                      const raw = enquiry.created_at || enquiry.createdAt;
                      if (!raw) return '-';
                      const date = new Date(raw);
                      return isNaN(date.getTime()) ? '-' : date.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
                    })()}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{enquiry.name}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{enquiry.email}</Typography>
                    {enquiry.phone && <Typography variant="caption" color="text.secondary" display="block">{enquiry.phone}</Typography>}
                  </TableCell>
                  <TableCell>
                    {enquiry.product ? `Product: ${enquiry.product.name}` : (enquiry.cartItems ? 'Cart Items' : 'General')}
                  </TableCell>
                  <TableCell>
                    <Chip label={enquiry.status} size="small" color={getStatusColor(enquiry.status)} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      size="small" 
                      color="primary" 
                      onClick={() => setSelectedEnquiry(enquiry)}
                      aria-label={`View enquiry from ${enquiry.email}`}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    {/* <IconButton 
                      size="small" 
                      component="a" 
                      href={`mailto:${enquiry.email}?subject=Re: Your Enquiry`} 
                      color="secondary"
                      aria-label={`Reply to enquiry from ${enquiry.email}`}
                    >
                      <ReplyIcon fontSize="small" />
                    </IconButton> */}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedEnquiry && (
        <Dialog 
          open={Boolean(selectedEnquiry)} 
          onClose={handleDialogClose} 
          maxWidth="sm" 
          fullWidth
          disableEscapeKeyDown={replyLoading}
        >
          <DialogTitle>Enquiry Details</DialogTitle>
          <DialogContent dividers>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Customer Info</Typography>
              <Typography variant="body2"><strong>Name:</strong> {selectedEnquiry.name}</Typography>
              <Typography variant="body2"><strong>Email:</strong> {selectedEnquiry.email}</Typography>
              <Typography variant="body2"><strong>Phone:</strong> {selectedEnquiry.phone || 'N/A'}</Typography>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Subject</Typography>
              {selectedEnquiry.product ? (
                <Typography variant="body2">Product: {selectedEnquiry.product.name} (Qty: {selectedEnquiry.quantity})</Typography>
              ) : selectedEnquiry.cartItems ? (
                <Box>
                  <Typography variant="body2" gutterBottom>Cart Items ({selectedEnquiry.cartItems.length} products):</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}>
                    {selectedEnquiry.cartItems.map((item, index) => (
                      <Typography component="li" key={item.id || index} variant="body2" sx={{ py: 0.5 }}>
                        <strong>{item.product?.name || 'Unknown Product'}</strong>
                        {item.variant ? ` (${item.variant.sku || 'Variant'})` : ''} 
                        {' - '}Qty: {item.quantity}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2">General</Typography>
              )}
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Message</Typography>
              <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: 'action.hover', maxHeight: 200, overflowY: 'auto' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedEnquiry.message}</Typography>
              </Paper>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Change Status</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {['pending', 'responded', 'closed'].map((status) => (
                  <Button
                    key={status}
                    size="small"
                    variant={selectedEnquiry.status === status ? 'contained' : 'outlined'}
                    color={getStatusColor(status)}
                    onClick={() => handleStatusChange(selectedEnquiry.id, status)}
                  >
                    {status}
                  </Button>
                ))}
              </Box>
            </Box>
            
            {replyMode && (
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>Draft Reply</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Type your reply here. It will be sent via email to the customer."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  disabled={replyLoading}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog} disabled={replyLoading}>Close</Button>
            {!replyMode ? (
              <Button onClick={() => setReplyMode(true)} variant="contained" startIcon={<ReplyIcon />}>
                Reply via Email
              </Button>
            ) : (
              <Button 
                onClick={handleReply} 
                variant="contained" 
                disabled={replyLoading || !replyMessage.trim()}
              >
                {replyLoading ? <CircularProgress size={24} color="inherit" /> : 'Send Reply'}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default EnquiriesPage;
