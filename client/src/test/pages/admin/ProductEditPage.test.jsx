import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductEditPage from '../../../pages/admin/ProductEditPage';
import { NotificationProvider } from '../../../context/NotificationContext';
import { createProduct, getProductById, updateProduct } from '../../../services/productService';
import { getCategoryTree } from '../../../services/categoryService';
import brandService from '../../../services/brandService';
import { getSaleLabels } from '../../../services/adminService';

vi.mock('../../../services/productService', () => ({ createProduct: vi.fn(), updateProduct: vi.fn(), getProductById: vi.fn(), getProducts: vi.fn() }));
vi.mock('../../../services/categoryService', () => ({ getCategoryTree: vi.fn() }));
vi.mock('../../../services/brandService', () => ({ default: { getBrands: vi.fn() } }));
vi.mock('../../../services/adminService', () => ({ getSaleLabels: vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../hooks/useSKUGenerator', () => ({ default: () => ({ generateProductSKU: () => 'SKU', generateVariantSKU: () => 'VSKU' }) }));
const disabledFeatures = vi.hoisted(() => new Set());
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => ({ settings: { features: { seo: false } } }), useCurrency: () => ({ symbol: '$', currency: 'USD', formatPrice: (value) => `$${value}` }), useFeature: (name) => !['productAssistant', 'seo'].includes(name) && !disabledFeatures.has(name), useFeatureVisible: (name) => !disabledFeatures.has(name), useFeaturesResolved: () => true }));
vi.mock('../../../components/common/MediaPicker', () => ({ default: ({ open, onSelect, onClose }) => open ? <button type="button" onClick={() => {
  onSelect([{ id: 'media-1', url: '/uploads/product.jpg', originalName: 'Product photo' }]);
  onClose();
}}>Choose product photo</button> : null }));
vi.mock('../../../components/admin/UnitSelector', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductCustomTabs', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductTaxConfig', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductComboBuilder', () => ({ default: () => <div>Bundle builder</div> }));
vi.mock('../../../components/admin/ProductVariantsPanel', () => ({ default: ({ onStockTotalChange }) => <div>Variant editor<button type="button" onClick={() => onStockTotalChange(14, 2, undefined, 2)}>Update variant stock</button></div> }));

const product = { id: 'product', name: 'Test product', slug: 'test-product', type: 'simple', price: 200, quantity: 10, requiresShipping: false, status: 'draft', variants: [], comboItems: [], categories: [], images: [] };
const mount = (id = 'product') => render(<MemoryRouter initialEntries={[`/admin/products/${id}/edit`]}><NotificationProvider><Routes><Route path="/admin/products/:id/edit" element={<ProductEditPage />} /></Routes></NotificationProvider></MemoryRouter>);
const type = async (label) => {
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Product Type' }));
  fireEvent.click(screen.getByRole('option', { name: label, exact: true }));
};
const loaded = async () => waitFor(() => expect(screen.getByRole('textbox', { name: /Product Name/ })).toHaveValue('Test product'));
beforeEach(() => {
  vi.clearAllMocks();
  disabledFeatures.clear();
  getCategoryTree.mockResolvedValue({ data: [] });
  brandService.getBrands.mockResolvedValue({ data: { data: [] } });
  getSaleLabels.mockResolvedValue({ data: { data: [] } });
  getProductById.mockResolvedValue({ data: product });
  updateProduct.mockImplementation(async (_, data) => ({ data: { ...product, ...data, quantity: data.type === 'simple' ? data.quantity : 0 } }));
  createProduct.mockImplementation(async (data) => ({ data: { ...product, ...data, id: 'product' } }));
});

describe('product type and inventory editor', () => {
  it('creates a catalog product without price or shipping measurements', async () => {
    disabledFeatures.add('pricing');
    disabledFeatures.add('shipping');
    mount('new');
    fireEvent.change(screen.getByRole('textbox', { name: /Product Name/ }), { target: { value: 'Catalog sample' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    const payload = createProduct.mock.calls[0][0];
    expect(payload.price).toBe(0);
    expect(payload).not.toHaveProperty('requiresShipping');
    expect(payload).not.toHaveProperty('weightGrams');
  });

  it('preserves existing hidden price and shipping fields when editing in catalog mode', async () => {
    disabledFeatures.add('pricing');
    disabledFeatures.add('shipping');
    mount(); await loaded();
    fireEvent.change(screen.getByRole('textbox', { name: /Product Name/ }), { target: { value: 'Renamed product' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    const payload = updateProduct.mock.calls[0][1];
    expect(payload).not.toHaveProperty('price');
    expect(payload).not.toHaveProperty('requiresShipping');
    expect(payload).not.toHaveProperty('weightGrams');
  });

  it('creates Variable products without forbidden manual stock or premature variants', async () => {
    getProductById.mockResolvedValue({ data: { ...product, type: 'variable', quantity: 0 } });
    mount('new'); await type('Variable Product');
    fireEvent.change(screen.getByRole('textbox', { name: /Product Name/ }), { target: { value: 'Shirt' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /^MRP/ }), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    expect(createProduct.mock.calls[0][0]).toMatchObject({ type: 'variable', price: 200 });
    expect(createProduct.mock.calls[0][0]).not.toHaveProperty('quantity');
    expect(createProduct.mock.calls[0][0]).not.toHaveProperty('variants');
  });
  it('gives Simple products standalone inventory without the variant editor', async () => {
    mount(); await loaded();
    expect(screen.queryByText('Variant editor')).not.toBeInTheDocument();
    const stock = screen.getByRole('spinbutton', { name: /Stock Quantity/ });
    expect(stock).not.toHaveAttribute('readonly');
    fireEvent.change(stock, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('product', expect.objectContaining({ type: 'simple', quantity: 12 })));
  });
  it('shows Variable inventory as active variant totals and omits manual quantity on save', async () => {
    getProductById.mockResolvedValue({ data: { ...product, type: 'variable', variants: [{ stockQty: 5 }, { stockQty: 99, isActive: false }] } });
    mount(); await loaded();
    expect(screen.getByText('Variant editor')).toBeInTheDocument();
    expect(screen.getByLabelText('Total variant stock')).toHaveValue(5);
    expect(screen.getByLabelText('Total variant stock')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Update variant stock' }));
    expect(screen.getByLabelText('Total variant stock')).toHaveValue(14);
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    expect(updateProduct.mock.calls[0][1]).not.toHaveProperty('quantity');
  });
  it('requires saving the Variable type before allowing variant operations', async () => {
    getProductById.mockResolvedValue({ data: { ...product, quantity: 0 } });
    mount(); await loaded(); await type('Variable Product');
    expect(screen.queryByText('Variant editor')).not.toBeInTheDocument();
    expect(screen.getByText(/Save the product first/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    expect(await screen.findByText('Variant editor')).toBeInTheDocument();
  });
  it('confirms stock reset on conversion and supports cancelling safely', async () => {
    mount(); await loaded(); await type('Variable Product');
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    let dialog = within(await screen.findByRole('dialog', { name: 'Change how stock is managed?' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Keep editing' }));
    expect(updateProduct).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Save Product' }));
    dialog = within(await screen.findByRole('dialog', { name: 'Change how stock is managed?' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Change type and clear stock' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('product', expect.objectContaining({ type: 'variable', confirmInventoryReset: true })));
    expect(updateProduct.mock.calls[0][1]).not.toHaveProperty('quantity');
  });
  it('blocks switching away from Variable while inactive variants still exist', async () => {
    getProductById.mockResolvedValue({ data: { ...product, type: 'variable', variants: [{ stockQty: 10, isActive: false }] } });
    mount(); await loaded(); await type('Simple Product');
    expect(screen.getByRole('combobox', { name: 'Product Type' })).toHaveTextContent('Variable Product');
    expect(await screen.findByRole('alert')).toHaveTextContent('including inactive');
    expect(screen.getByLabelText('Total variant stock')).toHaveValue(0);
  });
  it('lets legacy Simple products with variants be corrected without discarding them', async () => {
    getProductById.mockResolvedValue({ data: { ...product, variants: [{ stockQty: 10 }] } });
    updateProduct.mockResolvedValue({ data: { ...product, type: 'variable', variants: [{ stockQty: 10 }] } });
    mount(); await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Use Variable Product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    expect(await screen.findByText('Variant editor')).toBeInTheDocument();
    expect(screen.getByLabelText('Total variant stock')).toHaveValue(10);
    expect(updateProduct.mock.calls[0][1]).not.toHaveProperty('confirmInventoryReset');
  });
  it.each([
    ['no', []],
    ['active legacy', [{ stockQty: 5, isActive: true }]],
    ['inactive legacy', [{ stockQty: 5, isActive: false }]],
  ])('saves a photo on a Simple product with %s variants without changing type or stock', async (_, variants) => {
    getProductById.mockResolvedValue({ data: { ...product, variants } });
    mount(); await loaded();
    if (variants.length) expect(screen.getByLabelText('Stock Quantity *')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Add Product Media' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose product photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    const payload = updateProduct.mock.calls[0][1];
    expect(payload).toMatchObject({ type: 'simple', images: [expect.objectContaining({ mediaId: 'media-1', url: '/uploads/product.jpg' })] });
    if (variants.length) expect(payload).not.toHaveProperty('quantity');
    else expect(payload.quantity).toBe(product.quantity);
    expect(payload).not.toHaveProperty('variants');
    expect(screen.queryByText('Variant editor')).not.toBeInTheDocument();
  });
  it('shows the bundle builder without manual stock or variants for Combo', async () => {
    getProductById.mockResolvedValue({ data: { ...product, type: 'combo', quantity: 0 } });
    mount(); await loaded();
    expect(screen.getByText('Bundle builder')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /Stock Quantity/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Variant editor')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    expect(updateProduct.mock.calls[0][1]).not.toHaveProperty('quantity');
  });

  it('renders the sticky top action bar with Back, Cancel, and Save buttons, and prompts on cancel when dirty', async () => {
    mount(); await loaded();
    expect(screen.getByRole('button', { name: 'Back to Products' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Product' })).toBeInTheDocument();

    // Modify a field to make it dirty
    fireEvent.change(screen.getByRole('textbox', { name: /Product Name/ }), { target: { value: 'Modified Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Confirmation dialog should appear
    expect(await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
  });
});
