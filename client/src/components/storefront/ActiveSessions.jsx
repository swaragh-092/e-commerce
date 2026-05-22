import { useState, useEffect } from 'react';
import { Box, Typography, Button, Alert, Paper, List, ListItem, ListItemText, ListItemSecondaryAction, Chip, IconButton, Divider } from '@mui/material';
import { Devices, Delete } from '@mui/icons-material';
import { userService } from '../../services/userService';
import { getApiErrorMessage } from '../../utils/apiErrors';

const ActiveSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSessions = async () => {
    try {
      const data = await userService.getSessions();
      setSessions(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load sessions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleRevoke = async (id) => {
    try {
      await userService.revokeSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      setSuccess('Session revoked');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to revoke session'));
    }
  };

  const handleRevokeAll = async () => {
    try {
      const result = await userService.revokeAllOtherSessions();
      setSuccess(`${result.data?.revoked || 0} other session(s) revoked`);
      fetchSessions();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to revoke sessions'));
    }
  };

  const formatTime = (date) => {
    if (!date) return 'Unknown';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return d.toLocaleDateString();
  };

  if (loading) return <Typography color="text.secondary">Loading sessions...</Typography>;

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Active Sessions</Typography>
        {sessions.length > 1 && (
          <Button size="small" color="error" variant="outlined" onClick={handleRevokeAll}>
            Sign out all others
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <List disablePadding>
        {sessions.map((session, idx) => (
          <Box key={session.id}>
            {idx > 0 && <Divider />}
            <ListItem sx={{ px: 0 }}>
              <Devices sx={{ mr: 2, color: 'text.secondary' }} />
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{session.deviceName}</Typography>
                    {session.isCurrent && <Chip label="Current" size="small" color="primary" variant="outlined" />}
                  </Box>
                }
                secondary={`IP: ${session.ipAddress || 'Unknown'} · Last active: ${formatTime(session.lastActiveAt)}`}
              />
              {!session.isCurrent && (
                <ListItemSecondaryAction>
                  <IconButton edge="end" color="error" onClick={() => handleRevoke(session.id)} title="Revoke session">
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          </Box>
        ))}
        {sessions.length === 0 && (
          <Typography color="text.secondary" variant="body2">No active sessions found.</Typography>
        )}
      </List>
    </Paper>
  );
};

export default ActiveSessions;
