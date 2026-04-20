import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { wishlistService } from '../services/wishlistService';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useNotification } from './NotificationContext';

export const getWishlistKey = (productId, variantId = null) => `${productId}::${variantId || 'base'}`;

const WishlistContext = createContext({
  wishlistKeys: new Set(),
  wishlistCount: 0,
  isInWishlist: () => false,
  refreshWishlist: async () => ({ items: [], meta: {} }),
});

export const WishlistProvider = ({ children }) => {
  const [wishlistKeys, setWishlistKeys] = useState(new Set());
  const [wishlistCount, setWishlistCount] = useState(0);
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { notify } = useNotification();
  const wishlistEnabled = settings?.features?.wishlist !== false;

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated || !wishlistEnabled) {
      setWishlistKeys(new Set());
      setWishlistCount(0);
      return { items: [], meta: {} };
    }
    try {
      const response = await wishlistService.getWishlist();
      const items = Array.isArray(response.data) ? response.data : [];
      const meta = response?.meta || {};
      const validItems = items.filter((item) => {
        const productId = item?.productId ?? item?.Product?.id;
        return Boolean(productId);
      });
      const keys = new Set(
        validItems.map((item) => {
          const productId = item.productId ?? item.Product?.id;
          const variantId = item.variantId ?? item.variant?.id ?? null;
          return getWishlistKey(productId, variantId);
        })
      );
      setWishlistKeys(keys);
      setWishlistCount(validItems.length);
      if (meta.unavailableRemovedCount > 0) {
        notify(`${meta.unavailableRemovedCount} unavailable wishlist item${meta.unavailableRemovedCount > 1 ? 's were' : ' was'} removed automatically.`, 'info');
      }
      return { items: validItems, meta };
    } catch (_) {
      setWishlistKeys(new Set());
      setWishlistCount(0);
      return { items: [], meta: {} };
    }
  }, [isAuthenticated, wishlistEnabled, notify]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const isInWishlist = useCallback((productId, variantId = null) => wishlistKeys.has(getWishlistKey(productId, variantId)), [wishlistKeys]);

  return (
    <WishlistContext.Provider value={{ wishlistKeys, wishlistCount, isInWishlist, refreshWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);
