import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { it, expect, vi, afterEach } from 'vitest';
import Guard from '../../components/admin/AdminSessionGuard';

const mocks = vi.hoisted(() => ({ status: vi.fn(), activity: vi.fn(), logout: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' }, logout: mocks.logout }) }));
vi.mock('../../services/adminSessionService', () => ({ getAdminSession: mocks.status, reportAdminActivity: mocks.activity }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

async function start(absolute = 43_200_000) {
  vi.useFakeTimers();
  let idle = Date.now() + 120_000;
  const end = Date.now() + absolute;
  mocks.status.mockImplementation(async () => ({
    userId: 'admin', serverTime: new Date().toISOString(),
    idleExpiresAt: new Date(idle).toISOString(), absoluteExpiresAt: new Date(end).toISOString(),
  }));
  mocks.activity.mockImplementation(async () => { idle = Date.now() + 1_800_000; });
  await act(async () => {
    render(<MemoryRouter initialEntries={['/admin']}><Routes>
      <Route path="/admin" element={<Guard />} />
      <Route path="/admin/login" element={<h1>Admin sign-in</h1>} />
    </Routes></MemoryRouter>);
  });
}

it('extends the idle session only after the user clicks Stay signed in', async () => {
  await start();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' })));
  await act(async () => vi.advanceTimersByTimeAsync(120_000));
  expect(mocks.activity).toHaveBeenCalledTimes(1);
  expect(mocks.logout).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it.each([43_200_000, 120_000])('signs out on expiry and redirects to admin login', async absolute => {
  await start(absolute);
  expect(Boolean(screen.queryByRole('button', { name: 'Stay signed in' }))).toBe(absolute > 120_000);
  await act(async () => vi.advanceTimersByTimeAsync(120_000));
  expect(mocks.logout).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('heading', { name: 'Admin sign-in' })).toBeInTheDocument();
});
