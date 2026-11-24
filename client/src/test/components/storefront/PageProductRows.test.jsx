import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getProducts } from '../../../services/productService';
import { SettingsContext } from '../../../context/ThemeContext';
import PageProductRows, { RoutedProductRows } from '../../../components/storefront/sections/PageProductRows';

vi.mock('../../../services/productService', () => ({ getProducts: vi.fn() }));

describe('page product rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProducts.mockResolvedValue({ data: [] });
  });

  it('shows a fallback for an empty product row in Designer', async () => {
    render(<SettingsContext.Provider value={{ settings: {} }}>
      <MemoryRouter><PageProductRows designerPreview rows={[{ id: 'empty', type: 'product-row', title: 'Seasonal picks' }]} /></MemoryRouter>
    </SettingsContext.Provider>);
    expect(await screen.findByText('No products match this section. Check the product source and catalog.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Seasonal picks' })).toBeInTheDocument();
  });

  it.each([
    ['product', 'productPage', 'productSlugs', '/products', 'slug'],
    ['category', 'categoryPage', 'categorySlugs', '/category', 'categorySlug'],
  ].flatMap(([page, group, assignmentKey, prefix, param]) => [
    [page, group, assignmentKey, prefix, param, 'seeds', 'Care FAQ', 'Default FAQ'],
    [page, group, assignmentKey, prefix, param, 'watering-can', 'Default FAQ', 'Care FAQ'],
  ]))('renders the correct %s layout for %s assignment', (page, group, assignmentKey, prefix, param, slug, heading, otherHeading) => {
    const faq = (title) => ({
      id: 'faq', type: 'faq', title, items: [{ title: 'How do I use it?', text: 'Follow the instructions.' }],
    });
    const pageSettings = {
      productRows: [faq('Default FAQ')],
      alternateTemplates: [{
        id: 'seeds-template', name: 'Seeds', [assignmentKey]: ['seeds'],
        settings: { productRows: [faq('Care FAQ')] },
      }],
    };
    render(
      <SettingsContext.Provider value={{ settings: { [group]: pageSettings } }}>
        <MemoryRouter initialEntries={[`${prefix}/${slug}`]}>
          <Routes>
            <Route path={`${prefix}/:${param}`} element={<RoutedProductRows page={page}><h1>Product Information</h1></RoutedProductRows>} />
          </Routes>
        </MemoryRouter>
      </SettingsContext.Provider>,
    );
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: otherHeading })).not.toBeInTheDocument();
  });

  it('renders enabled content sections around the main product content in saved order', () => {
    const rows = [
      { id: 'shipping', type: 'faq', title: 'Shipping', pagePosition: 'below',
        items: [{ title: 'When does it ship?', text: 'Within two business days.' }] },
      { id: 'ordering', type: 'faq', title: 'Ordering', pagePosition: 'above',
        items: [{ title: 'Can I order online?', text: 'Yes.' }] },
      { id: 'hidden', type: 'faq', title: 'Hidden FAQ', enabled: false,
        items: [{ title: 'Hidden question', text: 'Hidden answer' }] },
      { id: 'returns', type: 'faq', title: 'Returns', pagePosition: 'below',
        items: [{ title: 'Can I return it?', text: 'Yes.' }] },
    ];
    render(
      <SettingsContext.Provider value={{ settings: { productPage: { productRows: rows } } }}>
        <MemoryRouter>
          <RoutedProductRows page="product"><h1>Product Information</h1></RoutedProductRows>
        </MemoryRouter>
      </SettingsContext.Provider>,
    );

    expect(screen.getAllByRole('heading').map(({ textContent }) => textContent)).toEqual([
      'Ordering', 'Can I order online?', 'Product Information',
      'Shipping', 'When does it ship?', 'Returns', 'Can I return it?',
    ]);
    expect(screen.queryByText('Hidden question')).not.toBeInTheDocument();
  });

  it.each([
    ['collection', 'catalog'], ['brand', 'brandsPage'], ['blog', 'blogPage'],
    ['account', 'accountPage'], ['orders', 'ordersPage'], ['wishlist', 'wishlistPage'],
    ['cart', 'cartPage'], ['search', 'searchPage'], ['not-found', 'notFoundPage'],
  ])('renders custom sections around the built-in %s content', (page, group) => {
    const productRows = [
      { id: 'intro', type: 'composed-hero', pagePosition: 'above', heroBlocks: [{ id: 'copy', type: 'heading', text: 'Custom introduction' }] },
      { id: 'help', type: 'faq', pagePosition: 'below', title: 'Page help', items: [{ title: 'How does it work?', text: 'Read the instructions.' }] },
    ];
    render(<SettingsContext.Provider value={{ settings: { [group]: { productRows } } }}>
      <MemoryRouter><RoutedProductRows page={page}><h1>Built-in content</h1></RoutedProductRows></MemoryRouter>
    </SettingsContext.Provider>);
    const main = screen.getByRole('heading', { name: 'Built-in content' });
    expect(screen.getByText('Custom introduction').compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main.compareDocumentPosition(screen.getByRole('heading', { name: 'Page help' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ['featured', '/products?featured=true', { featured: true }],
    ['sale', '/products?onSale=true', { sale: true }],
  ])('preserves %s in the row request and View All link', async (source, href, filter) => {
    render(<MemoryRouter><PageProductRows rows={[{ id: 'row', type: 'product-row', source }]} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'View All' })).toHaveAttribute('href', href);
    await waitFor(() => expect(getProducts).toHaveBeenCalledWith(expect.objectContaining(filter)));
  });

  it('sends the category filter for Trending and keeps storewide rows unfiltered', async () => {
    render(<MemoryRouter><PageProductRows category="shoes" rows={[
      { id: 'scoped', type: 'product-row', source: 'trending' },
      { id: 'storewide', type: 'product-row', source: 'trending', productScope: 'store' },
    ]} /></MemoryRouter>);

    await waitFor(() => expect(getProducts).toHaveBeenCalledTimes(2));
    expect(getProducts.mock.calls.map(([params]) => params.category)).toEqual(['shoes', undefined]);
  });

  it('preserves the saved query while applying page scope and published status', async () => {
    render(<MemoryRouter><PageProductRows category="fruit" rows={[{
      id: 'featured', type: 'product-row', source: 'featured', count: 4,
      query: { category: 'vegetables', sort: 'newest', limit: 30 },
    }]} /></MemoryRouter>);

    await waitFor(() => expect(getProducts).toHaveBeenCalledWith({
      featured: true, category: 'fruit', sort: 'newest', limit: 4, status: 'published',
    }));
  });

  it('uses separate category filters for two featured rows and their catalog links', async () => {
    render(<MemoryRouter><PageProductRows rows={['fruit', 'vegetables'].map((category) => ({
      id: category, type: 'product-row', source: 'featured', count: 4,
      query: { category, sort: 'newest' },
    }))} /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: 'View All' }).map((link) => link.getAttribute('href'))).toEqual([
      '/products?featured=true&category=fruit', '/products?featured=true&category=vegetables',
    ]);
    await waitFor(() => expect(getProducts.mock.calls.map(([params]) => params)).toEqual([
      { featured: true, category: 'fruit', sort: 'newest', limit: 4, status: 'published' },
      { featured: true, category: 'vegetables', sort: 'newest', limit: 4, status: 'published' },
    ]));
  });

  it('requests the configured most-viewed products with the discovery ranking', async () => {
    render(<MemoryRouter><PageProductRows rows={[{
      id: 'trending',
      type: 'product-row',
      source: 'mostViewed',
      count: 8,
      enabled: true,
    }]} /></MemoryRouter>);

    await waitFor(() => expect(getProducts).toHaveBeenCalledWith({
      sort: 'most-viewed',
      discoveryRow: true,
      limit: 8,
      status: 'published',
    }));
  });
});
