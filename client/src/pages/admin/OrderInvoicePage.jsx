import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Divider, CircularProgress, Alert } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getOrderById } from '../../services/adminService';
import { useCurrency } from '../../hooks/useSettings';
import { SettingsContext } from '../../context/ThemeContext';
import { getApiErrorMessage } from '../../utils/apiErrors';

const OrderInvoicePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { settings } = useContext(SettingsContext);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getOrderById(id)
      .then((res) => {
        setOrder(res.data.data);
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, 'Failed to load order for invoice.'));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!order) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error || 'Order not found.'}</Alert>
        <Button onClick={() => navigate(-1)} sx={{ mt: 2 }} startIcon={<ArrowBackIcon />}>Back to Order</Button>
      </Box>
    );
  }

  const invoicePrefix = settings?.invoice?.prefix || 'INV-';
  const companyName = settings?.invoice?.companyName || settings?.general?.storeName || 'Company Name';
  const taxId = settings?.invoice?.taxRegistryNumber;
  const customNotes = settings?.invoice?.customNotes;
  const showLogo = settings?.invoice?.showLogo !== false;
  const storeLogo = settings?.invoice?.logoUrl || settings?.logo?.main;
  const storeAddress = settings?.footer?.address;
  const contactEmail = settings?.general?.contactEmail;
  
  const customerName = order.User?.firstName && order.User?.lastName 
    ? `${order.User.firstName} ${order.User.lastName}` 
    : order.shippingAddressSnapshot?.fullName || 'Customer';

  const address = order.shippingAddressSnapshot;
  const orderItems = (order.items || order.OrderItems || []).filter(Boolean);

  return (
    <Box 
      sx={{ 
        maxWidth: '800px', 
        mx: 'auto', 
        p: { xs: 2, md: 5 },
        bgcolor: '#ffffff',
        color: '#000000',
        minHeight: '100vh',
      }}
    >
      {/* Non-printable action bar */}
      <Box 
        sx={{ 
          '@media print': { display: 'none' },
          display: 'flex',
          justifyContent: 'space-between',
          mb: 4,
          pb: 2,
          borderBottom: '1px solid #eee'
        }}
      >
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/admin/orders/${id}`)}>
          Back to Order
        </Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} color="primary">
          Print Invoice
        </Button>
      </Box>

      {/* Invoice Content */}
      <Box id="printable-invoice">
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 6 }}>
          <Box>
            {showLogo && storeLogo ? (
              <Box component="img" src={storeLogo} alt={companyName} sx={{ maxHeight: 60, mb: 2, maxWidth: 200, objectFit: 'contain' }} />
            ) : (
              <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>{companyName}</Typography>
            )}
            {storeAddress && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: '#555', mb: 0.5 }}>
                {storeAddress}
              </Typography>
            )}
            {contactEmail && <Typography variant="body2" sx={{ color: '#555' }}>Email: {contactEmail}</Typography>}
            {taxId && <Typography variant="body2" sx={{ color: '#555', mt: 0.5 }}>Tax/VAT: {taxId}</Typography>}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h3" fontWeight={300} sx={{ color: '#888', mb: 2 }}>INVOICE</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '8px 16px', textAlign: 'left' }}>
              <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>Invoice #:</Typography>
              <Typography variant="body2">{invoicePrefix}{order.id}</Typography>
              
              <Typography variant="body2" fontWeight={600}>Date:</Typography>
              <Typography variant="body2">{new Date(order.createdAt).toLocaleDateString()}</Typography>

              <Typography variant="body2" fontWeight={600}>Status:</Typography>
              <Typography variant="body2" sx={{ textTransform: 'uppercase' }}>{order.status}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Bill To & Ship To */}
        <Box sx={{ display: 'flex', gap: 4, mb: 6 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" sx={{ color: '#888', borderBottom: '1px solid #ddd', display: 'block', mb: 1 }}>
              Billed To
            </Typography>
            <Typography variant="body1" fontWeight={600}>{customerName}</Typography>
            {order.User?.email && <Typography variant="body2">{order.User.email}</Typography>}
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" sx={{ color: '#888', borderBottom: '1px solid #ddd', display: 'block', mb: 1 }}>
              Shipped To
            </Typography>
            {address ? (
              <Box>
                <Typography variant="body2" fontWeight={600}>{address.fullName}</Typography>
                <Typography variant="body2">{address.addressLine1}</Typography>
                {address.addressLine2 && <Typography variant="body2">{address.addressLine2}</Typography>}
                <Typography variant="body2">{address.city}, {address.state} {address.postalCode}</Typography>
                <Typography variant="body2">{address.country}</Typography>
                {address.phone && <Typography variant="body2">Phone: {address.phone}</Typography>}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No shipping details</Typography>
            )}
          </Box>
        </Box>

        {/* Items Table */}
        <Box sx={{ mb: 4 }}>
          {/* Table Header */}
          <Box sx={{ display: 'flex', backgroundColor: '#f5f5f5', p: 1.5, borderBottom: '2px solid #ddd', '@media print': { '-webkit-print-color-adjust': 'exact' } }}>
            <Typography variant="body2" fontWeight={700} sx={{ flex: 3 }}>Item</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ flex: 1, textAlign: 'center' }}>Qty</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ flex: 1, textAlign: 'right' }}>Unit Price</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ flex: 1, textAlign: 'right' }}>Amount</Typography>
          </Box>
          
          {/* Table Rows */}
          {orderItems.map((item) => (
            <Box key={item.id} sx={{ display: 'flex', p: 1.5, borderBottom: '1px solid #eee' }}>
              <Box sx={{ flex: 3, pr: 2 }}>
                <Typography variant="body2" fontWeight={600}>{item.snapshotName}</Typography>
                {(item.snapshotSku || item.variant?.sku) && (
                  <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>SKU: {item.snapshotSku || item.variant?.sku}</Typography>
                )}
                {item.variantInfo && (
                  <Typography variant="caption" sx={{ color: '#666' }}>
                    {Object.entries(item.variantInfo).map(([key, value]) => `${key}: ${value}`).join(', ')}
                  </Typography>
                )}
              </Box>
              <Typography variant="body2" sx={{ flex: 1, textAlign: 'center' }}>{item.quantity}</Typography>
              <Typography variant="body2" sx={{ flex: 1, textAlign: 'right' }}>{formatPrice(item.snapshotPrice || 0)}</Typography>
              <Typography variant="body2" sx={{ flex: 1, textAlign: 'right' }} fontWeight={600}>{formatPrice(item.total || 0)}</Typography>
            </Box>
          ))}
          {orderItems.length === 0 && (
             <Box sx={{ p: 2, textAlign: 'center' }}>
               <Typography variant="body2" color="text.secondary">No items found</Typography>
             </Box>
          )}
        </Box>

        {/* Totals Section */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 6 }}>
          <Box sx={{ width: '300px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">Subtotal</Typography>
              <Typography variant="body2">{formatPrice(order.subtotal || 0)}</Typography>
            </Box>
            
            {Number(order.discountAmount || 0) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: 'success.main', '@media print': { color: '#000' } }}>
                <Typography variant="body2">Discount</Typography>
                <Typography variant="body2">-{formatPrice(order.discountAmount || 0)}</Typography>
              </Box>
            )}
            
            {Number(order.shippingCost || 0) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Shipping</Typography>
                <Typography variant="body2">{formatPrice(order.shippingCost || 0)}</Typography>
              </Box>
            )}

            {Number(order.tax || 0) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Tax</Typography>
                <Typography variant="body2">{formatPrice(order.tax || 0)}</Typography>
              </Box>
            )}
            
            <Divider sx={{ my: 1.5 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6" fontWeight={700}>Total</Typography>
              <Typography variant="h6" fontWeight={700}>{formatPrice(order.total || 0)}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Footer / Notes */}
        {customNotes ? (
           <Box sx={{ pt: 2, borderTop: '1px solid #ddd' }}>
             <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>Notes / Terms</Typography>
             <Typography variant="body2" sx={{ color: '#555', whiteSpace: 'pre-line' }}>{customNotes}</Typography>
           </Box>
        ) : (
          <Box sx={{ pt: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#888' }}>Thank you for your business!</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default OrderInvoicePage;
