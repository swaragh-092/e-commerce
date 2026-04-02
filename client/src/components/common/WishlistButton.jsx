import React, { useState } from 'react';
import { IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useNavigate, useLocation } from 'react-router-dom';
import { wishlistService } from '../../services/wishlistService';
import { useAuth } from '../../hooks/useAuth';

const WishlistButton = ({ productId, initialInWishlist = false }) => {
  const [inWishlist, setInWishlist] = useState(initialInWishlist);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleWishlist = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    setLoading(true);
    try {
      if (inWishlist) {
        await wishlistService.removeItem(productId);
        setInWishlist(false);
        setSnackbar({ severity: 'info', message: 'Removed from wishlist' });
      } else {
        await wishlistService.addItem(productId);
        setInWishlist(true);
        setSnackbar({ severity: 'success', message: 'Added to wishlist' });
      }
    } catch (error) {
      setSnackbar({ severity: 'error', message: error?.response?.data?.message || 'Wishlist update failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title={inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}>
        <IconButton onClick={toggleWishlist} disabled={loading} color="secondary">
          {inWishlist ? <FavoriteIcon /> : <FavoriteBorderIcon />}
        </IconButton>
      </Tooltip>
      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar(null)} severity={snackbar?.severity} variant="filled">
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default WishlistButton;
