import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MfaSecurityPanel from '../../../components/admin/settings/MfaSecurityPanel';
import authService from '../../../services/authService';

vi.mock('../../../services/authService', () => ({
  default: {
    getMfaPolicy: vi.fn(),
    updateMfaPolicy: vi.fn(),
  },
}));

vi.mock('../../../components/storefront/TwoFactorSetup', () => ({
  default: ({ onUpdate }) => <button onClick={onUpdate}>Finish setup</button>,
}));
const payload = (overrides = {}) => ({
  policy: { requireAdministrators: false, staffMode: 'optional', requiredRoleIds: [], ...overrides.policy },
  roles: [{ id: 'role-support', name: 'Support', slug: 'support' }, { id: 'role-ops', name: 'Operations', slug: 'operations' }],
  canManage: true,
  mfaEnabled: true,
  source: 'settings',
  ...overrides,
});

const choose = async (label, option) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
};

const openSave = () => fireEvent.click(screen.getByRole('button', { name: 'Save MFA policy' }));
const enterVerification = () => {
  openSave();
  fireEvent.change(screen.getByLabelText(/Current password/), { target: { value: 'correct horse' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Authenticator code' }), { target: { value: '123456' } });
};

beforeEach(() => {
  vi.clearAllMocks();
  authService.getMfaPolicy.mockResolvedValue(payload());
  authService.updateMfaPolicy.mockImplementation(async ({ policy }) => payload({ policy }));
});

describe('MfaSecurityPanel', () => {
  it('loads the policy, saves the selected staff roles separately with verification, and clears secrets', async () => {
    render(<MfaSecurityPanel />);
    await screen.findByText('MFA security policy');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Require MFA for administrators' }));
    await choose('Staff MFA requirement', 'Require for selected staff roles');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Support (support)' }));
    enterVerification();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }));

    await waitFor(() => expect(authService.updateMfaPolicy).toHaveBeenCalledWith({
      policy: { requireAdministrators: true, staffMode: 'selected', requiredRoleIds: ['role-support'] },
      verification: { currentPassword: 'correct horse', code: '123456' },
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('MFA policy saved.');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('removes deselected role IDs and omits TOTP when the managing account is not enrolled', async () => {
    authService.getMfaPolicy.mockResolvedValue(payload({
      policy: { requireAdministrators: true, staffMode: 'selected', requiredRoleIds: ['role-support', 'role-ops'] },
      mfaEnabled: false,
    }));
    render(<MfaSecurityPanel />);
    await screen.findByText('MFA security policy');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Operations (operations)' }));
    openSave();
    fireEvent.change(screen.getByLabelText(/Current password/), { target: { value: 'correct horse' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }));

    await waitFor(() => expect(authService.updateMfaPolicy).toHaveBeenCalledWith({
      policy: { requireAdministrators: true, staffMode: 'selected', requiredRoleIds: ['role-support'] },
      verification: { currentPassword: 'correct horse' },
    }));
    expect(screen.queryByLabelText('Authenticator code')).not.toBeInTheDocument();
  });

  it('prevents enabling email codes before authenticator setup and links to setup', async () => {
    authService.getMfaPolicy.mockResolvedValue(payload({ mfaEnabled: false }));
    render(<MfaSecurityPanel />);
    await screen.findByText('MFA security policy');
    expect(screen.getByRole('checkbox', { name: 'Allow email codes after password sign-in' })).toBeDisabled();
    expect(screen.getByText('Set up your authenticator to enable email codes.')).toBeInTheDocument();
    expect(authService.updateMfaPolicy).not.toHaveBeenCalled();
  });

  it('lets an unenrolled manager turn off an existing email-code policy instead of submitting an invalid save', async () => {
    authService.getMfaPolicy.mockResolvedValue(payload({ mfaEnabled: false, policy: { allowEmailCodes: true, staffMode: 'optional', requiredRoleIds: [] } }));
    render(<MfaSecurityPanel />);
    await screen.findByText('MFA security policy');
    expect(screen.getByRole('button', { name: 'Save MFA policy' })).toBeDisabled();
    const emailOption = screen.getByRole('checkbox', { name: 'Allow email codes after password sign-in' });
    expect(emailOption).not.toBeDisabled();
    fireEvent.click(emailOption);
    expect(screen.getByRole('button', { name: 'Save MFA policy' })).toBeEnabled();
  });

  it('refreshes setup readiness without discarding the policy draft', async () => {
    authService.getMfaPolicy.mockResolvedValueOnce(payload({ mfaEnabled: false })).mockResolvedValueOnce(payload({ mfaEnabled: true }));
    render(<MfaSecurityPanel />);
    await screen.findByText('MFA security policy');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Require MFA for administrators' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Set up authenticator' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Allow email codes after password sign-in' })).toBeEnabled());
    expect(screen.getByRole('checkbox', { name: 'Require MFA for administrators' })).toBeChecked();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('shows a read-only policy to users who cannot manage it', async () => {
    authService.getMfaPolicy.mockResolvedValue(payload({
      canManage: false,
      policy: { requireAdministrators: true, staffMode: 'all', requiredRoleIds: [] },
    }));
    render(<MfaSecurityPanel />);
    await screen.findByText('MFA security policy');
    expect(screen.getByText(/only a super administrator can change it/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Require MFA for administrators' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Staff MFA requirement' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: 'Save MFA policy' })).not.toBeInTheDocument();
    expect(authService.updateMfaPolicy).not.toHaveBeenCalled();
  });

  it('clears password and TOTP after a failed save and shows the server error', async () => {
    authService.updateMfaPolicy.mockRejectedValueOnce({ response: { data: { error: { message: 'Password verification failed.' } } } });
    render(<MfaSecurityPanel />);
    await screen.findByText('MFA security policy');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Require MFA for administrators' }));
    enterVerification();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Password verification failed.');
    expect(screen.getByLabelText(/Current password/)).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Authenticator code' })).toHaveValue('');
  });

  it('offers a retry after load failure', async () => {
    authService.getMfaPolicy.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(payload());
    render(<MfaSecurityPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load MFA policy.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('MFA security policy')).toBeInTheDocument();
    expect(authService.getMfaPolicy).toHaveBeenCalledTimes(2);
  });

  it('warns before enforcement and prevents saving an empty selected-role policy', async () => {
    render(<MfaSecurityPanel />);
    await screen.findByText('MFA security policy');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Require MFA for administrators' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/every affected active administrator and staff member has enrolled/i);
    await choose('Staff MFA requirement', 'Require for selected staff roles');
    expect(screen.getByRole('button', { name: 'Save MFA policy' })).toBeDisabled();
    expect(within(screen.getByRole('group', { name: 'Staff roles requiring MFA' })).getAllByRole('checkbox')).toHaveLength(2);
  });
});
