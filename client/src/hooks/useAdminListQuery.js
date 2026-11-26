import { useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

export default function useAdminListQuery(defaultPageSize, maxPageSize = 50) {
  const [params, setParams] = useSearchParams();
  const { pathname, search } = useLocation();
  const pageNumber = Number(params.get('page'));
  const size = Number(params.get('pageSize'));
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 ? pageNumber - 1 : 0;
  const pageSize = [10, 20, 50, 100].includes(size) && size <= maxPageSize ? size : defaultPageSize;
  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);

  const updateQuery = useCallback((changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [params, setParams]);

  const setPaginationModel = ({ page: nextPage, pageSize: nextSize }) => updateQuery({
    page: nextPage > 0 && nextSize === pageSize ? nextPage + 1 : null,
    pageSize: nextSize === defaultPageSize ? null : nextSize,
  });

  return { params, updateQuery, paginationModel, setPaginationModel, returnTo: pathname + search };
}
