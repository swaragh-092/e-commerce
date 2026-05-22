import React from 'react';
import { Box, Typography, Avatar, Paper, Chip, Divider } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';

const AdminProfilePage = () => {
  const { user, roles, permissions } = useAuth();

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>My Profile</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'secondary.main', fontSize: 22 }}>
            {user?.firstName?.[0]?.toUpperCase() || 'A'}
          </Avatar>
          <Box>
            <Typography variant="h6">{user?.firstName} {user?.lastName}</Typography>
            <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
          </Box>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <Typography>{user?.status || 'active'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Email Verified</Typography>
            <Typography>{user?.emailVerified ? 'Yes' : 'No'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Two-Factor Auth</Typography>
            <Typography>{user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Last Login</Typography>
            <Typography>{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}</Typography>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Roles</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {roles?.length > 0 ? roles.map((role) => (
            <Chip key={role} label={role} color="primary" variant="outlined" />
          )) : <Typography variant="body2" color="text.secondary">No roles assigned</Typography>}
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Permissions</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {permissions?.length > 0 ? permissions.map((perm) => (
            <Chip key={perm} label={perm} size="small" variant="outlined" />
          )) : <Typography variant="body2" color="text.secondary">No permissions</Typography>}
        </Box>
      </Paper>
    </Box>
  );
};

export default AdminProfilePage;
