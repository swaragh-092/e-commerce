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
  mocks.finalizeAuthenticatedSession.mockReset();
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
    mocks.getAdminSession.mockResolvedValueOnce(session());
    await act(async () => {
      channels.find(channel => channel.onmessage)?.onmessage({ data: { type: 'unlock' } });
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });
    expect(mocks.getAdminSession).toHaveBeenCalledTimes(beforeValidUnlock + 1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Unsaved field')).toHaveValue('do not lose');
  });
});
