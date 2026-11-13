import React, { useState } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import AdminSessionGuard from '../../components/admin/AdminSessionGuard';
import { lockAdminSession, unlockAdminSession } from '../../services/adminSessionLock';

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  reportAdminActivity: vi.fn(),
  reauthenticateAdmin: vi.fn(),
  verifyTwoFactor: vi.fn(),
  finalizeAuthenticatedSession: vi.fn(),
  verifyEmailMfaCode: vi.fn(),
  sendEmailMfaCode: vi.fn(),
}));
vi.mock('../../services/adminSessionService', () => ({
  getAdminSession: mocks.getAdminSession,
  reportAdminActivity: mocks.reportAdminActivity,
  reauthenticateAdmin: mocks.reauthenticateAdmin,
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({
  user: { id: 'admin-a', email: 'admin@example.test' },
  verifyTwoFactor: mocks.verifyTwoFactor,
  finalizeAuthenticatedSession: mocks.finalizeAuthenticatedSession,
}) }));
vi.mock('../../services/authService', () => ({ default: {
  verifyTwoFactor: mocks.verifyTwoFactor,
  verifyEmailMfaCode: mocks.verifyEmailMfaCode,
  sendEmailMfaCode: mocks.sendEmailMfaCode,
} }));

let channels;
class TestBroadcastChannel {
  constructor(name) { this.name = name; this.onmessage = null; channels.push(this); }
  postMessage(data) { channels.filter(channel => channel !== this && channel.name === this.name).forEach(channel => channel.onmessage?.({ data })); }
  close() { this.closed = true; }
}

const startedAt = new Date(Date.now() - 60_000).toISOString();
const session = (overrides = {}) => ({
  userId: 'admin-a', startedAt,
  serverTime: new Date().toISOString(), absoluteExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  idleExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), reauthContext: 'signed-context',
  ...overrides,
});
function Fixture() {
  const [value, setValue] = useState('unsaved value');
  return <><input aria-label="Unsaved field" value={value} onChange={e => setValue(e.target.value)} /><AdminSessionGuard /></>;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  channels = [];
  vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
  mocks.getAdminSession.mockReset().mockResolvedValue(session());
  mocks.reportAdminActivity.mockReset().mockResolvedValue({});
  mocks.reauthenticateAdmin.mockReset();
  mocks.verifyTwoFactor.mockReset();
  mocks.verifyEmailMfaCode.mockReset();
  mocks.sendEmailMfaCode.mockReset();
  mocks.finalizeAuthenticatedSession.mockReset().mockResolvedValue({ id: 'admin-a' });
  unlockAdminSession();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); unlockAdminSession(); });

describe('AdminSessionGuard', () => {
  it('warns at two minutes and preserves mounted unsaved input', async () => {
    mocks.getAdminSession.mockResolvedValue(session({ absoluteExpiresAt: new Date(Date.now() + 90_000).toISOString(), idleExpiresAt: new Date(Date.now() + 90_000).toISOString() }));
    render(<Fixture />);
    await screen.findByText(/session is about to expire/i);
    fireEvent.change(screen.getByLabelText('Unsaved field'), { target: { value: 'still unsaved' } });
    expect(screen.getByLabelText('Unsaved field')).toHaveValue('still unsaved');
  });

  it('locks at the server deadline, preserves the child form, and verifies cross-tab unlock on the server', async () => {
    const expiredStatus = session({ absoluteExpiresAt: new Date(Date.now() + 5_000).toISOString(), idleExpiresAt: new Date(Date.now() + 5_000).toISOString() });
    mocks.getAdminSession.mockResolvedValue(expiredStatus);
    render(<Fixture />);
    const field = await screen.findByLabelText('Unsaved field');
    fireEvent.change(field, { target: { value: 'do not lose' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_500); });
    expect(await screen.findByText(/admin session locked/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Unsaved field')).toHaveValue('do not lose');
    const beforeInvalidUnlock = mocks.getAdminSession.mock.calls.length;
    mocks.getAdminSession.mockRejectedValueOnce({ response: { status: 401, data: { error: { code: 'ADMIN_SESSION_EXPIRED' } } } });
    await act(async () => {
      channels.find(channel => channel.onmessage)?.onmessage({ data: { type: 'unlock' } });
      await Promise.resolve(); await Promise.resolve();
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(mocks.getAdminSession).toHaveBeenCalledTimes(beforeInvalidUnlock + 1);
    expect(screen.getByText(/admin session locked/i)).toBeInTheDocument();

    const beforeValidUnlock = mocks.getAdminSession.mock.calls.length;
    mocks.getAdminSession.mockResolvedValueOnce(session({ startedAt: new Date().toISOString() }));
    await act(async () => {
      channels.find(channel => channel.onmessage)?.onmessage({ data: { type: 'unlock' } });
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });
    expect(mocks.getAdminSession).toHaveBeenCalledTimes(beforeValidUnlock + 1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Unsaved field')).toHaveValue('do not lose');
  });

  it('reauthenticates through the signed same-user context and keeps the mounted form', async () => {
    render(<Fixture />);
    const field = await screen.findByLabelText('Unsaved field');
    fireEvent.change(field, { target: { value: 'preserved draft' } });
    await act(async () => { window.dispatchEvent(new Event('admin-session:expired')); });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } });
    mocks.reauthenticateAdmin.mockResolvedValueOnce({ user: { id: 'admin-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(mocks.reauthenticateAdmin).toHaveBeenCalledWith('admin@example.test', 'correct-password', 'signed-context'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Unsaved field')).toHaveValue('preserved draft');
  });

  it('explains remembered devices without bypassing password or MFA', async () => {
    mocks.getAdminSession.mockResolvedValue(session({ knownDevice: true }));
    render(<Fixture />);
    await screen.findByLabelText('Unsaved field');
    await act(async () => { window.dispatchEvent(new Event('admin-session:expired')); });
    expect(await screen.findByText('This device is remembered; password and required MFA are still needed.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(mocks.verifyTwoFactor).not.toHaveBeenCalled();
  });

  it('completes authenticator MFA by verifying status, briefly releasing the gate for context hydration', async () => {
    const api = (await import('../../services/api')).default;
    const apiAdapter = vi.fn(async config => ({
      data: { data: { id: 'admin-a' } }, status: 200, headers: {}, config,
    }));
    api.defaults.adapter = apiAdapter;
    mocks.verifyTwoFactor.mockResolvedValueOnce({ user: { id: 'admin-a' } });
    mocks.finalizeAuthenticatedSession.mockImplementationOnce(async () => (await api.get('/users/me')).data.data);
    render(<Fixture />);
    await screen.findByLabelText('Unsaved field');
    await act(async () => { window.dispatchEvent(new Event('admin-session:expired')); });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    mocks.reauthenticateAdmin.mockResolvedValueOnce({ requiresTwoFactor: true, tempToken: 'temporary', emailChallenge: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await screen.findByLabelText('Verification code');
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(mocks.verifyTwoFactor).toHaveBeenCalledWith('temporary', '123456'));
    await waitFor(() => expect(apiAdapter).toHaveBeenCalledWith(expect.objectContaining({ url: '/users/me' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
