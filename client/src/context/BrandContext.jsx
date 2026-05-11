import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import brandService from '../services/brandService';

const BrandContext = createContext({ 
  brands: [], 
  loading: true, 
  error: null,
  refreshBrands: () => {} 
});

export const BrandProvider = ({ children }) => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBrands = useCallback(async () => {
    try {
      // Fetch active brands for storefront use
      const res = await brandService.getBrands({ isActive: true, limit: 100 });
      const data = res?.data?.data ?? res?.data ?? [];
      setBrands(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError('Failed to load brands.');
      console.error('Failed to load brands:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  return (
    <BrandContext.Provider value={{ brands, loading, error, refreshBrands: fetchBrands }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrands = () => useContext(BrandContext);
