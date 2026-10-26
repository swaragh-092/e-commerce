import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '../../layouts/AdminLayout';

const state = vi.hoisted(() => ({ mode: 'catalog', features: { reviews: true, pages: true } }));

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
  localStorage.setItem('admin_sidebar_favorites', JSON.stringify(['/admin/reviews', '/admin/pages']));
  localStorage.setItem('admin_sidebar_group_order', JSON.stringify(['Sales', 'Content']));
  state.features = { reviews: true, pages: true };
});

describe('Optional sidebar feature visibility', () => {
  it.each([
    ['catalog', 'reviews', 'Reviews'], ['ecommerce', 'reviews', 'Reviews'],
    ['catalog', 'pages', 'Pages'], ['ecommerce', 'pages', 'Pages'],
  ])('updates pinned links in %s mode when %s changes', (mode, feature, label) => {
    state.mode = mode;
    const { rerender } = render(view());
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument();

    state.features = { ...state.features, [feature]: false };
    rerender(view());
    expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();

    state.features = { ...state.features, [feature]: true };
    rerender(view());
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
  });
});
