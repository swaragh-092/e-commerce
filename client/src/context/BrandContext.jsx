import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import brandService from '../services/brandService';
import { useFeature } from '../hooks/useSettings';

const BrandContext = createContext({ 
  brands: [], 
  loading: true, 
  error: null,
  refreshBrands: () => {} 
});

export const BrandProvider = ({ children }) => {
  const brandsEnabled = useFeature('brands');
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBrands = useCallback(async () => {
    if (!brandsEnabled) {
      setBrands([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      // Fetch active brands with published products for storefront display.
      const res = await brandService.getBrands({
        isActive: true,
        withPublishedProducts: true,
        limit: 30,
      });
      const data = res?.data?.data ?? res?.data ?? [];
      setBrands(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      if (err?.response?.status === 403) {
        // Feature was switched off between render and request; not an error.
        setBrands([]);
        setError(null);
      } else {
        setError('Failed to load brands.');
        console.error('Failed to load brands:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [brandsEnabled]);

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
