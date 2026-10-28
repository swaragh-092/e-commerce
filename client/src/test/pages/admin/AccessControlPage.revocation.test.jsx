import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccessControlPage from '../../../pages/admin/AccessControlPage';
import { PERMISSIONS } from '../../../utils/permissions';

const perms = vi.hoisted(() => ({ current: {} }));
const hasPermission = (permission) => Boolean(perms.current[permission]);
const notify = vi.fn();

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    hasPermission,
    user: { id: 'admin-1', firstName: 'Admin', lastName: 'User' },
  }),
  useIsSuperAdmin: () => true,
}));

vi.mock('../../../services/adminService', () => ({
  getAccessRoles: vi.fn(),
  getAccessPermissions: vi.fn(),
  getAccessUsers: vi.fn(),
  createAccessRole: vi.fn(),
  updateAccessRole: vi.fn(),
  deleteAccessRole: vi.fn(),
  createAccessUser: vi.fn(),
  updateAccessUserRole: vi.fn(),
  deleteAccessUser: vi.fn(),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ notify }),
}));

// jsdom's cssstyle cannot parse DataGrid's CSS-variable border shorthand.
// These tests target the role cards, not the user grid, so stub it out.
vi.mock('@mui/x-data-grid', () => ({ DataGrid: () => null }));

const adminService = await import('../../../services/adminService');

const SYSTEM_ROLE = {
  id: 'role-admin',
  name: 'Admin',
  slug: 'admin',
  baseRole: 'admin',
  isSystem: true,
  description: 'Full access',
  permissions: [{ id: 'perm-1', key: PERMISSIONS.PRODUCTS_READ }],
};
const CUSTOM_ROLE = {
  id: 'role-cu',
  name: 'Manager',
  slug: 'manager',
  baseRole: 'admin',
  isSystem: false,
  description: 'Limited access',
  permissions: [{ id: 'perm-1', key: PERMISSIONS.PRODUCTS_READ }],
};

const grant = (extra = {}) => ({
  [PERMISSIONS.ROLES_READ]: true,
  [PERMISSIONS.ROLES_MANAGE]: true,
  [PERMISSIONS.SYSTEM_ROLES_MANAGE]: true,
  [PERMISSIONS.USERS_ASSIGN_ROLES]: true,
  ...extra,
});

describe('AccessControlPage revocation closes restricted dialogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    perms.current = grant();
    adminService.getAccessRoles.mockResolvedValue({ data: { data: [SYSTEM_ROLE, CUSTOM_ROLE] } });
    adminService.getAccessPermissions.mockResolvedValue({
      data: { data: [{ id: 'perm-1', key: PERMISSIONS.PRODUCTS_READ, group: 'products', reserved: false }] },
    });
    adminService.getAccessUsers.mockResolvedValue({ data: { data: [], meta: { total: 0 } } });
  });

  it('keeps the system-role editor open when roles.manage is revoked but system_roles.manage remains', async () => {
    const { rerender } = render(<AccessControlPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Admin' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit Admin' }));
    expect(await screen.findByText('Edit system role')).toBeInTheDocument();

    // Revoke roles.manage while the reserved system_roles.manage stays granted.
    perms.current = grant({ [PERMISSIONS.ROLES_MANAGE]: false });
    rerender(<AccessControlPage />);

    // The system-role editor must stay open for recovery.
    expect(screen.getByText('Edit system role')).toBeInTheDocument();
  });

  it('closes the custom-role editor when roles.manage is revoked', async () => {
    const { rerender } = render(<AccessControlPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'View role Manager' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Manager' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit Manager' }));
    expect(await screen.findByText('Edit custom role')).toBeInTheDocument();

    perms.current = grant({ [PERMISSIONS.ROLES_MANAGE]: false });
    rerender(<AccessControlPage />);

    await waitFor(() => expect(screen.queryByText('Edit custom role')).not.toBeInTheDocument());
  });

  it('closes the role-deletion confirmation when roles.manage is revoked', async () => {
    const { rerender } = render(<AccessControlPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'View role Manager' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Manager' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete Manager' }));
    expect(await screen.findByText('Delete Custom Role')).toBeInTheDocument();

    perms.current = grant({ [PERMISSIONS.ROLES_MANAGE]: false });
    rerender(<AccessControlPage />);

    await waitFor(() => expect(screen.queryByText('Delete Custom Role')).not.toBeInTheDocument());
  });
});
