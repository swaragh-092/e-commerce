import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductsManagePage from '../../../pages/admin/ProductsManagePage';
import { bulkUpdateProducts, getProducts, updateProduct } from '../../../services/productService';
import { getCategoryTree } from '../../../services/categoryService';
import { getSaleLabels } from '../../../services/adminService';

const { notifyMock, settingsMock, disabledFeatures, hiddenPresentation } = vi.hoisted(() => ({
  notifyMock: vi.fn(),
  settingsMock: { sales: { allowBulkSales: false }, catalog: { lowStockThreshold: 10 } },
  disabledFeatures: new Set(),
  hiddenPresentation: new Set(),
}));

vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns, onRowSelectionModelChange }) => (
    <div>
      {rows.map((row) => (
        <div key={row.id} role="row">
          {columns.map((column) => (
            <div key={column.field}>
              {column.renderCell ? column.renderCell({ row }) : row[column.field]}
            </div>
          ))}
        </div>
      ))}
      <button onClick={() => onRowSelectionModelChange(rows.map((row) => row.id))}>
        Select visible products
      </button>
    </div>
  ),
}));

vi.mock('../../../services/productService', () => ({
  getProducts: vi.fn(),
  deleteProduct: vi.fn(),
  updateProduct: vi.fn(),
  bulkUpdateSale: vi.fn(),
  bulkDeleteProducts: vi.fn(),
  bulkUpdateProducts: vi.fn(),
  getStockHistory: vi.fn(),
}));

