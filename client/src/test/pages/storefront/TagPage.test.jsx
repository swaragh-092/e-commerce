import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TagPage from '../../../pages/storefront/TagPage';
import { getPublicTag } from '../../../services/tagService';
import { getProducts } from '../../../services/productService';
const settings = vi.hoisted(() => ({ catalog: { showFilters: false }, seo: { canonicalBaseUrl: 'https://shop.example.test' } }));
vi.mock('../../../services/tagService', () => ({ getPublicTag: vi.fn() }));
vi.mock('../../../services/productService', () => ({ getProducts: vi.fn() }));
vi.mock('../../../services/categoryService', () => ({ getCategoryTree: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../../components/common/PageSEO', () => ({ default: ({ title, description, url, type, structuredData }) => <div data-testid="seo" data-title={title} data-description={description} data-url={url} data-type={type} data-schemas={JSON.stringify(structuredData)} /> }));
vi.mock('../../../components/product/ProductGrid', () => ({ default: ({ hasActiveFilters, onClearFilters }) => <button onClick={onClearFilters}>Clear filters {String(hasActiveFilters)}</button> }));
vi.mock('../../../components/product/ProductFilters', () => ({ default: () => null }));
vi.mock('../../../components/layout/StorefrontSidebarMenu', () => ({ default: () => null }));
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => ({ settings }), useFeature: () => true, useFeatureVisible: () => true }));
const tag = { id: 'tag-1', name: 'Summer Planting', slug: 'summer-planting', description: 'Products for warm weather.' };
const mount = (url = '/tags/summer-planting') => render(<MemoryRouter initialEntries={[url]}><Link to="/tags/spring">Spring tag</Link><Routes><Route path="/tags/:slug" element={<TagPage />} /></Routes></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks(); settings.seo.canonicalBaseUrl = 'https://shop.example.test';
  getPublicTag.mockResolvedValue({ data: tag });
  getProducts.mockResolvedValue({ data: [], meta: { page: 1, totalPages: 3 } });
});

describe('storefront tag landing pages', () => {
  it('shows a readable title and description with canonical collection metadata', async () => {
    mount();
    expect(await screen.findByRole('heading', { level: 1, name: 'Summer Planting' })).toBeInTheDocument();
    expect(screen.getByText('Products for warm weather.')).toBeInTheDocument();
    const seo = screen.getByTestId('seo');
    expect(seo).toHaveAttribute('data-title', 'Summer Planting');
    expect(seo).toHaveAttribute('data-url', 'https://shop.example.test/tags/summer-planting');
    expect(JSON.parse(seo.dataset.schemas)[0]['@type']).toBe('CollectionPage');
    await waitFor(() => expect(getProducts).toHaveBeenCalledWith(expect.objectContaining({ tags: 'summer-planting' })));
  });
  it('pins the path tag when filters are cleared or a conflicting query tag is supplied', async () => {
    mount('/tags/summer-planting?tags=wrong-tag&search=tomato');
    fireEvent.click(await screen.findByRole('button', { name: 'Clear filters true' }));
    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ tags: 'summer-planting', search: '' })));
    expect(screen.getByRole('button', { name: 'Clear filters false' })).toBeInTheDocument();
  });
  it('keeps the tag across pagination and sorting', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Go to page 2' }));
    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ tags: 'summer-planting', page: 2 })));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sort products' }));
    fireEvent.click(screen.getByRole('option', { name: 'Name: A to Z' }));
    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ tags: 'summer-planting', page: 1, sort: 'name_asc' })));
  });
  it('shows noindex and a catalog link for an unavailable tag without fetching products', async () => {
    getPublicTag.mockRejectedValue({ response: { status: 404 } }); mount();
    expect(await screen.findByRole('heading', { name: 'Tag not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse products' })).toHaveAttribute('href', '/products');
    expect(screen.getByTestId('seo')).toHaveAttribute('data-type', 'noindex');
    expect(getProducts).not.toHaveBeenCalled();
  });
  it('lets customers retry transient metadata failures', async () => {
    getPublicTag.mockRejectedValueOnce(new Error('Connection unavailable')); mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Summer Planting' })).toBeInTheDocument();
  });
  it('does not display a stale tag while a new tag is loading', async () => {
    let finish;
    getPublicTag.mockResolvedValueOnce({ data: tag }).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    mount(); await screen.findByRole('heading', { name: 'Summer Planting' });
    fireEvent.click(screen.getByRole('link', { name: 'Spring tag' }));
    expect(await screen.findByRole('status', { name: 'Loading tag' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Summer Planting' })).not.toBeInTheDocument();
    finish({ data: { ...tag, slug: 'spring', name: 'Spring' } });
    expect(await screen.findByRole('heading', { name: 'Spring' })).toBeInTheDocument();
    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ tags: 'spring' })));
  });
  it('falls back to the browser origin when canonical configuration is invalid', async () => {
    settings.seo.canonicalBaseUrl = 'invalid url'; mount();
    await screen.findByRole('heading', { name: 'Summer Planting' });
    expect(screen.getByTestId('seo')).toHaveAttribute('data-url', `${window.location.origin}/tags/summer-planting`);
  });
});
