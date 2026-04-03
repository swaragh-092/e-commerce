import React, { createContext, useState, useEffect, useContext } from 'react';
import { getCategoryTree } from '../services/categoryService';

const CategoryContext = createContext({ categories: [], loading: true });

export const CategoryProvider = ({ children }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchCategories = async () => {
      try {
        const res = await getCategoryTree();
        if (mounted) {
          // Handles both { categories: [...] } and direct array responses
          const data = res?.data?.categories ?? res?.data ?? [];
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCategories();
    return () => { mounted = false; };
  }, []);

  return (
    <CategoryContext.Provider value={{ categories, loading }}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategories = () => useContext(CategoryContext);
