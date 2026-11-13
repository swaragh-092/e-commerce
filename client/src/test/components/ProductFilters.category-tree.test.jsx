import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductFilters from '../../components/product/ProductFilters';

const state = vi.hoisted(() => ({ settings: { catalog: {} }, categories: [] }));
vi.mock('../../context/CategoryContext', () => ({ useCategories: () => ({ categories: state.categories }) }));
vi.mock('../../hooks/useSettings', () => ({
  useCurrency: () => ({ formatPrice: value => String(value), symbol: '$' }),
  useSettings: () => ({ settings: state.settings }),
  useFeature: name => name === 'showPrice' ? false : false,
  useFeatureVisible: () => false,
}));
vi.mock('../../services/brandService', () => ({ default: { getBrands: vi.fn() } }));
const filters = { category: '', minPrice: '', maxPrice: '' };
const tree = [{ id: 'flowers', name: 'Flowers', slug: 'flowers', children: [{ id: 'marigold', name: 'Marigold', slug: 'marigold', children: [{ id: 'french', name: 'French Marigold', slug: 'french-marigold', children: [] }] }] }];
const renderFilters = props => render(<ProductFilters filters={filters} onFilterChange={vi.fn()} {...props} />);
beforeEach(() => { state.categories = tree; state.settings = { catalog: {} }; });

describe('nested category filter controls', () => {
  it('starts collapsed and opens levels independently without selecting a filter', async () => {
    state.settings = { catalog: { categoryDepth: 3, categoryExpandMode: 'collapsed' } };
    const onFilterChange = vi.fn();
    render(<ProductFilters filters={filters} onFilterChange={onFilterChange} />);
    expect(screen.queryByRole('button', { name: 'Marigold' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand subcategories for Flowers' }));
    expect(await screen.findByRole('button', { name: 'Marigold' })).toBeInTheDocument();
    expect(onFilterChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Expand subcategories for Marigold' }));
    expect(await screen.findByRole('button', { name: 'French Marigold' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marigold' }));
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ category: 'marigold', page: 1 }));
  });

  it('expands the selected path and respects depth and all-level modes', async () => {
    state.settings = { catalog: { categoryDepth: 2, categoryExpandMode: 'selected-path' } };
    const selectedView = renderFilters({ filters: { ...filters, category: 'marigold' } });
    fireEvent.click(screen.getByText('Categories'));
    expect((await screen.findAllByRole('button', { name: 'Marigold', exact: true })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Expand subcategories for Marigold' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'French Marigold' })).not.toBeInTheDocument();
    selectedView.unmount();

    state.settings = { catalog: { categoryDepth: 3, categoryExpandMode: 'all' } };
    const view = renderFilters();
    expect(await screen.findByRole('button', { name: 'French Marigold' })).toBeInTheDocument();
    view.unmount();
  });

  it('uses Category page overrides instead of collection defaults', async () => {
    state.settings = { catalog: { categoryDepth: 5, categoryExpandMode: 'all' }, categoryPage: { categoryDepth: 1, categoryExpandMode: 'collapsed' } };
    renderFilters({ categoryDepth: 1, categoryExpandMode: 'collapsed' });
    expect(screen.queryByRole('button', { name: 'Marigold' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand subcategories for Flowers' })).not.toBeInTheDocument();
  });
});
