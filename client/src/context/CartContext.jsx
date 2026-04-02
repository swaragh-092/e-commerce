import React, { createContext, useState, useEffect, useCallback } from 'react';
import cartService from '../services/cartService';

export const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);

  const cartCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  const fetchCart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cartService.getCart();
      setCart(res.data.data);
    } catch (err) {
      console.error('Failed to fetch cart', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addItem = async (productId, quantity = 1, variantId = null) => {
    const res = await cartService.addItem(productId, quantity, variantId);
    setCart(res.data.data);
    return res.data.data;
  };

  const updateItem = async (cartItemId, quantity) => {
    const res = await cartService.updateItem(cartItemId, quantity);
    setCart(res.data.data);
    return res.data.data;
  };

  const removeItem = async (cartItemId) => {
    const res = await cartService.removeItem(cartItemId);
    setCart(res.data.data);
    return res.data.data;
  };

  const clearCart = async () => {
    await cartService.clearCart();
    setCart(null);
  };

  const value = {
    cart,
    cartCount,
    loading,
    fetchCart,
    addItem,
    updateItem,
    removeItem,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
