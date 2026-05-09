import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  FormControlLabel,
  Button,
  Chip,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DataGrid } from '@mui/x-data-grid';
import {
  createAccessRole,
  createAccessUser,
  getAccessPermissions,
  getAccessRoles,
  getAccessUsers,
  updateAccessRole,
  updateAccessUserRole,
} from '../../services/adminService';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/apiErrors';

const roleColors = {
  customer: 'default',
  admin: 'primary',
  super_admin: 'secondary',
};

const roleTypeChipProps = {
  system: { label: 'System Role', color: 'warning' },
  custom: { label: 'Custom Role', color: 'success' },
};

const emptyRoleForm = {
  id: null,
  name: '',
  description: '',
  baseRole: 'admin',
  permissionIds: [],
  isSystem: false,
};

const emptyUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  roleId: '',
};

const AccessControlPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCustomers, setShowCustomers] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);

  const canManageCustomRoles = hasPermission(PERMISSIONS.ROLES_MANAGE);
  const canManageSystemRoles = hasPermission(PERMISSIONS.SYSTEM_ROLES_MANAGE);
  const canAssignRoles = hasPermission(PERMISSIONS.USERS_ASSIGN_ROLES);

  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState(emptyUserForm);
  const [showPassword, setShowPassword] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  const roleOptions = useMemo(() => roles.map((role) => ({ id: role.id, name: role.name })), [roles]);

  const groupedPermissions = useMemo(() => {
    return permissions.reduce((acc, permission) => {
      const group = permission.group || 'general';
      if (!acc[group]) acc[group] = [];
      acc[group].push(permission);
      return acc;
    }, {});
  }, [permissions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const fetchAccessControl = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [getAccessRoles(), getAccessPermissions()];

      if (canAssignRoles) {
        requests.push(
          getAccessUsers({
            page: paginationModel.page + 1,
            limit: paginationModel.pageSize,
            search: debouncedSearch,
            roleId: roleFilter,
            includeCustomers: showCustomers || Boolean(debouncedSearch),
          })
        );
      }

      const [rolesResponse, permissionsResponse, usersResponse] = await Promise.all(requests);

      setRoles(rolesResponse.data.data || []);
      setPermissions(permissionsResponse.data.data || []);
      setRows(usersResponse?.data?.data || []);
      setTotal(usersResponse?.data?.meta?.total || 0);
    } catch (error) {
      notify('Failed to load access control data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [canAssignRoles, debouncedSearch, notify, paginationModel.page, paginationModel.pageSize, roleFilter, showCustomers]);

  useEffect(() => {
    fetchAccessControl();
  }, [fetchAccessControl]);

  const openCreateDialog = () => {
    setRoleForm(emptyRoleForm);
    setRoleDialogOpen(true);
  };

  const openEditDialog = (role) => {
    setRoleForm({
      id: role.id,
      name: role.name,
      description: role.description || '',
      baseRole: role.baseRole,
      permissionIds: role.permissions.map((permission) => permission.id),
      isSystem: role.isSystem,
    });
    setRoleDialogOpen(true);
  };

  const closeRoleDialog = () => {
    setRoleDialogOpen(false);
    setRoleForm(emptyRoleForm);
  };

  const handleRolePermissionToggle = (permissionId) => {
    setRoleForm((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(permissionId)
        ? current.permissionIds.filter((id) => id !== permissionId)
        : [...current.permissionIds, permissionId],
    }));
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      notify('Role name is required.', 'error');
      return;
    }

    if (roleForm.permissionIds.length === 0) {
      notify('Select at least one permission.', 'error');
      return;
    }

    setSavingRole(true);
    try {
      const payload = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        baseRole: roleForm.baseRole,
        permissionIds: roleForm.permissionIds,
      };

      if (roleForm.id) {
        await updateAccessRole(roleForm.id, payload);
        notify('Role updated successfully.', 'success');
      } else {
        await createAccessRole(payload);
        notify('Role created successfully.', 'success');
      }

      closeRoleDialog();
      fetchAccessControl();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to save role.'), 'error');
    } finally {
      setSavingRole(false);
    }
  };

  const handleRoleAssignment = async (userId, nextRoleId) => {
    setUpdatingUserId(userId);
    try {
      await updateAccessUserRole(userId, nextRoleId);
      notify('User access role updated successfully.', 'success');
      fetchAccessControl();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to update user role.'), 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const openCreateUserDialog = () => {
    setCreateUserForm(emptyUserForm);
    setShowPassword(false);
    setCreateUserDialogOpen(true);
  };

  const closeCreateUserDialog = () => {
    setCreateUserDialogOpen(false);
    setCreateUserForm(emptyUserForm);
    setShowPassword(false);
  };

  const handleCreateUser = async () => {
    const { firstName, lastName, email, password, roleId } = createUserForm;
    if (!firstName.trim() || !lastName.trim()) {
      notify('First and last name are required.', 'error');
      return;
    }
    if (!email.trim()) {
      notify('Email is required.', 'error');
      return;
    }
    if (password.length < 8) {
      notify('Password must be at least 8 characters.', 'error');
      return;
    }
    if (!roleId) {
      notify('Please select a role.', 'error');
      return;
    }

    setSavingUser(true);
    try {
      await createAccessUser({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, roleId });
      notify('Staff user created successfully.', 'success');
      closeCreateUserDialog();
      fetchAccessControl();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to create user.'), 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const setUserField = (field) => (event) =>
    setCreateUserForm((current) => ({ ...current, [field]: event.target.value }));

  const columns = [
    {
      field: 'name',
      headerName: 'User',
      flex: 1.1,
      minWidth: 200,
      valueGetter: (_, row) => `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Unnamed User',
    },
    { field: 'email', headerName: 'Email', flex: 1.2, minWidth: 220 },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: ({ value }) => <Chip label={value} size="small" color={value === 'active' ? 'success' : 'default'} />,
    },
    {
      field: 'assignedRole',
      headerName: 'Assigned Role',
      width: 240,
      sortable: false,
      renderCell: ({ row }) => {
        const currentRole = roleOptions.find((r) => String(r.id) === String(row.roleId));
        return (
          <FormControl size="small" fullWidth>
            <Select
              value={row.roleId || ''}
              disabled={updatingUserId === row.id}
              onChange={(event) => handleRoleAssignment(row.id, event.target.value)}
              displayEmpty
              sx={{
                '& .MuiSelect-select': {
                  color: currentRole ? 'text.primary' : 'text.disabled',
                },
              }}
              IconComponent={(props) => (
                updatingUserId === row.id ? (
                  <CircularProgress size={18} sx={{ mr: 1 }} />
                ) : (
                  <ExpandMoreIcon {...props} />
                )
              )}
            >
              <MenuItem disabled value="">
                <em>Select role…</em>
              </MenuItem>
              {roleOptions.map((role) => (
                <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      },
    },
  ];

  const getRoleIcon = (role) => {
    if (role.baseRole === 'super_admin') {
      return <AdminPanelSettingsIcon color="primary" sx={{ fontSize: 28 }} />;
    }
    if (role.baseRole === 'admin') {
      return <SecurityIcon color="primary" sx={{ fontSize: 28 }} />;
    }
    return <VpnKeyIcon color="primary" sx={{ fontSize: 28 }} />;
  };

  const getRoleStatusChip = (role) => {
    if (role.isSystem) {
      return (
        <Chip
          label="Editable by super admin"
          size="small"
          color="secondary"
          variant="outlined"
          sx={{ height: 22, fontSize: '0.7rem', borderRadius: 1 }}
        />
      );
    }
    return (
      <Chip
        label="Delegatable"
        size="small"
        color="info"
        variant="outlined"
        sx={{ height: 22, fontSize: '0.7rem', borderRadius: 1 }}
      />
    );
  };

  const canEditRole = (role) =>
    (role.isSystem && canManageSystemRoles) || (!role.isSystem && canManageCustomRoles);

  return (
    <Box>
      {/* Header Section */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Access Control
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            Super admins can edit system roles and assign roles to users. Delegated managers can
            create and edit custom roles when granted that permission.
          </Typography>
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
        >
          {canAssignRoles && (
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={openCreateUserDialog}
              sx={{ whiteSpace: 'nowrap' }}
              fullWidth={isMobile}
            >
              Create User
            </Button>
          )}
          {canManageCustomRoles && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
              sx={{ whiteSpace: 'nowrap' }}
              fullWidth={isMobile}
            >
              Create Role
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        Only super admins can edit system roles. Custom-role management can be delegated, while user
        role assignment stays super-admin-only.
      </Alert>

      {/* Legend Section */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 3,
          mb: 3,
        }}
      >
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Access Legend
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label="System Role = protected default role"
            color="warning"
            variant="outlined"
            size="small"
            sx={{ borderRadius: 1.5 }}
          />
          <Chip
            label="Custom Role = merchant-defined role"
            color="success"
            variant="outlined"
            size="small"
            sx={{ borderRadius: 1.5 }}
          />
          <Chip
            label="Custom role edit can be delegated"
            color="info"
            variant="outlined"
            size="small"
            sx={{ borderRadius: 1.5 }}
          />
          <Chip
            label="System role edit is super-admin-only"
            color="secondary"
            variant="outlined"
            size="small"
            sx={{ borderRadius: 1.5 }}
          />
          <Chip
            label="User assignment is super-admin-only"
            color="secondary"
            variant="outlined"
            size="small"
            sx={{ borderRadius: 1.5 }}
          />
        </Box>
      </Paper>

      {/* Role Cards Grid */}
      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: 3 }}>
        {roles.map((role) => (
          <Grid item xs={12} sm={6} lg={4} key={role.id}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 2.5, md: 3 },
                borderRadius: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow:
                    theme.palette.mode === 'dark'
                      ? '0 4px 12px rgba(0,0,0,0.3)'
                      : '0 4px 12px rgba(0,0,0,0.08)',
                  borderColor: 'primary.main',
                },
              }}
            >
              {/* Card Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, minWidth: 0 }}>
                  <Box sx={{ mt: 0.25, flexShrink: 0 }}>{getRoleIcon(role)}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      noWrap
                      sx={{ fontSize: { xs: '1.15rem', sm: '1.25rem' }, lineHeight: 1.3 }}
                    >
                      {role.name}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                      <Chip
                        label={
                          role.isSystem
                            ? roleTypeChipProps.system.label
                            : roleTypeChipProps.custom.label
                        }
                        size="small"
                        color={
                          role.isSystem
                            ? roleTypeChipProps.system.color
                            : roleTypeChipProps.custom.color
                        }
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.7rem', borderRadius: 1 }}
                      />
                      <Chip
                        label={role.baseRole}
                        size="small"
                        color={roleColors[role.baseRole] || 'default'}
                        sx={{ height: 22, fontSize: '0.7rem', borderRadius: 1 }}
                      />
                      {getRoleStatusChip(role)}
                    </Box>
                  </Box>
                </Box>
                {canEditRole(role) && (
                  <Tooltip title="Edit Role">
                    <IconButton
                      size="small"
                      onClick={() => openEditDialog(role)}
                      sx={{ mt: -0.5, mr: -0.5, flexShrink: 0 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              {/* Description */}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 2,
                  flex: 1,
                  lineHeight: 1.6,
                  minHeight: 20,
                }}
              >
                {role.description || 'No description provided.'}
              </Typography>

              {/* Permissions Section */}
              <Box
                sx={{
                  mb: 1.5,
                  pt: 1.5,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                  sx={{
                    display: 'block',
                    mb: 0.75,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontSize: '0.7rem',
                  }}
                >
                  {role.permissions.length} permissions
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {role.permissions.slice(0, 8).map((permission) => (
                    <Chip
                      key={permission.id}
                      label={permission.key}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 24,
                        fontSize: '0.75rem',
                        borderRadius: 1,
                        '& .MuiChip-label': {
                          px: 1,
                        },
                        bgcolor:
                          theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.02)',
                      }}
                    />
                  ))}
                  {role.permissions.length > 8 && (
                    <Chip
                      label={`+${role.permissions.length - 8} more`}
                      size="small"
                      sx={{
                        height: 24,
                        fontSize: '0.75rem',
                        borderRadius: 1,
                        fontWeight: 500,
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* User Assignment Table */}
      {canAssignRoles && (
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Assign Roles to Users
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
            By default this table shows only elevated-access users. Use search or enable customers
            when you want to promote a shopper into a managed role.
          </Typography>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <TextField
              size="small"
              label="Search users by name or email"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPaginationModel((current) => ({ ...current, page: 0 }));
              }}
              sx={{
                minWidth: { xs: 0, sm: 240 },
                flex: { xs: 1, sm: '0 0 auto' },
              }}
              fullWidth={isMobile}
            />
            <FormControl
              size="small"
              sx={{
                minWidth: { xs: 0, sm: 220 },
                flex: { xs: 1, sm: '0 0 auto' },
              }}
              fullWidth={isMobile}
            >
              <InputLabel>Filter by role</InputLabel>
              <Select
                label="Filter by role"
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value);
                  setPaginationModel((current) => ({ ...current, page: 0 }));
                }}
              >
                <MenuItem value="">All roles</MenuItem>
                {roleOptions.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showCustomers}
                  onChange={(event) => {
                    setShowCustomers(event.target.checked);
                    setPaginationModel((current) => ({ ...current, page: 0 }));
                  }}
                />
              }
              label="Show customers"
              sx={{ whiteSpace: 'nowrap' }}
            />
          </Stack>

          <Box
            sx={{
              height: { xs: 400, sm: 520 },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <DataGrid
              rows={rows}
              columns={columns}
              rowCount={total}
              loading={loading}
              paginationMode="server"
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={[10, 25, 50]}
              disableRowSelectionOnClick
              sx={{
                '& .MuiDataGrid-cell': {
                  px: { xs: 1, sm: 2 },
                },
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor: 'background.default',
                },
              }}
            />
          </Box>
        </Paper>
      )}

      {/* Create User Dialog */}
      <Dialog
        open={createUserDialogOpen}
        onClose={closeCreateUserDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create Staff Account</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="First Name"
                value={createUserForm.firstName}
                onChange={setUserField('firstName')}
                fullWidth
                size="small"
                autoFocus
              />
              <TextField
                label="Last Name"
                value={createUserForm.lastName}
                onChange={setUserField('lastName')}
                fullWidth
                size="small"
              />
            </Stack>
            <TextField
              label="Email Address"
              type="email"
              value={createUserForm.email}
              onChange={setUserField('email')}
              fullWidth
              size="small"
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={createUserForm.password}
              onChange={setUserField('password')}
              fullWidth
              size="small"
              helperText="Minimum 8 characters"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword((current) => !current)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Assign Role</InputLabel>
              <Select
                label="Assign Role"
                value={createUserForm.roleId}
                onChange={setUserField('roleId')}
              >
                {roleOptions.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ mt: 0.5 }}>
              The account will be created as <strong>active</strong> with email pre-verified. Share
              the credentials with the staff member directly.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateUserDialog} disabled={savingUser}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            startIcon={<PersonAddIcon />}
            disabled={savingUser}
          >
            {savingUser ? 'Creating…' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create / Edit Role Dialog */}
      <Dialog open={roleDialogOpen} onClose={closeRoleDialog} fullWidth maxWidth="md">
        <DialogTitle>
          {roleForm.id
            ? roleForm.isSystem
              ? 'Edit System Role'
              : 'Edit Custom Role'
            : 'Create Custom Role'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Role Name"
              value={roleForm.name}
              onChange={(event) =>
                setRoleForm((current) => ({ ...current, name: event.target.value }))
              }
              fullWidth
              size="small"
              disabled={roleForm.isSystem}
            />
            <TextField
              label="Description"
              value={roleForm.description}
              onChange={(event) =>
                setRoleForm((current) => ({ ...current, description: event.target.value }))
              }
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Base Role</InputLabel>
              <Select
                label="Base Role"
                value={roleForm.baseRole}
                onChange={(event) =>
                  setRoleForm((current) => ({ ...current, baseRole: event.target.value }))
                }
                disabled={roleForm.isSystem}
              >
                <MenuItem value="customer">Customer</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>

            <Alert severity="warning">
              {roleForm.isSystem
                ? 'You are editing a protected system role. Reserved access-control permissions are available only to super admins.'
                : 'Reserved access-control permissions stay unavailable for custom roles.'}
            </Alert>

            <Box>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Permissions
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(groupedPermissions).map(([group, groupPermissions]) => (
                  <Grid item xs={12} sm={6} key={group}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 2, height: '100%' }}
                    >
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{ mb: 1.5, textTransform: 'capitalize' }}
                      >
                        {group}
                      </Typography>
                      <Stack spacing={1}>
                        {groupPermissions.map((permission) => {
                          const selected = roleForm.permissionIds.includes(permission.id);
                          return (
                            <Button
                              key={permission.id}
                              variant={selected ? 'contained' : 'outlined'}
                              color={selected ? 'primary' : 'inherit'}
                              disabled={!roleForm.isSystem && permission.reserved}
                              onClick={() => handleRolePermissionToggle(permission.id)}
                              sx={{
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                py: 0.75,
                                px: 1.5,
                              }}
                            >
                              <Box>
                                <Typography variant="body2" fontWeight={600}>
                                  {permission.name}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                  {permission.key}
                                  {permission.reserved ? ' • super admin only' : ''}
                                </Typography>
                              </Box>
                            </Button>
                          );
                        })}
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRoleDialog} disabled={savingRole}>
            Cancel
          </Button>
          <Button onClick={handleSaveRole} variant="contained" disabled={savingRole}>
            {savingRole ? 'Saving…' : roleForm.id ? 'Update Role' : 'Create Role'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccessControlPage;
