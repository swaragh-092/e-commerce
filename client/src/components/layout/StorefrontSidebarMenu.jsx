import React from 'react';
import { Box, Divider, Link as MuiLink, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import MenuService from '../../services/menuService';

const isExternalUrl = (url = '') => /^https?:\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('tel:');
const isNavigableItem = (item) => item?.targetType !== 'none' && item?.url && item.url !== '#';

const flattenVisibleItems = (items = [], depth = 0, rows = []) => {
  items.forEach((item) => {
    rows.push({ ...item, depth });
    flattenVisibleItems(item.children || [], depth + 1, rows);
  });
  return rows;
};

const getLinkProps = (item) => {
  if (!isNavigableItem(item)) return {};
  if (isExternalUrl(item.url)) {
    return {
      component: 'a',
      href: item.url,
      target: item.openInNewTab ? '_blank' : undefined,
      rel: item.openInNewTab ? 'noopener noreferrer' : undefined,
    };
  }
  return { component: RouterLink, to: item.url };
};

const StorefrontSidebarMenu = ({ title = 'Quick Links', onNavigate }) => {
  const [menu, setMenu] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    MenuService.getPublicMenu('sidebar')
      .then((response) => {
        if (mounted) setMenu(response.data || null);
      })
      .catch((error) => {
        console.error('Error fetching sidebar menu:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const items = flattenVisibleItems(menu?.items || []).filter(isNavigableItem);
  if (!items.length) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        {menu?.name || title}
      </Typography>
      <Divider sx={{ mb: 1 }} />
      <List dense disablePadding>
        {items.map((item) => (
          <ListItemButton
            key={item.id}
            {...getLinkProps(item)}
            onClick={onNavigate}
            sx={{ borderRadius: 1, pl: 1 + item.depth * 2 }}
          >
            <ListItemText
              primary={(
                <MuiLink component="span" underline="none" color="inherit">
                  {item.label}
                </MuiLink>
              )}
              primaryTypographyProps={{ variant: item.depth === 0 ? 'body2' : 'caption', fontWeight: item.depth === 0 ? 600 : 400 }}
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
};

export default StorefrontSidebarMenu;
