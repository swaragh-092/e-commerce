import React from 'react';
import { getTags } from '../../../services/tagService';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductEditPage from '../../../pages/admin/ProductEditPage';
import { createProduct, getProductById, updateProduct } from '../../../services/productService';

const { features, notify } = vi.hoisted(() => ({ features: {}, notify: vi.fn() }));
vi.mock('../../../services/tagService', () => ({ getTags: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../../services/productService', () => ({ createProduct: vi.fn(), updateProduct: vi.fn(), getProductById: vi.fn(), getProducts: vi.fn() }));
vi.mock('../../../services/categoryService', () => ({ getCategoryTree: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../../services/brandService', () => ({ default: { getBrands: vi.fn().mockResolvedValue({ data: { data: [] } }) } }));
vi.mock('../../../services/adminService', () => ({ getSaleLabels: vi.fn().mockResolvedValue({ data: { data: [] } }) }));
vi.mock('../../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: {} }),
  useFeature: (name) => features[name] ?? false,
  useFeatureVisible: (name) => features[name] ?? false,
  useFeaturesResolved: () => true,
  useCurrency: () => ({ currency: 'INR', symbol: '₹', formatPrice: String }),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify, confirm: async () => true }) }));
vi.mock('../../../components/admin/ProductCustomTabs', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductComboBuilder', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductVariantsPanel', () => ({ default: () => null }));
vi.mock('../../../components/common/MediaPicker', () => ({ default: () => null }));
vi.mock('../../../components/admin/UnitSelector', () => ({ default: () => null }));

const renderForm = () => render(<MemoryRouter><ProductEditPage /></MemoryRouter>);
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));

describe('product editor validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  getTags.mockResolvedValue({ data: [] });
    features.pricing = false;
    features.showPrice = false;
    createProduct.mockResolvedValue({ data: { id: 'new-product' } });
  });

  it('saves a catalog product without requiring a hidden MRP field', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Catalog item' } });
    save();
    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    expect(createProduct.mock.calls[0][0]).toMatchObject({ name: 'Catalog item', price: 0 });
    expect(createProduct.mock.calls[0][0]).not.toHaveProperty('salePrice');
  });

  it.each([[true, false], [true, true]])('requires MRP when pricing=%s and showPrice=%s', async (pricing, showPrice) => {
    Object.assign(features, { pricing, showPrice });
    renderForm();
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Priced item' } });
    save();
    expect(createProduct).not.toHaveBeenCalled();
    expect(await screen.findByText('MRP is required.')).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('MRP is required.'), 'warning');
  });

  it('saves a priced product with a valid MRP', async () => {
    features.pricing = true;
    features.showPrice = true;
    renderForm();
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Priced item' } });
    fireEvent.change(screen.getByLabelText(/MRP/), { target: { value: '100' } });
    save();
    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    expect(createProduct.mock.calls[0][0]).toMatchObject({ price: 100 });
  });

  it.each([
    ['simple', 'Simple Product', false],
    ['variable', 'Variable Product', false],
    ['combo', 'Combo / Bundle', false],
    ['simple', 'Simple Product', true],
    ['variable', 'Variable Product', true],
    ['combo', 'Combo / Bundle', true],
  ])('submits a valid %s creation payload (%s; priced=%s)', async (type, option, priced) => {
    features.pricing = priced;
    features.showPrice = priced;
    renderForm();
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Contract test item' } });
    if (priced) fireEvent.change(screen.getByLabelText(/MRP/), { target: { value: '100' } });
    fireEvent.mouseDown(screen.getByText('Product Type', { selector: 'label' }).parentElement.querySelector('[role="combobox"]'));
    fireEvent.click(screen.getByRole('option', { name: option }));
    await waitFor(() => expect(screen.getByText('Product Type', { selector: 'label' }).parentElement.querySelector('[role="combobox"]')).toHaveTextContent(option));
    save();
    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    const payload = createProduct.mock.calls[0][0];
    expect(payload.type).toBe(type);
    if (type === 'simple') expect(payload.quantity).toBe(0);
    else expect(payload).not.toHaveProperty('quantity');
    expect(payload).not.toHaveProperty('variants');
  });

  it('updates a variable product without replacing its variants or stock', async () => {
    const product = {
      id: 'existing-product', name: 'Existing variable item', type: 'variable', price: 100,
      quantity: 5, requiresShipping: false, variants: [{ id: 'variant-1', stockQty: 5, isActive: true }],
    };
    getProductById.mockResolvedValue({ data: product });
    updateProduct.mockResolvedValue({ data: product });
    render(<MemoryRouter initialEntries={['/admin/products/existing-product/edit']}>
      <Routes><Route path="/admin/products/:id/edit" element={<ProductEditPage />} /></Routes>
    </MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('Product Name *')).toHaveValue(product.name));
    expect(screen.getByLabelText('Total variant stock')).toHaveAttribute('readonly');
    save();
    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    const payload = updateProduct.mock.calls[0][1];
    expect(payload).not.toHaveProperty('variants');
    expect(payload).not.toHaveProperty('quantity');
  });

  it('shows API field validation details when saving fails', async () => {
    createProduct.mockRejectedValue({ response: { data: { error: {
      message: 'Validation failed', details: [{ field: 'variants', message: '"variants" is required' }],
    } } } });
    renderForm();
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Test item' } });
    save();
    await waitFor(() => expect(notify).toHaveBeenCalledWith('"variants" is required', 'error'));
  });

  it.each(['-1', '1.5', '2147483648'])('rejects invalid standalone stock %s', async (quantity) => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Product Name *'), { target: { value: 'Stock test item' } });
    fireEvent.change(screen.getByLabelText('Stock Quantity *'), { target: { value: quantity } });
    save();
    expect(createProduct).not.toHaveBeenCalled();
    expect(await screen.findByText('Stock quantity must be a whole number from 0 to 2147483647.')).toBeInTheDocument();
  });

  it('still validates visible required fields in catalog mode', async () => {
    renderForm();
    save();
    expect(createProduct).not.toHaveBeenCalled();
    expect(await screen.findByText('Product name is required.')).toBeInTheDocument();
  });
});
