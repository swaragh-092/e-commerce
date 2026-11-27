import { useEffect, useState } from 'react';
import { Badge, IconButton, Menu, MenuItem } from '@mui/material';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import { Link } from 'react-router-dom';
import { adminAlerts as api } from '../../services/adminAlerts';

const inboxPath = '/admin/notifications';
const preferencesPath = inboxPath + '/preferences';

export default function AdminAlertBell() {
  const [inbox, setInbox] = useState(null);
  const [anchor, setAnchor] = useState(null);
  useEffect(() => {
    let controller;
    const load = () => {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      api.inbox(false, 5, 0, controller.signal).then(setInbox).catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    window.addEventListener('admin-alerts-changed', load);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', load);
      window.removeEventListener('admin-alerts-changed', load);
    };
  }, []);
  if (!inbox?.enabled) return null;
  return <>
    <IconButton color="inherit" aria-label={`Notifications, ${inbox.unread} unread`} aria-haspopup="menu" aria-expanded={Boolean(anchor)}
      onClick={event => setAnchor(event.currentTarget)}>
      <Badge color="error" badgeContent={inbox.unread}><NotificationsOutlined /></Badge>
    </IconButton>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
      {inbox.items.map(item => <MenuItem key={item.id} component={Link} to={inboxPath} onClick={() => setAnchor(null)} sx={{ fontWeight: item.read_at ? 'normal' : 'bold' }}>{item.message.title}</MenuItem>)}
      {!inbox.items.length && <MenuItem disabled>No notifications yet</MenuItem>}
      <MenuItem component={Link} to={inboxPath} onClick={() => setAnchor(null)}>Open inbox</MenuItem>
      <MenuItem component={Link} to={preferencesPath} onClick={() => setAnchor(null)}>My notifications</MenuItem>
    </Menu>
  </>;
}
