import { useState, useEffect, useRef } from 'react';

/**
 * Returns a debounced version of the value.
 * The debounced value only updates after `delay` ms of no changes.
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Returns a debounced callback.
 * Useful when you need to debounce an event handler directly.
 */
export const useDebouncedCallback = (callback, delay = 300) => {
  const timerRef = useRef(null);

  const debounced = (...args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callback(...args), delay);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return debounced;
};
