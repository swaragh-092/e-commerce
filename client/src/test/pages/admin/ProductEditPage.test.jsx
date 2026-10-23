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
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => ({ settings: { features: { seo: false } } }), useCurrency: () => ({ symbol: '$', currency: 'USD', formatPrice: (value) => `$${value}` }), useFeature: (name) => name !== 'productAssistant' }));
vi.mock('../../../components/common/MediaPicker', () => ({ default: () => null }));
vi.mock('../../../components/admin/UnitSelector', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductCustomTabs', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductTaxConfig', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductComboBuilder', () => ({ default: () => <div>Bundle builder</div> }));
vi.mock('../../../components/admin/ProductVariantsPanel', () => ({ default: ({ onStockTotalChange }) => <div>Variant editor<button onClick={() => onStockTotalChange(14, 2, undefined, 2)}>Update variant stock</button></div> }));

const product = { id: 'product', name: 'Test product', slug: 'test-product', type: 'simple', price: 200, quantity: 10, requiresShipping: false, status: 'draft', variants: [], comboItems: [], categories: [], images: [] };
const mount = (id = 'product') => render(<MemoryRouter initialEntries={[`/admin/products/${id}/edit`]}><NotificationProvider><Routes><Route path="/admin/products/:id/edit" element={<ProductEditPage />} /></Routes></NotificationProvider></MemoryRouter>);
const type = async (label) => {
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Product Type' }));
  fireEvent.click(screen.getByRole('option', { name: label, exact: true }));
};
const loaded = async () => waitFor(() => expect(screen.getByRole('textbox', { name: /Product Name/ })).toHaveValue('Test product'));
beforeEach(() => {
  vi.clearAllMocks();
  getCategoryTree.mockResolvedValue({ data: [] });
  brandService.getBrands.mockResolvedValue({ data: { data: [] } });
  getSaleLabels.mockResolvedValue({ data: { data: [] } });
  getProductById.mockResolvedValue({ data: product });
  updateProduct.mockImplementation(async (_, data) => ({ data: { ...product, ...data, quantity: data.type === 'simple' ? data.quantity : 0 } }));
  createProduct.mockImplementation(async (data) => ({ data: { ...product, ...data, id: 'product' } }));
});

describe('product type and inventory editor', () => {
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
});
