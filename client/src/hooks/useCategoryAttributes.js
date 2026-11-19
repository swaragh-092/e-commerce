import { useCallback, useEffect, useState } from 'react';
import attributeService from '../services/attributeService';
import { getApiErrorMessage } from '../utils/apiErrors';

export default function useCategoryAttributes(categoryIds, enabled = true) {
  const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
  const categoryKey = [...new Set(ids.filter(Boolean).map((id) => String(id).trim()).filter(Boolean))].sort().join(',');
  const requestKey = enabled ? categoryKey : '';
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ key: '', attributes: [], loading: false, error: null });
  const retry = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    if (!requestKey) return undefined;
    let active = true;
    setResult({ key: requestKey, attributes: [], loading: true, error: null });
    attributeService.getCategoryAttributes(requestKey.split(','), true)
      .then((response) => {
        const attributes = response?.data?.data;
        if (!Array.isArray(attributes)) throw new Error('Category attributes could not be loaded. Please try again.');
        if (active) setResult({ key: requestKey, attributes, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setResult({ key: requestKey, attributes: [], loading: false, error: getApiErrorMessage(error, 'Category attributes could not be loaded. Please try again.') });
      });
    return () => { active = false; };
  }, [requestKey, revision]);

  const current = requestKey && result.key === requestKey
    ? result
    : { attributes: [], loading: Boolean(requestKey), error: null };
  return { ...current, hasCategories: Boolean(categoryKey), retry };
}
