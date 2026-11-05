import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccessControlPage from '../../../pages/admin/AccessControlPage';

const auth = vi.hoisted(() => ({ grants: new Set() }));
const hasPermission = (key) => auth.grants.has(key);
const notify = vi.fn();
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ hasPermission, user: { id: 'manager' } }),
  useIsSuperAdmin: () => false,
}));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify }) }));
// Exercise the actual column controls without DataGrid's unsupported jsdom CSS.
vi.mock('@mui/x-data-grid', () => ({ DataGrid: ({ rows, columns }) => <div>{rows.map((row) => <div key={row.id}>
  {columns.filter((column) => column.renderCell).map((column) => <div key={column.field}>{column.renderCell({ row, value: row[column.field] })}</div>)}
</div>)}</div> }));
vi.mock('../../../services/adminService', () => ({
  getAccessRoles: vi.fn(), getAccessPermissions: vi.fn(), getAccessUsers: vi.fn(),
  createAccessRole: vi.fn(), updateAccessRole: vi.fn(), deleteAccessRole: vi.fn(),
  createAccessUser: vi.fn(), updateAccessUserRole: vi.fn(), deleteAccessUser: vi.fn(),
  updateAccessUserStatus: vi.fn(),
}));
const service = await import('../../../services/adminService');
const permissions = [
  { id: 'read', key: 'categories.read', name: 'View categories', group: 'categories' },
  { id: 'manage', key: 'categories.manage', name: 'Manage categories', group: 'categories' },
  { id: 'refund', key: 'orders.refund', name: 'Refund orders', group: 'orders' },
];
const openEditor = async () => {
  render(<AccessControlPage />);
  await screen.findByText('Access Control');
  await waitFor(() => expect(service.getAccessPermissions).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Create Role', exact: true }));
  return within(screen.getByRole('dialog', { name: 'Create custom role' }));
};

describe('custom role editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.grants = new Set(['roles.manage', 'roles.read', 'categories.read', 'categories.manage']);
    service.getAccessRoles.mockResolvedValue({ data: { data: [] } });
    service.getAccessPermissions.mockResolvedValue({ data: { data: permissions } });
    service.createAccessRole.mockResolvedValue({ data: {} });
  });

  it('creates an empty staff role without inheriting Admin permissions', async () => {
    const editor = await openEditor();
    expect(editor.getByRole('radio', { name: /Staff/ })).toBeChecked();
    expect(editor.queryByLabelText('Base Role')).not.toBeInTheDocument();
    expect(editor.getByText(/This role will grant no access/)).toBeInTheDocument();
    fireEvent.change(editor.getByRole('textbox', { name: /Role name/ }), { target: { value: 'New staff' } });
    fireEvent.click(editor.getByRole('button', { name: 'Create Role', exact: true }));
    await waitFor(() => expect(service.createAccessRole).toHaveBeenCalledWith({
      name: 'New staff', description: '', baseRole: 'admin', permissionIds: [],
    }));
  });

  it('hides permissions outside the actor grants and searches descriptions', async () => {
    const editor = await openEditor();
    await editor.findByText('Manage categories');
    expect(editor.queryByText('Refund orders')).not.toBeInTheDocument();
    fireEvent.change(editor.getByRole('textbox', { name: 'Search permissions' }), { target: { value: 'create, edit' } });
    expect(editor.getByText('Manage categories')).toBeInTheDocument();
    expect(editor.queryByText('View categories')).not.toBeInTheDocument();
    fireEvent.change(editor.getByRole('textbox', { name: 'Search permissions' }), { target: { value: 'no-such-permission' } });
    expect(editor.getByText('No permissions match your search.')).toBeInTheDocument();
  });

  it('shows automatically included viewing permission and submits explicit grants', async () => {
    const editor = await openEditor();
    const manage = await editor.findByRole('checkbox', { name: 'Manage categories', exact: true });
    fireEvent.click(manage);
    const read = editor.getByRole('checkbox', { name: 'View categories', exact: true });
    expect(read).toBeChecked();
    expect(read).toBeDisabled();
    expect(read).toHaveAccessibleDescription('View product categories Included automatically');
    expect(editor.getByText('2 selected')).toBeInTheDocument();
    fireEvent.change(editor.getByRole('textbox', { name: /Role name/ }), { target: { value: 'Catalog editor' } });
    fireEvent.click(editor.getByRole('button', { name: 'Create Role', exact: true }));
    await waitFor(() => expect(service.createAccessRole).toHaveBeenCalledWith(expect.objectContaining({ permissionIds: ['manage'] })));
  });
  it('shows role details and all visible permissions without exposing permissions the actor lacks', async () => {
    const keys = ['products.read', 'products.create', 'products.update', 'products.delete', 'categories.read', 'categories.manage', 'media.read', 'orders.read', 'audit.read'];
    keys.forEach((key) => auth.grants.add(key));
    service.getAccessRoles.mockResolvedValue({ data: { data: [{
      id: 'catalog', name: 'Catalog team', slug: 'catalog-team', baseRole: 'admin', isSystem: false,
      permissions: [...keys, 'orders.refund'].map((key) => ({ id: key, key })),
    }] } });
    render(<AccessControlPage />);
    const role = await screen.findByRole('button', { name: 'View role Catalog team' });
    expect(role).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('View audit log')).toBeInTheDocument();
    expect(screen.queryByText('Refund orders')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Find role permissions' }), { target: { value: 'audit' } });
    expect(screen.getByText('View audit log')).toBeInTheDocument();
    expect(screen.queryByText('View products')).not.toBeInTheDocument();
  });

  it('lets users inspect only their current permissions, including after revocation', async () => {
    const { rerender } = render(<AccessControlPage />);
    const view = await screen.findByRole('button', { name: 'View my permissions' });
    await waitFor(() => expect(view).toBeEnabled());
    fireEvent.click(view);
    const viewer = within(screen.getByRole('dialog', { name: 'Your permissions' }));
    expect(viewer.getByText('Manage categories')).toBeInTheDocument();
    expect(viewer.queryByText('Refund orders')).not.toBeInTheDocument();
    auth.grants.delete('categories.manage');
    rerender(<AccessControlPage />);
    expect(viewer.queryByText('Manage categories')).not.toBeInTheDocument();
    expect(viewer.getByText('View categories')).toBeInTheDocument();
  });

  it('filters roles locally and offers a clear route out of an empty search', async () => {
    service.getAccessRoles.mockResolvedValue({ data: { data: [
      { id: 'viewer', name: 'Store viewer', slug: 'store-viewer', baseRole: 'admin', isSystem: false, permissions: [] },
      { id: 'admin', name: 'Admin', slug: 'admin', baseRole: 'admin', isSystem: true, permissions: [] },
    ] } });
    render(<AccessControlPage />);
    await screen.findByRole('heading', { name: 'Store viewer' });
    const calls = service.getAccessRoles.mock.calls.length;
    fireEvent.change(screen.getByRole('textbox', { name: 'Search roles' }), { target: { value: 'missing-role' } });
    expect(screen.getByText('No roles match your filters')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Store viewer' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('heading', { name: 'Store viewer' })).toBeInTheDocument();
    expect(service.getAccessRoles).toHaveBeenCalledTimes(calls);
  });

  const prepareAssignments = async (viewerDelegable = true) => {
    auth.grants.add('users.assign_roles');
    service.getAccessRoles.mockResolvedValue({ data: { data: [
      { id: 'viewer', name: 'Viewer', slug: 'viewer', baseRole: 'admin', isSystem: false, isDelegable: viewerDelegable, permissions: [] },
      { id: 'editor', name: 'Editor', slug: 'editor', baseRole: 'admin', isSystem: false, isDelegable: true, permissions: [{ id: 'manage', key: 'categories.manage' }] },
    ] } });
    service.getAccessUsers.mockResolvedValue({ data: { data: [
      { id: 'manager', email: 'me@example.test', roleId: 'viewer', roleName: 'Viewer', role: 'admin', status: 'active' },
      { id: 'other', email: 'staff@example.test', roleId: 'viewer', roleName: 'Viewer', role: 'admin', status: 'active' },
    ], meta: { total: 2 } } });
    service.updateAccessUserRole.mockResolvedValue({ data: {} });
    service.updateAccessUserStatus.mockResolvedValue({ data: {} });
    const view = render(<AccessControlPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Staff accounts', exact: true }));
    await screen.findByRole('combobox', { name: 'Assigned role for staff@example.test' });
    return view;
  };
  const chooseEditor = () => {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Assigned role for staff@example.test' }));
    fireEvent.click(screen.getByRole('option', { name: 'Editor', exact: true }));
  };

  it('hides a restricted role from assignment choices and preserves its current label', async () => {
    await prepareAssignments(false);
    const assignment = screen.getByRole('combobox', { name: 'Assigned role for staff@example.test' });
    expect(assignment).toHaveTextContent('Viewer');
    fireEvent.mouseDown(assignment);
    expect(screen.getByRole('option', { name: 'Editor', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Viewer/ })).not.toBeInTheDocument();
  });

  it('hides restricted roles when creating staff accounts', async () => {
    await prepareAssignments(false);
    fireEvent.click(screen.getByRole('button', { name: 'Create User', exact: true }));
    fireEvent.mouseDown(within(screen.getByRole('dialog')).getByRole('combobox', { name: 'Assign Role' }));
    expect(screen.getByRole('option', { name: 'Editor', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Viewer/ })).not.toBeInTheDocument();
  });

  it('disables own role changes and requires confirmation for another account', async () => {
    await prepareAssignments();
    expect(screen.getByRole('combobox', { name: 'Assigned role for me@example.test' })).toHaveAttribute('aria-disabled', 'true');
    chooseEditor();
    const confirmation = within(screen.getByRole('dialog', { name: 'Confirm role change' }));
    expect(confirmation.getByText('staff@example.test')).toBeInTheDocument();
    expect(service.updateAccessUserRole).not.toHaveBeenCalled();
    fireEvent.click(confirmation.getByRole('button', { name: 'Confirm change' }));
    await waitFor(() => expect(service.updateAccessUserRole).toHaveBeenCalledWith('other', 'editor'));
  });

  it('closes pending assignment when assignment permission is revoked', async () => {
    const { rerender } = await prepareAssignments();
    chooseEditor();
    expect(screen.getByRole('dialog', { name: 'Confirm role change' })).toBeInTheDocument();
    auth.grants.delete('users.assign_roles');
    rerender(<AccessControlPage />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirm role change' })).not.toBeInTheDocument());
    expect(service.updateAccessUserRole).not.toHaveBeenCalled();
  });

  it('disables assignment if a permission in the target role is revoked before confirmation', async () => {
    const { rerender } = await prepareAssignments();
    chooseEditor();
    auth.grants.delete('categories.manage');
    rerender(<AccessControlPage />);
    const confirmation = within(screen.getByRole('dialog', { name: 'Confirm role change' }));
    expect(confirmation.getByRole('button', { name: 'Confirm change' })).toBeDisabled();
    expect(confirmation.getByText('You can no longer assign this role with your current permissions.')).toBeInTheDocument();
    expect(service.updateAccessUserRole).not.toHaveBeenCalled();
  });

  it('requires a reason and confirms staff suspension before revoking access', async () => {
    await prepareAssignments();
    fireEvent.click(screen.getByRole('button', { name: 'Suspend user staff@example.test' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Suspend staff account' }));
    expect(dialog.getByText(/Active sessions will be signed out/i)).toBeInTheDocument();
    const submit = dialog.getByRole('button', { name: 'Suspend account' });
    expect(submit).toBeDisabled();
    fireEvent.change(dialog.getByRole('textbox', { name: 'Reason for this change' }), { target: { value: 'Security review' } });
    fireEvent.click(submit);
    await waitFor(() => expect(service.updateAccessUserStatus).toHaveBeenCalledWith('other', 'inactive', 'Security review'));
  });

});
