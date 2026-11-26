import { useCallback, useEffect, useRef, useState } from 'react';

export default function useAdminListSearch(search, updateQuery, delay) {
  const lastUrlSearch = useRef(search);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    if (lastUrlSearch.current === search) return;
    lastUrlSearch.current = search;
    setSearchInput(search);
  }, [search]);

  const applySearch = useCallback((value, changes = {}) => {
    const query = value.trim();
    lastUrlSearch.current = query;
    setSearchInput(value);
    updateQuery({ ...changes, search: query, page: null });
  }, [updateQuery]);

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = setTimeout(() => applySearch(searchInput), delay);
    return () => clearTimeout(timer);
  }, [searchInput, search, applySearch, delay]);

  return { searchInput, setSearchInput, applySearch };
}
