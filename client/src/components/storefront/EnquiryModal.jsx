import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import api from '../../services/api';

const EnquiryModal = ({ open, onClose, product, cartItems }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    quantity: 1,
  });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: name === 'quantity' ? parseInt(value, 10) || 0 : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      ...formData,
      productId: product?.id || null,
      variantId: product?.selectedVariant?.id || null,
      cartItems: cartItems || null,
    };

    try {
      await api.post('/enquiries', payload);
      setSuccessMsg('Your enquiry has been submitted successfully! We will contact you soon.');
      
      timerRef.current = setTimeout(() => {
        onClose();
        setSuccessMsg('');
        setFormData({ name: '', email: '', phone: '', message: '', quantity: 1 });
      }, 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit enquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {cartItems ? 'Enquire About Cart' : product ? `Enquire About ${product.name}` : 'General Enquiry'}
      </DialogTitle>
      <DialogContent dividers>
        {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
        {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
        
        <Box component="form" id="enquiry-form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {product && (
            <TextField
              label="Quantity Required"
              name="quantity"
              type="number"
              value={formData.quantity}
              onChange={handleChange}
              fullWidth
              required
              inputProps={{ min: 1 }}
              disabled={loading || !!successMsg}
            />
          )}
          <TextField
            label="Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            fullWidth
            required
            disabled={loading || !!successMsg}
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            fullWidth
            required
            disabled={loading || !!successMsg}
          />
          <TextField
            label="Phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            fullWidth
            disabled={loading || !!successMsg}
          />
          <TextField
            label="Message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            multiline
            rows={4}
            fullWidth
            required
            disabled={loading || !!successMsg}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading} color="inherit">
          Cancel
        </Button>
        <Button type="submit" form="enquiry-form" variant="contained" disabled={loading || !!successMsg}>
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnquiryModal;
