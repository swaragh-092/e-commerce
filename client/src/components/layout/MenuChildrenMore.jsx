import { useRef, useState } from 'react';
import { Button, MenuItem } from '@mui/material';
import MenuService from '../../services/menuService';

const MenuChildrenMore = ({ item, onLoaded, menuItem = false, sx }) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const pagination = item.childrenPagination;
  if (!pagination?.hasMore) return null;
  const load = async (event) => {
    event.stopPropagation();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const response = await MenuService.getPublicMenuChildren(item.menuId, item.id, {
        offset: pagination.nextOffset, limit: pagination.limit,
      });
      onLoaded(item.menuId, item.id, response.data);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const Component = menuItem ? MenuItem : Button;
  return (
    <Component onClick={load} disabled={busy} aria-label={`Show more ${item.label}`} aria-busy={busy} sx={sx}>
      <span aria-live="polite">{busy ? 'Loading…' : failed ? 'Could not load. Try again' : 'Show more'}</span>
    </Component>
  );
};
export default MenuChildrenMore;
