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
  setWishlistItem: () => {},
  refreshWishlist: async () => ({ items: [], meta: {} }),
});

export const WishlistProvider = ({ children }) => {
  const [wishlistKeys, setWishlistKeys] = useState(new Set());
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { notify } = useNotification();
  const wishlistEnabled = settings?.features?.wishlist !== false;

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated || !wishlistEnabled) {
      setWishlistKeys(new Set());
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
      if (meta.unavailableRemovedCount > 0) {
        notify(`${meta.unavailableRemovedCount} unavailable wishlist item${meta.unavailableRemovedCount > 1 ? 's were' : ' was'} removed automatically.`, 'info');
      }
      return { items: validItems, meta };
    } catch (_) {
      setWishlistKeys(new Set());
      return { items: [], meta: {} };
    }
  }, [isAuthenticated, wishlistEnabled, notify]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const isInWishlist = useCallback((productId, variantId = null) => wishlistKeys.has(getWishlistKey(productId, variantId)), [wishlistKeys]);

  const setWishlistItem = useCallback((productId, variantId = null, shouldExist) => {
    const key = getWishlistKey(productId, variantId);
    setWishlistKeys((currentKeys) => {
      const alreadyExists = currentKeys.has(key);
      if (alreadyExists === shouldExist) return currentKeys;

      const nextKeys = new Set(currentKeys);
      if (shouldExist) {
        nextKeys.add(key);
      } else {
        nextKeys.delete(key);
      }
      return nextKeys;
    });
  }, []);

  const wishlistCount = wishlistKeys.size;

  return (
    <WishlistContext.Provider value={{ wishlistKeys, wishlistCount, isInWishlist, setWishlistItem, refreshWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);
