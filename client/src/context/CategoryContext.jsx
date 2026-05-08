import React, { createContext, useState, useEffect, useContext } from 'react';
import { getCategoryTree } from '../services/categoryService';

const CategoryContext = createContext({ categories: [], loading: true, error: null });

export const CategoryProvider = ({ children }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchCategories = async () => {
      try {
        const res = await getCategoryTree();
        if (mounted) {
          const data = res?.data?.categories ?? res?.data ?? [];
          setCategories(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to load category menu. Please refresh or try again later.');
          console.error('Failed to load categories:', err);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCategories();
    return () => { mounted = false; };
  }, []);

  return (
    <CategoryContext.Provider value={{ categories, loading, error }}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategories = () => useContext(CategoryContext);
