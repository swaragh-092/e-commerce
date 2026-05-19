import { useEffect, useState } from 'react';

export const useScrollState = (ref, dependencies = [], { threshold = 5, delay = 0 } = {}) => {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const updateScrollState = () => {
      setCanScrollLeft(element.scrollLeft > threshold);
      setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - threshold);
    };

    updateScrollState();
    element.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);
    const timer = delay > 0 ? setTimeout(updateScrollState, delay) : null;

    return () => {
      element.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, threshold, delay]);

  return { canScrollLeft, canScrollRight };
};
