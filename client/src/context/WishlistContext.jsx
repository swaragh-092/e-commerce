import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { wishlistService } from '../services/wishlistService';
import { useAuth } from '../hooks/useAuth';

const WishlistContext = createContext({ wishlistIds: new Set(), refreshWishlist: () => {} });

export const WishlistProvider = ({ children }) => {
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const { isAuthenticated } = useAuth();

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlistIds(new Set());
      return;
    }
    try {
      const items = await wishlistService.getWishlist();
      // API returns array of wishlist item objects; product ID may be nested
      const ids = new Set(
        (items || []).map(i => i.productId ?? i.Product?.id ?? i.id)
      );
      setWishlistIds(ids);
    } catch (_) {
      // silently ignore — wishlist is non-critical
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  return (
    <WishlistContext.Provider value={{ wishlistIds, refreshWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);
