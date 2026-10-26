import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '../../layouts/AdminLayout';

const state = vi.hoisted(() => ({ mode: 'catalog', features: { reviews: true } }));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { firstName: 'Admin' }, logout: vi.fn(),
    hasPermission: () => true, hasAnyPermission: () => true, hasRole: () => true,
  }),
}));
vi.mock('../../hooks/useSettings', async (importOriginal) => ({
  ...await importOriginal(),
  useSettings: () => ({ settings: {}, features: state.features, visibility: {} }),
  useMode: () => state.mode,
}));
vi.mock('../../context/UnitCatalogContext', () => ({
  UnitCatalogProvider: ({ children }) => children,
}));

const theme = createTheme();
const view = () => (
  <ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={['/admin/features']}>
      <AdminLayout />
    </MemoryRouter>
  </ThemeProvider>
);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('admin_sidebar_favorites', JSON.stringify(['/admin/reviews']));
  localStorage.setItem('admin_sidebar_group_order', JSON.stringify(['Sales']));
  state.features = { reviews: true };
});

describe('Reviews sidebar feature visibility', () => {
  it.each(['catalog', 'ecommerce'])('updates pinned Reviews when the feature changes in %s mode', (mode) => {
    state.mode = mode;
    const { rerender } = render(view());
    expect(screen.getByRole('link', { name: 'Reviews' })).toBeInTheDocument();

    state.features = { reviews: false };
    rerender(view());
    expect(screen.queryByRole('link', { name: 'Reviews' })).not.toBeInTheDocument();

    state.features = { reviews: true };
    rerender(view());
    expect(screen.getByRole('link', { name: 'Reviews' })).toBeInTheDocument();
  });
});
