import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../../routes/ProtectedRoute';

const session = vi.hoisted(() => ({ loading: true, authenticated: false, allowed: false }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({
  loading: session.loading, isAuthenticated: session.authenticated,
  hasPermission: () => session.allowed, hasRole: () => false,
}) }));
const view = () => <MemoryRouter initialEntries={['/admin/settings']}><Routes>
  <Route element={<ProtectedRoute permission="settings.read" />}>
    <Route path="/admin/settings" element={<h1>General settings</h1>} />
  </Route>
  <Route path="/admin/login" element={<h1>Admin login</h1>} />
  <Route path="/" element={<h1>Store home</h1>} />
</Routes></MemoryRouter>;

beforeEach(() => { session.loading = true; session.authenticated = false; session.allowed = false; });
describe('direct settings navigation during session restoration', () => {
  it('waits for verification then opens settings without changing hook order', () => {
    const { rerender } = render(view());
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    session.loading = false; session.authenticated = true; session.allowed = true;
    rerender(view());
    expect(screen.getByRole('heading', { name: 'General settings' })).toBeInTheDocument();
  });
  it('continues denying a verified account without settings access', () => {
    const { rerender } = render(view());
    session.loading = false; session.authenticated = true;
    rerender(view());
    expect(screen.getByRole('heading', { name: 'Store home' })).toBeInTheDocument();
  });
  it('sends an unauthenticated direct visit to the admin login', () => {
    const { rerender } = render(view());
    session.loading = false;
    rerender(view());
    expect(screen.getByRole('heading', { name: 'Admin login' })).toBeInTheDocument();
  });
});
