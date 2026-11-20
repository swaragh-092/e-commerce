import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BrandsPage from '../../../pages/admin/BrandsPage';
const state = vi.hoisted(() => ({ seoEnabled: true, notify: vi.fn(), refreshBrands: vi.fn(), service: { getBrands: vi.fn(), createBrand: vi.fn(), updateBrand: vi.fn() } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../hooks/useSettings', () => ({ useFeature: () => state.seoEnabled }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify: state.notify }) }));
vi.mock('../../../context/BrandContext', () => ({ useBrands: () => ({ refreshBrands: state.refreshBrands }) }));
vi.mock('../../../services/brandService', () => ({ default: state.service }));
vi.mock('../../../components/common/MediaPicker', () => ({ default: () => null }));
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns }) => <div>{rows.map(row => <div key={row.id}>{columns.find(column => column.field === 'name').renderCell({ row, value: row.name })}</div>)}</div>,
  GridActionsCellItem: () => null,
}));
const brand = { id: 'brand-1', name: 'Garden Brand', slug: 'garden', isActive: true, metaTitle: 'Custom Brand', metaDescription: 'Brand description', metaKeywords: 'seeds', ogImage: '/share.png' };
beforeEach(() => {
  vi.clearAllMocks();
  state.seoEnabled = true;
  state.service.getBrands.mockResolvedValue({ data: { data: [brand], meta: { total: 1 } } });
  state.service.createBrand.mockResolvedValue({});
  state.service.updateBrand.mockResolvedValue({});
});
describe('Brand SEO editor', () => {
  it('creates a brand with customized SEO', async () => {
    render(<BrandsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Brand' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Brand Name/ }), { target: { value: 'New Brand' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Meta title' }), { target: { value: 'Find New Brand Seeds' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Meta description' }), { target: { value: 'Discover new seeds' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Brand' }));
    await waitFor(() => expect(state.service.createBrand).toHaveBeenCalledWith(expect.objectContaining({ metaTitle: 'Find New Brand Seeds', metaDescription: 'Discover new seeds' })));
  });
  it('loads existing SEO and allows clearing overrides', async () => {
    render(<BrandsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit brand Garden Brand' }));
    expect(screen.getByRole('textbox', { name: 'Meta title' })).toHaveValue('Custom Brand');
    fireEvent.change(screen.getByRole('textbox', { name: 'Meta title' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use default image' }));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(state.service.updateBrand).toHaveBeenCalledWith('brand-1', expect.objectContaining({ metaTitle: '', ogImage: '', metaDescription: 'Brand description' })));
  });
  it('preserves existing overrides when SEO is disabled', async () => {
    state.seoEnabled = false;
    render(<BrandsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit brand Garden Brand' }));
    expect(screen.queryByRole('textbox', { name: 'Meta title' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(state.service.updateBrand).toHaveBeenCalled());
    expect(state.service.updateBrand.mock.calls[0][1]).not.toHaveProperty('metaTitle');
  });
});
