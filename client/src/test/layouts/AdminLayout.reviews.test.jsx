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
const view = (initialPath = '/admin/features') => (
  <ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminLayout />
    </MemoryRouter>
  </ThemeProvider>
);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('admin_sidebar_favorites', JSON.stringify(['/admin/reviews', '/admin/pages', '/admin/customers']));
  localStorage.setItem('admin_sidebar_group_order', JSON.stringify(['Sales', 'Content']));
  state.features = { reviews: true, pages: true, customers: true, blogs: true };
});

describe('Optional sidebar feature visibility', () => {
  it('selects only Blog Categories on the categories route while keeping Posts selected on edit routes', async () => {
    localStorage.setItem('admin_sidebar_group_order', JSON.stringify(['Sales', 'Content', 'Blogs']));
    const { unmount } = render(view('/admin/blogs/categories'));
    expect(await screen.findByRole('link', { name: 'Categories' })).toHaveClass('Mui-selected');
    expect(screen.getByRole('link', { name: 'Posts' })).not.toHaveClass('Mui-selected');

    unmount();
    render(view('/admin/blogs/edit/post-1'));
    expect(await screen.findByRole('link', { name: 'Posts' })).toHaveClass('Mui-selected');
    expect(screen.getByRole('link', { name: 'Categories' })).not.toHaveClass('Mui-selected');
  });

  it.each([
    ['catalog', 'reviews', 'Reviews'], ['ecommerce', 'reviews', 'Reviews'],
    ['catalog', 'pages', 'Pages'], ['ecommerce', 'pages', 'Pages'],
    ['catalog', 'customers', 'Customers'], ['ecommerce', 'customers', 'Customers'],
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