vi.mock('../../../services/categoryService', () => ({ getCategoryTree: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../../services/adminService', () => ({ getSaleLabels: vi.fn().mockResolvedValue({ data: { data: [] } }) }));
vi.mock('../../../hooks/useSettings', () => ({
  useCurrency: () => ({ symbol: '₹', formatPrice: (amount) => `₹${amount}` }),
  useSettings: () => ({ settings: settingsMock }),
  useFeature: (name) => !disabledFeatures.has(name),
  useFeatureVisible: (name) => !disabledFeatures.has(name) && !hiddenPresentation.has(name),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify: notifyMock }) }));

const product = {
  id: 'product-1',
  name: 'Test product',
  slug: 'test-product',
  sku: 'TEST-1',
  price: 100,
  quantity: 5,
  status: 'published',
  isEnabled: true,
  salePrice: null,
  variants: [],
};

const renderProductsPage = (initialEntries = ['/admin/products']) => render(
  <ThemeProvider theme={createTheme()}>
    <MemoryRouter initialEntries={initialEntries}>
      <ProductsManagePage />
    </MemoryRouter>
  </ThemeProvider>
);

const openSelect = async (select) => {
  fireEvent.mouseDown(select);
};

describe('ProductsManagePage storefront state controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    disabledFeatures.clear();
    hiddenPresentation.clear();
    vi.unstubAllGlobals();
    settingsMock.catalog.lowStockThreshold = 10;
    getCategoryTree.mockResolvedValue({ data: [] });
    getSaleLabels.mockResolvedValue({ data: { data: [] } });
    getProducts.mockResolvedValue({
      data: [product],
      meta: { total: 1 },
      counts: { published: 1, paused: 0, draft: 0, archived: 0 },
    });
    updateProduct.mockResolvedValue({ data: product });
    bulkUpdateProducts.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens the product editor when the MRP is clicked', async () => {
    renderProductsPage();

    const pricingLink = await screen.findByRole('link', { name: 'Edit pricing and tax for Test product' });
    expect(pricingLink).toHaveAttribute('href', '/admin/products/product-1/edit');
  });

  it('opens the product editor when the product name is clicked', async () => {
    renderProductsPage();

    const productLink = await screen.findByRole('link', { name: 'Edit Test product' });
    expect(productLink).toHaveAttribute('href', '/admin/products/product-1/edit');
  });

  it('uses one row control and persists Paused as published plus disabled', async () => {
    renderProductsPage();

    const productRow = await screen.findByRole('row');
    const stateSelect = within(productRow).getByRole('combobox', { name: 'Storefront state for Test product' });
    expect(within(productRow).getAllByRole('combobox')).toHaveLength(1);
    expect(within(productRow).queryByRole('switch')).not.toBeInTheDocument();

    await openSelect(stateSelect);
    fireEvent.click(await screen.findByRole('option', { name: 'Paused' }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('product-1', {
      status: 'published',
      isEnabled: false,
    }));
  });

  it('saves the selected storefront state from Quick Edit', async () => {
    renderProductsPage();

    await screen.findByText('Test product');
    fireEvent.click(screen.getByTestId('EditNoteIcon').closest('button'));

    const dialog = await screen.findByRole('dialog');
    const stateSelect = within(dialog).getByRole('combobox', { name: 'Storefront state' });
    await openSelect(stateSelect);
    fireEvent.click(await screen.findByRole('option', { name: 'Archived' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('product-1', expect.objectContaining({
      status: 'archived',
      isEnabled: false,
    })));
  });

  it('does not overwrite hidden prices or sale data in catalog quick edit', async () => {
    disabledFeatures.add('pricing');
    renderProductsPage();
    await screen.findByText('Test product');
    fireEvent.click(screen.getByTestId('EditNoteIcon').closest('button'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('spinbutton', { name: 'MRP' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    const payload = updateProduct.mock.calls[0][1];
    expect(payload).not.toHaveProperty('price');
    expect(payload).not.toHaveProperty('salePrice');
  });

  it('keeps the required price editable while admin pricing presentation is hidden', async () => {
    hiddenPresentation.add('pricing');
    renderProductsPage();
    await screen.findByText('Test product');
    fireEvent.click(screen.getByTestId('EditNoteIcon').closest('button'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('spinbutton', { name: 'MRP' })).toBeInTheDocument();
    expect(within(dialog).queryByText('On Sale')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    const payload = updateProduct.mock.calls[0][1];
    expect(payload.price).toBe(100);
    expect(payload).not.toHaveProperty('salePrice');
  });

  it('bulk-updates selected products with canonical storefront fields', async () => {
    renderProductsPage();

    await screen.findByText('Test product');
    fireEvent.click(screen.getByRole('button', { name: 'Select visible products' }));
    const bulkStateSelect = await screen.findByRole('combobox', { name: 'Set storefront state' });
    await openSelect(bulkStateSelect);
    fireEvent.click(await screen.findByRole('option', { name: 'Draft' }));

    await waitFor(() => expect(bulkUpdateProducts).toHaveBeenCalledWith(['product-1'], {
      status: 'draft',
      isEnabled: true,
    }));
    await waitFor(() => expect(screen.queryByText('1 selected')).not.toBeInTheDocument());
  });

  it('applies the Paused summary card filter to the product request', async () => {
    renderProductsPage();

    await screen.findByText('Test product');
    fireEvent.click(screen.getByRole('button', { name: /Paused/ }));

    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'paused' })));
  });

  it('applies the dashboard Published filter from the URL on page load', async () => {
    renderProductsPage(['/admin/products?status=published']);

    await screen.findByText('Test product');

    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'published' })));
    expect(screen.getByRole('button', { name: /Published/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies the dashboard Low Stock filter from the URL on page load', async () => {
    renderProductsPage(['/admin/products?stock=low']);

    await screen.findByText('Test product');

    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ maxQty: 10 })));
    expect(screen.getByText('Showing low-stock products (qty ≤ 10)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Low Stock/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('preserves an explicitly configured zero low-stock threshold in the product request', async () => {
    settingsMock.catalog.lowStockThreshold = 0;
    renderProductsPage();

    await screen.findByText('Test product');
    fireEvent.click(screen.getByRole('button', { name: /Low Stock/ }));

    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ maxQty: 0 })));
    expect(screen.getByText('Showing low-stock products (qty ≤ 0)')).toBeInTheDocument();
  });

  it('shows a recoverable error when a row state update fails', async () => {
    updateProduct.mockRejectedValueOnce(new Error('offline'));
    renderProductsPage();

    const stateSelect = await screen.findByRole('combobox', { name: 'Storefront state for Test product' });
    await openSelect(stateSelect);
    fireEvent.click(await screen.findByRole('option', { name: 'Paused' }));

    await waitFor(() => expect(notifyMock).toHaveBeenCalledWith(
      'Failed to update storefront state: offline',
      'error',
    ));
  });

  it('keeps Quick Edit open and lets the admin retry after a save error', async () => {
    updateProduct.mockRejectedValueOnce(new Error('offline'));
    renderProductsPage();

    await screen.findByText('Test product');
    fireEvent.click(screen.getByTestId('EditNoteIcon').closest('button'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(notifyMock).toHaveBeenCalledWith('Failed to update: offline', 'error'));
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps the bulk selection after a bulk state update error', async () => {
    bulkUpdateProducts.mockRejectedValueOnce(new Error('offline'));
    renderProductsPage();

    await screen.findByText('Test product');
    fireEvent.click(screen.getByRole('button', { name: 'Select visible products' }));
    const bulkStateSelect = await screen.findByRole('combobox', { name: 'Set storefront state' });
    await openSelect(bulkStateSelect);
    fireEvent.click(await screen.findByRole('option', { name: 'Draft' }));

    await waitFor(() => expect(notifyMock).toHaveBeenCalledWith('Bulk update failed: offline', 'error'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('filters archived products from the storefront state dropdown', async () => {
    renderProductsPage();

    const statusFilter = await screen.findByRole('combobox', { name: 'Storefront state' });
    await openSelect(statusFilter);
    fireEvent.click(await screen.findByRole('option', { name: 'Archived' }));

    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'archived' })));
  });

  it('exports mapped Paused and Archived labels in the CSV', async () => {
    const csvProducts = [
      { ...product, id: 'paused', name: 'Paused product', status: 'published', isEnabled: false },
      { ...product, id: 'archived', name: 'Archived product', status: 'archived', isEnabled: false },
    ];
    getProducts.mockResolvedValueOnce({ data: csvProducts, meta: { total: 2 }, counts: {} });
    const createObjectURL = vi.fn(() => 'blob:products');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderProductsPage();

    await screen.findByText('Paused product');
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0];
    const csvText = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blob);
    });
    expect(csvText).toContain('Storefront state');
    expect(csvText).toContain('Paused');
    expect(csvText).toContain('Archived');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:products');
  });
});
