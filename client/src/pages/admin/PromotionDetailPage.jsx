import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Paper,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { Delete as DeleteIcon, Add as AddIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import * as promotionService from '../../services/promotionService';
import productService from '../../services/productService';
import { getMediaUrl } from '../../utils/media';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function PromotionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  
  const canManage = hasPermission(PERMISSIONS.PROMOTIONS_MANAGE);

  const [promotion, setPromotion] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add Product Dialog state
  const [openAdd, setOpenAdd] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const loadPromotion = useCallback(async () => {
    try {
      setLoading(true);
      const res = await promotionService.getPromotion(id);
      setPromotion(res.data);
    } catch (err) {
      notify('Failed to load promotion details', 'error');
      navigate('/admin/promotions');
    } finally {
      setLoading(false);
    }
  }, [id, notify, navigate]);

  useEffect(() => {
    loadPromotion();
  }, [loadPromotion]);

  const handleRemoveProduct = async (productId) => {
    try {
      await promotionService.removeProducts(id, [productId]);
      notify('Product removed from promotion', 'success');
      loadPromotion();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to remove product'), 'error');
    }
  };

  const handleSearchProducts = async () => {
    if (!searchProduct.trim()) return;
    setSearching(true);
    try {
      const res = await productService.getProducts({ search: searchProduct, limit: 10 });
      // filter out ones already assigned
      const assignedIds = new Set(promotion.products?.map(p => p.id));
      const filtered = res.data?.data?.filter(p => !assignedIds.has(p.id)) || [];
      setSearchResults(filtered);
    } catch (err) {
      notify('Failed to search products', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleAssignProduct = async (productId) => {
    try {
      await promotionService.assignProducts(id, [productId]);
      notify('Product assigned to promotion', 'success');
      loadPromotion();
      setOpenAdd(false);
      setSearchProduct('');
      setSearchResults([]);
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to assign product'), 'error');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!promotion) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => navigate('/admin/promotions')}>
          <ArrowBackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            {promotion.name} <Typography component="span" variant="subtitle1" color="text.secondary">({promotion.label})</Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage products assigned to this campaign
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenAdd(true)}>
            Add Products
          </Button>
        )}
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Assigned Products ({promotion.products?.length || 0})</Typography>
        {promotion.products && promotion.products.length > 0 ? (
          <List>
            {promotion.products.map(product => (
              <ListItem
                key={product.id}
                divider
                secondaryAction={
                  canManage && (
                    <IconButton edge="end" color="error" onClick={() => handleRemoveProduct(product.id)}>
                      <DeleteIcon />
                    </IconButton>
                  )
                }
              >
                <ListItemAvatar>
                  <Avatar src={getMediaUrl(product.images?.[0]?.url)} variant="rounded" />
                </ListItemAvatar>
                <ListItemText
                  primary={product.name}
                  secondary={`Regular: $${product.price} | Sale: $${product.salePrice || 'N/A'}`}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary" py={4} textAlign="center">
            No products assigned to this campaign yet.
          </Typography>
        )}
      </Paper>

      {/* Add Products Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Products to Campaign</DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={1} mb={2}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search products by name or SKU..."
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchProducts()}
            />
            <Button variant="contained" onClick={handleSearchProducts} disabled={searching}>
              Search
            </Button>
          </Stack>
          
          <List>
            {searchResults.map(product => (
              <ListItem
                key={product.id}
                divider
                secondaryAction={
                  <Button size="small" variant="outlined" onClick={() => handleAssignProduct(product.id)}>
                    Assign
                  </Button>
                }
              >
                <ListItemAvatar>
                  <Avatar src={getMediaUrl(product.images?.[0]?.url)} variant="rounded" />
                </ListItemAvatar>
                <ListItemText
                  primary={product.name}
                  secondary={`Price: $${product.price}`}
                />
              </ListItem>
            ))}
          </List>
          {searchProduct && searchResults.length === 0 && !searching && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              No eligible products found.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
