import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { wishlistService } from '../../services/wishlistService';
import { useAuth } from '../../hooks/useAuth';

const WishlistButton = ({ productId, initialInWishlist = false }) => {
    const [inWishlist, setInWishlist] = useState(initialInWishlist);
    const [loading, setLoading] = useState(false);
    const { isAuthenticated } = useAuth();

    const toggleWishlist = async () => {
        if (!isAuthenticated) {
            alert('Please login to use wishlist');
            return;
        }

        setLoading(true);
        try {
            if (inWishlist) {
                await wishlistService.removeItem(productId);
                setInWishlist(false);
            } else {
                await wishlistService.addItem(productId);
                setInWishlist(true);
            }
        } catch (error) {
            console.error('Wishlist toggle failed', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Tooltip title={inWishlist ? "Remove from Wishlist" : "Add to Wishlist"}>
            <IconButton onClick={toggleWishlist} disabled={loading} color="secondary">
                {inWishlist ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
        </Tooltip>
    );
};

export default WishlistButton;
