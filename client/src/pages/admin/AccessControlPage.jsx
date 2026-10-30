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
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Tabs,
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
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import {
  createAccessRole,
  createAccessUser,
  deleteAccessRole,
  deleteAccessUser,
  getAccessPermissions,
  getAccessRoles,
  getAccessUsers,
  updateAccessRole,
  updateAccessUserRole,
} from '../../services/adminService';
import { useAuth, useIsSuperAdmin } from '../../hooks/useAuth';
import { PERMISSIONS, IMPLIES } from '../../utils/permissions';
import authorizationSchema from '../../../../shared/authorization.json';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/apiErrors';

const permissionGroupLabels = {
  account: 'My account', api_builder: 'API Builder', attributes: 'Product attributes', tags: 'Product tags',
  menus: 'Store navigation', roles: 'Role management', users: 'Staff accounts',
};
const formatPermissionGroup = (group) => permissionGroupLabels[group]
  || group.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const permissionLabels = {
  'gallery.read': 'View gallery albums',
  'gallery.manage': 'Create and edit galleries',
  'gallery.delete': 'Delete galleries and remove images',
  'newsletter.read': 'View newsletter campaigns',
  'newsletter.manage': 'Manage and send newsletters',
  'newsletter.subscribers_read': 'View and export subscribers',
  'account.self': 'Manage own profile',
  'cart.self': 'Manage own shopping cart',
  'wishlist.self': 'Manage own wishlist',
  'checkout.self': 'Place orders',
  'reviews.create': 'Write reviews',
  'orders.update_status': 'Update order status',
  'orders.refund': 'Refund orders',
  'products.bulk_sale': 'Apply bulk sale pricing',
  'settings.advanced': 'Access advanced settings',
  'roles.read': 'View roles',
  'roles.manage': 'Create and edit custom roles',
  'system_roles.manage': 'Manage built-in roles',
  'audit.read': 'View audit log',
  'notifications.manage': 'Manage notification settings',
  'users.assign_roles': 'Manage staff and assign roles',
  'api_builder.read': 'View API definitions',
  'api_builder.manage': 'Manage API definitions',
};
const permissionActions = { read: 'View', view: 'View', manage: 'Manage', create: 'Create', update: 'Edit', delete: 'Delete', upload: 'Upload', moderate: 'Moderate' };
const getPermissionLabel = (permission) => {
  if (permissionLabels[permission.key]) return permissionLabels[permission.key];
  const [resource, action] = (permission.key || '').split('.');
  const resourceLabel = permissionGroupLabels[resource]?.toLowerCase() || resource;
  return permissionActions[action] ? `${permissionActions[action]} ${resourceLabel}` : permission.name || permission.key;
};

const emptyRoleForm = {
  id: null,
  name: '',
  description: '',
  baseRole: 'admin',
  slug: null,
  permissionIds: [],
  isSystem: false,
  hasHiddenPermissions: false,
};

const emptyUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  sendInvitation: true,
  roleId: '',
};

const AccessControlPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const accessTheme = useMemo(() => createTheme(theme, {
    shape: { borderRadius: 8 },
    palette: {
      background: { default: theme.palette.mode === 'dark' ? '#11151c' : '#f5f6f8', paper: theme.palette.mode === 'dark' ? '#1b2029' : '#ffffff' },
      text: { primary: theme.palette.mode === 'dark' ? '#f1f3f7' : '#202632', secondary: theme.palette.mode === 'dark' ? '#aeb8c7' : '#5e6878' },
      divider: theme.palette.mode === 'dark' ? '#343d4b' : '#e3e7ed',
    },
    components: {
      MuiPaper: { styleOverrides: { root: { borderRadius: 10, backgroundImage: 'none' } } },
      MuiButton: { styleOverrides: { root: { borderRadius: 6, textTransform: 'none', fontWeight: 600, minHeight: 38 } } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiTextField: { styleOverrides: { root: { '& .MuiOutlinedInput-root': { borderRadius: 6 } } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 5 } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 12 } } },
    },
  }), [theme]);
  const { notify } = useNotification();
  const { hasPermission, user: currentUser } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 5 });
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [selectedPermissionsOnly, setSelectedPermissionsOnly] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [roleDetailSearch, setRoleDetailSearch] = useState('');
  const [activeSection, setActiveSection] = useState('roles');
  const [mobileRoleDetailsOpen, setMobileRoleDetailsOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [roleTypeFilter, setRoleTypeFilter] = useState('all');
  const [ownPermissionsOpen, setOwnPermissionsOpen] = useState(false);
  const [ownPermissionSearch, setOwnPermissionSearch] = useState('');
  const [pendingRoleAssignment, setPendingRoleAssignment] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [replacementRoleId, setReplacementRoleId] = useState('');
  const [deletingRole, setDeletingRole] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const canManageCustomRoles = hasPermission(PERMISSIONS.ROLES_MANAGE);
  // System roles are governed by the reserved system_roles.manage grant, which
  // a super admin keeps even if roles.manage is switched off.
  const canManageSystemRoles = hasPermission(PERMISSIONS.SYSTEM_ROLES_MANAGE);
  const canAssignRoles = hasPermission(PERMISSIONS.USERS_ASSIGN_ROLES);

  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState(emptyUserForm);
  const [showPassword, setShowPassword] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  const roleOptions = useMemo(
    () => roles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      baseRole: role.baseRole,
      permissions: role.permissions || [],
      isDelegable: role.isDelegable,
      isActive: role.isActive,
      assignedUserCount: role.assignedUserCount || 0,
    })),
    [roles]
  );

  const isRoleDelegable = useCallback((role) => {
    if (role.isDelegable === false) return false;
    if (isSuperAdmin) return true;
    if (role.baseRole === 'super_admin' || role.slug === 'super_admin') return false;
    const rolePerms = role.permissions || [];
    return rolePerms.every((p) => hasPermission(typeof p === 'string' ? p : p.key));
  }, [hasPermission, isSuperAdmin]);

  const assignableRoleOptions = roleOptions.filter(isRoleDelegable);

  const canGrantPermission = useCallback((permission) => {
    if (isSuperAdmin) return true;
    return hasPermission(permission?.key);
  }, [hasPermission, isSuperAdmin]);

  const ownPermissions = permissions.filter(canGrantPermission);
  const ownPermissionGroups = ownPermissions.reduce((groups, permission) => {
    const group = permission.group || 'general';
    const description = authorizationSchema.permissionDescriptions?.[permission.key] || permission.description || '';
    if (!`${formatPermissionGroup(group)} ${getPermissionLabel(permission)} ${description}`.toLowerCase().includes(ownPermissionSearch.trim().toLowerCase())) return groups;
    (groups[group] ||= []).push(permission);
    return groups;
  }, {});
  const displayedRoles = roles
    .filter((role) => (isSuperAdmin || (role.slug !== 'super_admin' && role.baseRole !== 'super_admin'))
      && (roleTypeFilter === 'all' || (roleTypeFilter === 'system' ? role.isSystem : !role.isSystem))
      && `${role.name} ${role.description || ''}`.toLowerCase().includes(roleSearch.trim().toLowerCase()))
    .map((role) => ({ ...role, permissions: role.permissions.filter(canGrantPermission) }));

  const selectedRole = displayedRoles.find((role) => role.id === selectedRoleId) || displayedRoles[0] || null;
  const roleDetailGroups = (selectedRole?.permissions || []).reduce((groups, permission) => {
    const group = permission.group || 'general';
    const description = authorizationSchema.permissionDescriptions?.[permission.key] || permission.description || '';
    if (`${formatPermissionGroup(group)} ${getPermissionLabel(permission)} ${description}`.toLowerCase().includes(roleDetailSearch.trim().toLowerCase())) {
      (groups[group] ||= []).push(permission);
    }
    return groups;
  }, {});
  const currentSection = canAssignRoles ? activeSection : 'roles';

  const groupedPermissions = useMemo(() => {
    return permissions.reduce((acc, permission) => {
      const canGrant = canGrantPermission(permission);
      const allowedForRole = roleForm.slug === 'super_admin' || !permission.reserved;
      if (!canGrant || !allowedForRole) return acc;
      const group = permission.group || 'general';
      if (!acc[group]) acc[group] = [];
      acc[group].push(permission);
      return acc;
    }, {});
  }, [canGrantPermission, permissions, roleForm.slug]);

  const impliedPermissionKeys = useMemo(() => {
    const selectedKeys = permissions
      .filter((p) => roleForm.permissionIds.includes(p.id))
      .map((p) => p.key);
    const implied = new Set();
    for (const key of selectedKeys) {
      const targets = IMPLIES[key];
      if (targets) targets.forEach((t) => implied.add(t));
    }
    // Remove keys that are already explicitly selected
    for (const key of selectedKeys) implied.delete(key);
    return implied;
  }, [permissions, roleForm.permissionIds]);

  const effectiveSelectedPermissionCount = Object.values(groupedPermissions).flat()
    .filter((permission) => roleForm.permissionIds.includes(permission.id) || impliedPermissionKeys.has(permission.key)).length;

  const filteredPermissionGroups = Object.entries(groupedPermissions).map(([group, groupPermissions]) => {
    const query = permissionSearch.trim().toLowerCase();
    const matchingPermissions = groupPermissions.filter((permission) => {
      const selected = roleForm.permissionIds.includes(permission.id) || impliedPermissionKeys.has(permission.key);
      const description = authorizationSchema.permissionDescriptions?.[permission.key] || permission.description || '';
      const matchesQuery = `${formatPermissionGroup(group)} ${getPermissionLabel(permission)} ${permission.key} ${description}`.toLowerCase().includes(query);
      return matchesQuery && (!selectedPermissionsOnly || selected);
    });
    return [group, matchingPermissions];
  }).filter(([, groupPermissions]) => groupPermissions.length > 0);

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
            includeCustomers: Boolean(debouncedSearch),
          })
        );
      }

      const [rolesResponse, permissionsResponse, usersResponse] = await Promise.all(requests);

      const fetchedRoles = rolesResponse.data.data || [];
      const visibleRoles = isSuperAdmin
        ? fetchedRoles
        : fetchedRoles.filter((role) => role.slug !== 'super_admin' && role.baseRole !== 'super_admin');
      setRoles(visibleRoles.map((role) => ({
        ...role,
        permissions: (role.permissions || []).filter((permission) => canGrantPermission(permission)),
      })));
      setPermissions((permissionsResponse.data.data || []).filter((permission) => canGrantPermission(permission)));
      setRows(usersResponse?.data?.data || []);
      setTotal(usersResponse?.data?.meta?.total || 0);
    } catch (error) {
      notify('Failed to load access control data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [canAssignRoles, canGrantPermission, debouncedSearch, isSuperAdmin, notify, paginationModel.page, paginationModel.pageSize, roleFilter]);

  useEffect(() => {
    fetchAccessControl();
  }, [fetchAccessControl]);

  const openCreateDialog = () => {
    setPermissionSearch('');
    setSelectedPermissionsOnly(false);
    setRoleForm(emptyRoleForm);
    setRoleDialogOpen(true);
  };

  const openEditDialog = (role) => {
    setPermissionSearch('');
    setSelectedPermissionsOnly(false);
    setRoleForm({
      id: role.id,
      name: role.name,
      description: role.description || '',
      baseRole: role.baseRole,
      slug: role.slug,
      permissionIds: role.permissions.map((permission) => permission.id),
      isSystem: role.isSystem,
      hasHiddenPermissions: role.isDelegable === false,
    });
    setRoleDialogOpen(true);
  };

  const closeRoleDialog = () => {
    setRoleDialogOpen(false);
    setRoleForm(emptyRoleForm);
  };

  const handleRolePermissionToggle = (permissionId) => {
    const perm = permissions.find((p) => p.id === permissionId);
    if (perm && !canGrantPermission(perm)) {
      notify('You cannot grant permissions you do not possess.', 'error');
      return;
    }
    setRoleForm((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(permissionId)
        ? current.permissionIds.filter((id) => id !== permissionId)
        : [...current.permissionIds, permissionId],
    }));
  };

  const handleGroupSelectAll = (groupPermissions, checked) => {
    const toggleableIds = groupPermissions
      .filter((p) => (roleForm.slug === 'super_admin' || !p.reserved) && canGrantPermission(p))
      .map((p) => p.id);
    setRoleForm((current) => ({
      ...current,
      permissionIds: checked
        ? [...new Set([...current.permissionIds, ...toggleableIds])]
        : current.permissionIds.filter((id) => !toggleableIds.includes(id)),
    }));
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      notify('Role name is required.', 'error');
      return;
    }

    setSavingRole(true);
    try {
      const payload = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        permissionIds: roleForm.permissionIds,
      };
      // baseRole is only valid for custom roles (customer/admin). Sending a
      // system-role value like `super_admin` fails Joi validation; the server
      // also ignores baseRole for system roles, so omit it entirely.
      if (!roleForm.isSystem) {
        payload.baseRole = roleForm.baseRole;
      }

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

  const openDeleteDialog = (role) => {
    setRoleToDelete(role);
    setReplacementRoleId('');
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deletingRole) return;
    setDeleteDialogOpen(false);
    setRoleToDelete(null);
    setReplacementRoleId('');
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setDeletingRole(true);
    try {
      await deleteAccessRole(roleToDelete.id, replacementRoleId || null);
      notify(`Role "${roleToDelete.name}" deleted successfully.`, 'success');
      if (roleFilter === roleToDelete.id) {
        setRoleFilter('');
      }
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
      setReplacementRoleId('');
      if (roleDialogOpen && roleForm.id === roleToDelete.id) {
        closeRoleDialog();
      }
      fetchAccessControl();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to delete role.'), 'error');
    } finally {
      setDeletingRole(false);
    }
  };

  const handleRoleAssignment = async (userId, nextRoleId) => {
    setUpdatingUserId(userId);
    try {
      await updateAccessUserRole(userId, nextRoleId);
      setPendingRoleAssignment(null);
      notify('User access role updated successfully.', 'success');
      fetchAccessControl();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to update user role.'), 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const openDeleteUserDialog = (user) => {
    setUserToDelete(user);
    setDeleteUserDialogOpen(true);
  };

  const closeDeleteUserDialog = () => {
    setDeleteUserDialogOpen(false);
    setUserToDelete(null);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await deleteAccessUser(userToDelete.id);
      notify(`Staff user "${userToDelete.email}" deleted successfully.`, 'success');
      closeDeleteUserDialog();
      fetchAccessControl();
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to delete user.'), 'error');
    } finally {
      setDeletingUser(false);
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

  // Close restricted dialogs the moment the governing permission is lost so a
  // revoked admin never keeps an open write surface. System-role editing is
  // governed by system_roles.manage (reserved, super-admin only); custom roles
  // and role deletion use roles.manage; staff-user ops use users.assign_roles.
  useEffect(() => {
    if (!roleDialogOpen) return;
    const stillEditable = roleForm.isSystem ? canManageSystemRoles : canManageCustomRoles;
    if (!stillEditable) closeRoleDialog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleDialogOpen, roleForm.isSystem, canManageSystemRoles, canManageCustomRoles]);

  useEffect(() => {
    if (!canManageCustomRoles && deleteDialogOpen) closeDeleteDialog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageCustomRoles, deleteDialogOpen]);

  useEffect(() => {
    if (!canAssignRoles && createUserDialogOpen) closeCreateUserDialog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssignRoles, createUserDialogOpen]);

  useEffect(() => {
    if (!canAssignRoles && deleteUserDialogOpen) closeDeleteUserDialog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssignRoles, deleteUserDialogOpen]);

  useEffect(() => {
    if (!canAssignRoles) setPendingRoleAssignment(null);
  }, [canAssignRoles]);

  const handleCreateUser = async () => {
    const { firstName, lastName, email, password, roleId, sendInvitation } = createUserForm;
    if (!firstName.trim() || !lastName.trim()) {
      notify('First and last name are required.', 'error');
      return;
    }
    if (!email.trim()) {
      notify('Email is required.', 'error');
      return;
    }
    if (!sendInvitation && password.length < 8) {
      notify('Password must be at least 8 characters.', 'error');
      return;
    }
    if (!roleId) {
      notify('Please select a role.', 'error');
      return;
    }

    setSavingUser(true);
    try {
      await createAccessUser({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), ...(sendInvitation ? {} : { password }), roleId, sendInvitation });
      notify(sendInvitation ? 'Staff account created and invitation queued.' : 'Staff user created successfully.', 'success');
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
        const isSuperAdminAccount = row.role === 'super_admin' || row.assignedRole?.slug === 'super_admin';
        const cannotModify = row.id === currentUser?.id || (!isSuperAdmin && isSuperAdminAccount);
        return (
          <FormControl size="small" fullWidth title={row.id === currentUser?.id ? 'You cannot change your own role' : undefined}>
            <Select
              value={row.roleId || ''}
              disabled={updatingUserId === row.id || cannotModify}
              onChange={(event) => {
                if (String(row.roleId) !== String(event.target.value)) {
                  setPendingRoleAssignment({ user: row, nextRoleId: event.target.value });
                }
              }}
              inputProps={{ 'aria-label': `Assigned role for ${row.email}` }}
              displayEmpty
              renderValue={() => currentRole?.name || row.assignedRole?.name || row.roleName || 'Select role…'}
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
              {currentRole && !isRoleDelegable(currentRole) && (
                <MenuItem value={currentRole.id} sx={{ display: 'none' }} disabled>
                  {currentRole.name}
                </MenuItem>
              )}
              {assignableRoleOptions.map((role) => (
                <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 70,
      sortable: false,
      align: 'right',
      renderCell: ({ row }) => {
        const isCustomer =
          row.assignedRole?.slug === 'customer' ||
          (row.role === 'customer' && (!row.assignedRole || row.assignedRole.slug === 'customer'));
        const isSelf = row.id === currentUser?.id;
        const isSuperAdminAccount = row.role === 'super_admin' || row.assignedRole?.slug === 'super_admin';
        let tooltipTitle = 'Delete user';
        if (isCustomer) {
          tooltipTitle = 'Customer accounts cannot be deleted (manage from Customers page)';
        } else if (isSelf) {
          tooltipTitle = 'You cannot delete your own account';
        } else if (!isSuperAdmin && isSuperAdminAccount) {
          tooltipTitle = 'Only super admins can delete super admin accounts';
        }
        return (
          <Tooltip title={tooltipTitle}>
            <span>
              <IconButton
                size="small"
                color="error"
                aria-label={`Delete user ${row.email}`}
                onClick={() => openDeleteUserDialog(row)}
                disabled={deletingUser || isSelf || isCustomer || (!isSuperAdmin && isSuperAdminAccount)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
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

  const canEditRole = (role) =>
    role.slug !== 'super_admin'
    && role.baseRole !== 'super_admin'
    && ((role.isSystem && isSuperAdmin) || (!role.isSystem && canManageCustomRoles));

  const canDeleteRole = (role) =>
    Boolean(role && !role.isSystem && canManageCustomRoles);

  return (
    <ThemeProvider theme={accessTheme}>
    <Box sx={{ bgcolor: 'background.default', color: 'text.primary', m: { xs: -2, sm: -3 }, p: { xs: 2, sm: 3, lg: 4 }, minHeight: 'calc(100vh - 64px)' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2.5} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight={700} sx={{ letterSpacing: '-0.025em', mb: 0.75 }}>Access Control</Typography>
          <Typography variant="body2" color="text.secondary">Choose what your team can see and do.</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {canAssignRoles && <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={openCreateUserDialog}>Create User</Button>}
          {canManageCustomRoles && <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={openCreateDialog}>Create Role</Button>}
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
        <Tabs value={currentSection} onChange={(_, value) => setActiveSection(value)} aria-label="Access control sections" sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, minWidth: 100, px: 2, textTransform: 'none', fontWeight: 600 } }}>
          <Tab value="roles" label="Roles" aria-controls="access-roles-panel" />
          {canAssignRoles && <Tab value="staff" label="Staff accounts" aria-controls="access-staff-panel" />}
        </Tabs>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
          <SecurityIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Your access · </Box>{loading && permissions.length === 0 ? 'Loading…' : `${ownPermissions.length} permissions`}</Typography>
          <Button size="small" sx={{ whiteSpace: 'nowrap', fontSize: 13 }} onClick={() => { setOwnPermissionSearch(''); setOwnPermissionsOpen(true); }} disabled={loading && permissions.length === 0}>View my permissions</Button>
        </Stack>
      </Stack>

      {currentSection === 'roles' && <Paper role="tabpanel" id="access-roles-panel" aria-label="Roles" variant="outlined" sx={{ borderRadius: '10px', overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px minmax(0, 1fr)' }, minHeight: { md: 620 } }}>
          <Box component="section" aria-label="Role directory" sx={{ display: isMobile && mobileRoleDetailsOpen ? 'none' : 'block', borderRight: { md: '1px solid' }, borderBottom: { xs: '1px solid', md: 0 }, borderColor: { xs: 'divider', md: 'divider' } }}>
            <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography component="h2" variant="subtitle1" fontWeight={700}>Roles</Typography>
                <Typography variant="body2" color="text.secondary">{displayedRoles.length}</Typography>
              </Stack>
              <TextField size="small" label="Search roles" fullWidth value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
              <FormControl size="small" fullWidth sx={{ mt: 1.5 }}>
                <InputLabel id="role-type-filter-label">Role type</InputLabel>
                <Select labelId="role-type-filter-label" label="Role type" value={roleTypeFilter} onChange={(event) => setRoleTypeFilter(event.target.value)}>
                  <MenuItem value="all">All roles</MenuItem>
                  <MenuItem value="system">Built-in roles</MenuItem>
                  <MenuItem value="custom">Custom roles</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ py: 1, maxHeight: { xs: 360, md: 560 }, overflowY: 'auto' }}>
              {displayedRoles.map((role) => (
                <Box
                  key={role.id}
                  component="button"
                  type="button"
                  aria-label={`View role ${role.name}`}
                  aria-controls="selected-role-details"
                  aria-pressed={selectedRole?.id === role.id}
                  onClick={() => { setSelectedRoleId(role.id); setRoleDetailSearch(''); if (isMobile) setMobileRoleDetailsOpen(true); }}
                  sx={{ border: 0, borderRadius: 0, width: '100%', p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'text.primary', bgcolor: selectedRole?.id === role.id ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
                >
                  <Box sx={{ display: 'flex', '& svg': { fontSize: 23 } }}>{getRoleIcon(role)}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography component="span" display="block" variant="body2" fontWeight={700}>{role.name}</Typography>
                    <Typography component="span" display="block" variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>{role.isSystem ? 'Built-in' : 'Custom'} · {role.permissions.length} permissions</Typography>
                  </Box>
                  {role.slug === 'super_admin' ? <LockOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> : <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                </Box>
              ))}
              {loading && roles.length === 0 && <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} aria-label="Loading roles" /></Box>}
              {!loading && displayedRoles.length === 0 && <Box sx={{ p: 2.5 }}>
                <Typography variant="body2" fontWeight={600}>{roles.length ? 'No roles match your filters' : 'No roles available'}</Typography>
                {(roleSearch || roleTypeFilter !== 'all') && <Button size="small" sx={{ mt: 1 }} onClick={() => { setRoleSearch(''); setRoleTypeFilter('all'); }}>Clear filters</Button>}
              </Box>}
            </Box>
          </Box>
          <Box component="section" id="selected-role-details" aria-label="Role details" sx={{ minWidth: 0, display: isMobile && !mobileRoleDetailsOpen ? 'none' : 'block' }}>
            {isMobile && <Button startIcon={<ArrowBackIcon />} size="small" sx={{ ml: 2, mt: 1.5 }} onClick={() => setMobileRoleDetailsOpen(false)}>All roles</Button>}
            {selectedRole ? <>
              <Box sx={{ p: { xs: 2.5, sm: 3 }, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography component="h2" variant="h5" fontWeight={700}>{selectedRole.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{selectedRole.isSystem ? 'Built-in role' : 'Custom role'} · {selectedRole.baseRole === 'customer' ? 'Customer account' : 'Staff account'}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    {canEditRole(selectedRole) && <Button size="small" sx={{ whiteSpace: 'nowrap' }} variant="outlined" startIcon={<EditIcon />} aria-label={`Edit ${selectedRole.name}`} onClick={() => openEditDialog(selectedRole)}>Edit role</Button>}
                    {canDeleteRole(selectedRole) && <IconButton size="small" color="error" aria-label={`Delete ${selectedRole.name}`} onClick={() => openDeleteDialog(selectedRole)}><DeleteIcon fontSize="small" /></IconButton>}
                    {selectedRole.slug === 'super_admin' && <Chip icon={<LockOutlinedIcon />} label="Protected" size="small" variant="outlined" />}
                  </Stack>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: '70ch', lineHeight: 1.65 }}>{selectedRole.description || 'No description provided.'}</Typography>
                {(selectedRole.isSystem || selectedRole.isDelegable === false) && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  {selectedRole.slug === 'super_admin' ? 'This role is protected and cannot be edited.' : selectedRole.isSystem ? 'Built-in roles can be edited only by Super Admins.' : 'Permissions outside your access are hidden and preserved when you save.'}
                </Typography>}
              </Box>
              <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 2.5 }}>
                  <Box>
                    <Typography component="h3" variant="subtitle1" fontWeight={700}>Permissions <Typography component="span" variant="body2" color="text.secondary">({selectedRole.permissions.length})</Typography></Typography>
                    <Typography variant="caption" color="text.secondary">{isSuperAdmin ? 'Actions granted to this role.' : 'Only permissions within your access are shown.'}</Typography>
                  </Box>
                  <TextField size="small" label="Find role permissions" value={roleDetailSearch} onChange={(event) => setRoleDetailSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
                </Stack>
                <Box sx={{ maxHeight: { md: 510 }, overflowY: 'auto', pr: { md: 1 } }}>
                  {Object.entries(roleDetailGroups).sort(([left], [right]) => formatPermissionGroup(left).localeCompare(formatPermissionGroup(right))).map(([group, groupPermissions]) => <Box component="section" key={group} sx={{ mb: 3 }}>
                    <Typography component="h4" variant="body2" fontWeight={700} sx={{ mb: 1, color: 'text.secondary' }}>{formatPermissionGroup(group)}</Typography>
                    {groupPermissions.map((permission) => <Box key={permission.id} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="body2" fontWeight={600}>{getPermissionLabel(permission)}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{authorizationSchema.permissionDescriptions?.[permission.key] || permission.description}</Typography>
                    </Box>)}
                  </Box>)}
                  {Object.keys(roleDetailGroups).length === 0 && <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>{roleDetailSearch ? 'No permissions match your search.' : 'No permissions within your access are assigned to this role.'}</Typography>}
                </Box>
              </Box>
            </> : <Box sx={{ p: 5, color: 'text.secondary' }}><Typography variant="body1">Select a role to view its permissions.</Typography></Box>}
          </Box>
        </Box>
      </Paper>}

      {/* User Assignment Table */}
      {canAssignRoles && currentSection === 'staff' && (
        <Paper
          role="tabpanel"
          id="access-staff-panel"
          aria-label="Staff accounts"
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: '10px',
          }}
        >
          <Typography component="h2" variant="h6" fontWeight={700} gutterBottom>
            Staff access
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
            Review each person’s role. Search by name or email to include customer accounts. Role changes require confirmation.
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
                minWidth: { xs: 0, sm: 260 },
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
                <MenuItem value="">All elevated roles</MenuItem>
                {roleOptions.map((role) => (
                  <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Box
            sx={{
              width: '100%',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'background.paper',
            }}
          >
            <DataGrid
              rows={rows}
              columns={columns}
              rowCount={total}
              loading={loading}
              pagination
              paginationMode="server"
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={[5, 10, 25]}
              disableRowSelectionOnClick
              autoHeight
              sx={{
                border: 0,
                '& .MuiDataGrid-cell': {
                  px: { xs: 1, sm: 2 },
                },
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor: 'background.default',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                },
                '& .MuiDataGrid-footerContainer': {
                  borderTop: '1px solid',
                  borderColor: 'divider',
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
            <FormControlLabel control={<Checkbox checked={createUserForm.sendInvitation} onChange={(event) => setCreateUserForm((previous) => ({ ...previous, sendInvitation: event.target.checked }))} />} label="Email an invitation to set their own password" />
            {!createUserForm.sendInvitation && <TextField
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
            />}
            <FormControl size="small" fullWidth>
              <InputLabel>Assign Role</InputLabel>
              <Select
                label="Assign Role"
                inputProps={{ 'aria-label': 'Assign Role' }}
                value={createUserForm.roleId}
                onChange={setUserField('roleId')}
              >
                {assignableRoleOptions.map((role) => (
                  <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
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

      {/* Read-only view of the current account's effective permissions. */}
      <Dialog open={ownPermissionsOpen} onClose={() => setOwnPermissionsOpen(false)} fullWidth maxWidth="md" fullScreen={isMobile} aria-labelledby="own-permissions-title">
        <DialogTitle id="own-permissions-title">Your permissions</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These {ownPermissions.length} permissions determine which actions your account can perform.
          </Typography>
          <TextField
            label="Find my permissions"
            value={ownPermissionSearch}
            onChange={(event) => setOwnPermissionSearch(event.target.value)}
            size="small"
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ mb: 2 }}
          />
          <Stack spacing={2}>
            {Object.entries(ownPermissionGroups).map(([group, groupPermissions]) => (
              <Paper key={group} component="section" variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
                <Typography component="h3" variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{formatPermissionGroup(group)}</Typography>
                {groupPermissions.map((permission) => (
                  <Box key={permission.id} sx={{ py: 1, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
                    <Typography variant="body2" fontWeight={600}>{getPermissionLabel(permission)}</Typography>
                    <Typography variant="body2" color="text.secondary">{authorizationSchema.permissionDescriptions?.[permission.key] || permission.description}</Typography>
                  </Box>
                ))}
              </Paper>
            ))}
            {Object.keys(ownPermissionGroups).length === 0 && <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              {ownPermissionSearch ? 'No permissions match your search.' : 'Your account has no permissions to display.'}
            </Typography>}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setOwnPermissionsOpen(false)}>Done</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingRoleAssignment)} onClose={updatingUserId ? undefined : () => setPendingRoleAssignment(null)} fullWidth maxWidth="xs" aria-labelledby="role-assignment-title">
        <DialogTitle id="role-assignment-title">Confirm role change</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Change the assigned role for <strong>{pendingRoleAssignment?.user.email}</strong>?
          </DialogContentText>
          <Paper variant="outlined" sx={{ p: 2, my: 2, borderRadius: 1.5 }}>
            <Typography variant="body2" color="text.secondary">Current role</Typography>
            <Typography variant="body1" fontWeight={600}>{pendingRoleAssignment?.user.roleName || pendingRoleAssignment?.user.assignedRole?.name || 'Unassigned'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>New role</Typography>
            <Typography variant="body1" fontWeight={600}>{roleOptions.find((role) => role.id === pendingRoleAssignment?.nextRoleId)?.name || 'Unavailable'}</Typography>
          </Paper>
          <DialogContentText>Their access will change to the permissions of the new role.</DialogContentText>
          {pendingRoleAssignment && !roleOptions.some((role) => role.id === pendingRoleAssignment.nextRoleId && isRoleDelegable(role)) && <Alert severity="warning" sx={{ mt: 2 }}>
            You can no longer assign this role with your current permissions.
          </Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRoleAssignment(null)} disabled={Boolean(updatingUserId)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={Boolean(updatingUserId) || !canAssignRoles || !roleOptions.some((role) => role.id === pendingRoleAssignment?.nextRoleId && isRoleDelegable(role))}
            onClick={() => handleRoleAssignment(pendingRoleAssignment.user.id, pendingRoleAssignment.nextRoleId)}
          >{updatingUserId ? 'Updating…' : 'Confirm change'}</Button>
        </DialogActions>
      </Dialog>

      {/* Create / Edit Role Dialog */}
      <Dialog
        open={roleDialogOpen}
        onClose={savingRole ? undefined : closeRoleDialog}
        fullWidth
        maxWidth="lg"
        fullScreen={isMobile}
        aria-labelledby="role-editor-title"
        aria-describedby="role-editor-description"
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 2 }, maxHeight: { sm: '90vh' } } }}
      >
        <DialogTitle id="role-editor-heading-container" component="div" sx={{ px: 3, pt: 3, pb: 2 }}>
          <Typography id="role-editor-title" component="h2" variant="h5" fontWeight={700}>
            {roleForm.id ? roleForm.isSystem ? 'Edit system role' : 'Edit custom role' : 'Create custom role'}
          </Typography>
          <Typography id="role-editor-description" component="p" variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Give this role the permissions needed for its work.
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px minmax(0, 1fr)' } }}>
            <Stack spacing={2.5} sx={{ p: 3, borderRight: { md: '1px solid' }, borderColor: { md: 'divider' }, bgcolor: 'action.hover' }}>
              <Typography component="h3" variant="subtitle2" fontWeight={700}>Role details</Typography>
              <TextField
                label="Role name"
                placeholder="For example, Inventory manager"
                value={roleForm.name}
                onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
                fullWidth
                required
                inputProps={{ maxLength: 100 }}
                disabled={roleForm.isSystem || savingRole}
              />
              <TextField
                label="Description (optional)"
                placeholder="What will this person be responsible for?"
                value={roleForm.description}
                onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))}
                fullWidth
                multiline
                minRows={3}
                inputProps={{ maxLength: 255 }}
                disabled={savingRole}
              />
              <FormControl component="fieldset" disabled={roleForm.isSystem || savingRole}>
                <Typography component="legend" variant="subtitle2" fontWeight={700}>Account type</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                  Who will use this role? This choice does not add permissions.
                </Typography>
                <RadioGroup
                  aria-label="Account type"
                  value={roleForm.baseRole}
                  onChange={(event) => setRoleForm((current) => ({ ...current, baseRole: event.target.value }))}
                  sx={{ gap: 1 }}
                >
                  {[
                    { value: 'admin', label: 'Staff', description: 'People working in your store.' },
                    { value: 'customer', label: 'Customer', description: 'People shopping in your store.' },
                  ].map((type) => (
                    <Paper key={type.value} variant="outlined" sx={{ borderRadius: 1.5, borderColor: roleForm.baseRole === type.value ? 'primary.main' : 'divider' }}>
                      <FormControlLabel
                        value={type.value}
                        control={<Radio size="small" />}
                        sx={{ m: 0, p: 1, width: '100%', alignItems: 'flex-start' }}
                        label={<Box sx={{ pt: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}>{type.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{type.description}</Typography>
                        </Box>}
                      />
                    </Paper>
                  ))}
                </RadioGroup>
              </FormControl>
              {roleForm.isSystem && <Alert severity="info">This built-in role keeps its name and account type.</Alert>}
              {!isSuperAdmin && <Alert severity="info">Only permissions you have are available to grant.</Alert>}
              {roleForm.hasHiddenPermissions && <Alert severity="info">This role also has permissions outside your access. Those permissions are preserved when you save.</Alert>}
            </Stack>
            <Box sx={{ minWidth: 0, p: { xs: 2, sm: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 0.75 }}>
                <Typography variant="h6" component="h3" fontWeight={700}>Permissions</Typography>
                <Chip role="status" size="small" label={`${effectiveSelectedPermissionCount} selected`} color="primary" variant="outlined" />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose what this role can do. Required viewing permissions are included automatically.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                <TextField
                  label="Search permissions"
                  placeholder="Search products, orders, refunds…"
                  size="small"
                  fullWidth
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <FormControlLabel
                  control={<Checkbox size="small" checked={selectedPermissionsOnly} onChange={(event) => setSelectedPermissionsOnly(event.target.checked)} />}
                  label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>Selected only</Typography>}
                  sx={{ mr: 0 }}
                />
              </Stack>
              {effectiveSelectedPermissionCount === 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>{roleForm.hasHiddenPermissions
                  ? 'No permissions selected within your access. Existing permissions outside your access will be preserved.'
                  : 'No permissions selected. This role will grant no access until permissions are added.'}</Alert>
              )}
              <Stack spacing={2}>
                {filteredPermissionGroups.map(([group, groupPermissions]) => {
                  const selectedCount = groupPermissions.filter((permission) => roleForm.permissionIds.includes(permission.id) || impliedPermissionKeys.has(permission.key)).length;
                  return (
                    <Paper key={group} variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
                      <Box sx={{ px: 1.5, py: 0.75, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <FormControlLabel
                          control={<Checkbox
                            size="small"
                            checked={selectedCount === groupPermissions.length}
                            indeterminate={selectedCount > 0 && selectedCount < groupPermissions.length}
                            onChange={(event) => handleGroupSelectAll(groupPermissions, event.target.checked)}
                            disabled={savingRole}
                            inputProps={{ 'aria-label': `Select shown ${formatPermissionGroup(group)} permissions` }}
                          />}
                          label={<Typography component="span" variant="subtitle2" fontWeight={700}>{formatPermissionGroup(group)}</Typography>}
                          sx={{ m: 0 }}
                        />
                        <Typography variant="caption" color="text.secondary">{selectedCount} of {groupPermissions.length}</Typography>
                      </Box>
                      {groupPermissions.map((permission) => {
                        const isImplied = impliedPermissionKeys.has(permission.key);
                        const selected = roleForm.permissionIds.includes(permission.id) || isImplied;
                        const description = authorizationSchema.permissionDescriptions?.[permission.key] || permission.description;
                        return (
                          <Box key={permission.id} sx={{ px: 1.5, py: 0.75, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
                            <FormControlLabel
                              control={<Checkbox
                                size="small"
                                checked={selected}
                                disabled={isImplied || savingRole || !canGrantPermission(permission)}
                                onChange={() => handleRolePermissionToggle(permission.id)}
                                inputProps={{
                                  'aria-label': getPermissionLabel(permission),
                                  'aria-describedby': `permission-description-${permission.id}${isImplied ? ` permission-included-${permission.id}` : ''}`,
                                }}
                              />}
                              sx={{ m: 0, width: '100%', alignItems: 'flex-start', '& .MuiFormControlLabel-label': { py: 0.5 } }}
                              label={<Box>
                                <Typography component="span" display="block" variant="body2" fontWeight={600}>
                                  {getPermissionLabel(permission)}
                                  {isImplied && <Typography id={`permission-included-${permission.id}`} component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>Included automatically</Typography>}
                                </Typography>
                                <Typography id={`permission-description-${permission.id}`} component="span" display="block" variant="body2" color="text.secondary">{description}</Typography>
                              </Box>}
                            />
                          </Box>
                        );
                      })}
                    </Paper>
                  );
                })}
                {filteredPermissionGroups.length === 0 && <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">{selectedPermissionsOnly ? 'No selected permissions match your search.' : 'No permissions match your search.'}</Typography>
                </Paper>}
              </Stack>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: roleForm.id && !roleForm.isSystem && canManageCustomRoles ? 'space-between' : 'flex-end', px: 3, py: 2 }}>
          {roleForm.id && !roleForm.isSystem && canManageCustomRoles && (
            <Button
              color="error"
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={() => {
                const found = roles.find((r) => r.id === roleForm.id);
                if (found) openDeleteDialog(found);
              }}
              disabled={savingRole || deletingRole}
            >
              Delete Role
            </Button>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={closeRoleDialog} disabled={savingRole || deletingRole}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} variant="contained" disabled={savingRole || deletingRole || !roleForm.name.trim()}>
              {savingRole ? 'Saving…' : roleForm.id ? 'Update Role' : 'Create Role'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Role Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Delete Custom Role
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the role <strong>"{roleToDelete?.name}"</strong>?
          </DialogContentText>
          {Number(roleToDelete?.assignedUserCount || 0) > 0 ? (
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <Alert severity="warning">
                {roleToDelete.assignedUserCount} user{roleToDelete.assignedUserCount === 1 ? '' : 's'} currently have this role. Choose a replacement role to move them before deletion.
              </Alert>
              <FormControl fullWidth size="small" required>
                <InputLabel id="replacement-role-label">Replacement role</InputLabel>
                <Select
                  labelId="replacement-role-label"
                  value={replacementRoleId}
                  label="Replacement role"
                  onChange={(event) => setReplacementRoleId(event.target.value)}
                  disabled={deletingRole}
                >
                  {roleOptions
                    .filter((role) => role.id !== roleToDelete.id && role.isActive !== false && isRoleDelegable(role))
                    .map((role) => (
                      <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
                    ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                Reassigned users will receive the replacement role’s permissions.
              </Typography>
              {!roleOptions.some((role) => role.id !== roleToDelete.id && role.isActive !== false && isRoleDelegable(role)) && (
                <Alert severity="info">No eligible replacement roles are available to your account.</Alert>
              )}
            </Stack>
          ) : (
            <DialogContentText sx={{ mt: 1, fontSize: '0.85rem', color: 'text.secondary' }}>
              This will permanently remove the custom role and its associated permissions. This action cannot be undone.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDeleteDialog} disabled={deletingRole}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteRole}
            color="error"
            variant="contained"
            disabled={deletingRole || (Number(roleToDelete?.assignedUserCount || 0) > 0 && !replacementRoleId)}
            startIcon={deletingRole ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          >
            {deletingRole ? 'Deleting…' : 'Delete Role'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={deleteUserDialogOpen}
        onClose={closeDeleteUserDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Delete Staff Account
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the staff account for <strong>"{userToDelete?.email}"</strong>?
          </DialogContentText>
          <DialogContentText sx={{ mt: 1, fontSize: '0.85rem', color: 'text.secondary' }}>
            This will permanently revoke all roles, active login sessions, and permissions for this user.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDeleteUserDialog} disabled={deletingUser}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteUser}
            color="error"
            variant="contained"
            disabled={deletingUser}
            startIcon={deletingUser ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          >
            {deletingUser ? 'Deleting…' : 'Delete User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </ThemeProvider>
  );
};

export default AccessControlPage;
