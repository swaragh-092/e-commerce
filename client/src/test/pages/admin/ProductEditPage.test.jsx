import React from 'react';
import { getTags } from '../../../services/tagService';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductEditPage from '../../../pages/admin/ProductEditPage';
import { NotificationProvider } from '../../../context/NotificationContext';
import { createProduct, getProductById, updateProduct } from '../../../services/productService';
import { getCategoryTree } from '../../../services/categoryService';
import brandService from '../../../services/brandService';
import { getSaleLabels } from '../../../services/adminService';
import { getMetadata } from '../../../services/seoService';

vi.mock('../../../services/tagService', () => ({ getTags: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../../services/productService', () => ({ createProduct: vi.fn(), updateProduct: vi.fn(), getProductById: vi.fn(), getProducts: vi.fn() }));
vi.mock('../../../services/categoryService', () => ({ getCategoryTree: vi.fn() }));
vi.mock('../../../services/brandService', () => ({ default: { getBrands: vi.fn() } }));
vi.mock('../../../services/adminService', () => ({ getSaleLabels: vi.fn() }));
vi.mock('../../../services/seoService', () => ({ getMetadata: vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../hooks/useSKUGenerator', () => ({ default: () => ({ generateProductSKU: () => 'SKU', generateVariantSKU: () => 'VSKU' }) }));
const disabledFeatures = vi.hoisted(() => new Set());
const hiddenFeatures = vi.hoisted(() => new Set());
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => ({ settings: { features: { seo: false } } }), useCurrency: () => ({ symbol: '$', currency: 'USD', formatPrice: (value) => `$${value}` }), useFeature: (name) => name !== 'productAssistant' && !disabledFeatures.has(name), useFeatureVisible: (name) => !disabledFeatures.has(name) && !hiddenFeatures.has(name), useFeaturesResolved: () => true }));
vi.mock('../../../components/common/MediaPicker', () => ({ default: ({ open, onSelect, onClose }) => open ? <button type="button" onClick={() => {
  onSelect([{ id: 'media-1', url: '/uploads/product.jpg', originalName: 'Product photo' }]);
  onClose();
}}>Choose product photo</button> : null }));
vi.mock('../../../components/admin/UnitSelector', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductCustomTabs', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductRelatedPicker', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductTaxConfig', () => ({ default: () => null }));
vi.mock('../../../components/admin/ProductComboBuilder', () => ({ default: () => <div>Bundle builder</div> }));
vi.mock('../../../components/admin/ProductVariantsPanel', () => ({ default: ({ onStockTotalChange, pricingEnabled }) => <div data-testid="variant-editor" data-pricing-enabled={pricingEnabled}>Variant editor<button type="button" onClick={() => onStockTotalChange(14, 2, undefined, 2)}>Update variant stock</button><button type="button" onClick={() => onStockTotalChange(14, 1, undefined, 1, [{ id: 'v', stockQty: 14, reservedQty: 2, isActive: true, _dirty: true }])}>Draft variant stock</button><button type="button" onClick={() => onStockTotalChange(0, 0, undefined, 1, [{ id: 'v', stockQty: 5, reservedQty: 2, isActive: false, _dirty: true }])}>Draft variant disabled</button></div> }));

const product = { id: 'product', name: 'Test product', slug: 'test-product', type: 'simple', price: 200, quantity: 10, requiresShipping: false, status: 'draft', variants: [], comboItems: [], categories: [], images: [] };
const mount = (id = 'product', search = '') => render(<MemoryRouter initialEntries={[`/admin/products/${id}/edit${search}`]}><NotificationProvider><Routes><Route path="/admin/products/:id/edit" element={<ProductEditPage />} /></Routes></NotificationProvider></MemoryRouter>);
const type = async (label) => {
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Product Type' }));
  fireEvent.click(screen.getByRole('option', { name: label, exact: true }));
};
const loaded = async () => waitFor(() => expect(screen.getByRole('textbox', { name: /Product Name/ })).toHaveValue('Test product'));
beforeEach(() => {
  vi.clearAllMocks();
  getTags.mockResolvedValue({ data: [] });
  disabledFeatures.clear();
  disabledFeatures.add('seo');
  hiddenFeatures.clear();
  getCategoryTree.mockResolvedValue({ data: [] });
  brandService.getBrands.mockResolvedValue({ data: { data: [] } });
  getSaleLabels.mockResolvedValue({ data: { data: [] } });
  getProductById.mockResolvedValue({ data: product });
  updateProduct.mockImplementation(async (_, data) => ({ data: { ...product, ...data, quantity: data.type === 'simple' ? data.quantity : 0 } }));
  createProduct.mockImplementation(async (data) => ({ data: { ...product, ...data, id: 'product' } }));
});

describe('product type and inventory editor', () => {
  it('previews a saved share override and falls back to the primary product image when cleared', async () => {
    disabledFeatures.delete('seo');
    getProductById.mockResolvedValue({ data: {
      ...product,
      ogImage: '/uploads/share.jpg',
      images: [
        { id: 'first', url: '/uploads/first.jpg', sortOrder: 0 },
        { id: 'primary', url: '/uploads/primary.jpg', isPrimary: true, sortOrder: 1 },
      ],
    } });
    mount();
    const image = await screen.findByRole('img', { name: 'Social share image preview' });
    expect(image.getAttribute('src')).toContain('/uploads/share.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Use primary product image' }));
    expect(image.getAttribute('src')).toContain('/uploads/primary.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('product', expect.objectContaining({ ogImage: null })));
  });

  it('lets an admin copy the generated schema, edit it, and restore automatic generation', async () => {
    disabledFeatures.delete('seo');
    getProductById.mockResolvedValue({ data: { ...product, status: 'published' } });
    getMetadata.mockResolvedValue({ generatedSchema: { '@type': 'Product', name: product.name } });
    mount();
    const automaticField = await screen.findByRole('textbox', { name: 'Automatic JSON-LD schema' });
    expect(automaticField).toHaveAttribute('readonly');
    await waitFor(() => expect(JSON.parse(automaticField.value)).toEqual({ '@type': 'Product', name: product.name }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit generated schema' }));
    const field = screen.getByRole('textbox', { name: 'Custom JSON-LD schema' });
    expect(field).not.toHaveAttribute('readonly');

    fireEvent.change(field, { target: { value: '{"@type":"Product","name":"Custom seed"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('product', expect.objectContaining({
      schemaOverride: '{"@type":"Product","name":"Custom seed"}',
    })));
    fireEvent.click(screen.getByRole('button', { name: 'Restore automatic schema' }));
    expect(screen.getByRole('textbox', { name: 'Automatic JSON-LD schema' })).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(updateProduct).toHaveBeenLastCalledWith('product', expect.objectContaining({ schemaOverride: null })));
  });

  it('shows an automatic schema preview for a draft without requesting its public metadata', async () => {
    disabledFeatures.delete('seo');
    mount();
    const field = await screen.findByRole('textbox', { name: 'Automatic JSON-LD schema' });
    expect(JSON.parse(field.value)).toMatchObject({ '@type': 'Product', name: product.name });
    expect(field).toHaveAttribute('readonly');
    expect(getMetadata).not.toHaveBeenCalled();
  });

  it.each([
    { pricing: false, showPrices: false },
    { pricing: true, showPrices: false },
    { pricing: true, showPrices: true },
  ])('respects admin price visibility in variant editing (pricing=$pricing, showPrices=$showPrices)', async ({ pricing, showPrices }) => {
    if (!pricing) disabledFeatures.add('pricing');
    if (!showPrices) hiddenFeatures.add('pricing');
    getProductById.mockResolvedValue({ data: { ...product, type: 'variable' } });
    mount(); await loaded();
    expect(screen.getByTestId('variant-editor')).toHaveAttribute('data-pricing-enabled', String(pricing && showPrices));
  });

  it('keeps failed loads out of the editor and lets the user retry', async () => {
    getProductById.mockRejectedValueOnce(new Error('Network unavailable'));
    mount();
    await screen.findByText('Failed to load product data. Retry before editing this product.');
    expect(screen.queryByRole('textbox', { name: /Product Name/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }));
    await loaded();
    expect(getProductById).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale product response after the editor unmounts', async () => {
    let finish;
    getProductById.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = mount();
    await waitFor(() => expect(getProductById).toHaveBeenCalled());
    view.unmount();
    await act(async () => finish({ data: { ...product, name: 'Stale product' } }));
    expect(screen.queryByRole('textbox', { name: /Product Name/ })).not.toBeInTheDocument();
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('shows loading instead of an empty editor until the existing product arrives', async () => {
    let finish;
    getProductById.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Loading product');
    expect(screen.queryByText('Untitled Product')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Product Name/ })).not.toBeInTheDocument();
    await waitFor(() => expect(getProductById).toHaveBeenCalled());
    await act(async () => finish({ data: product }));
    await loaded();
    expect(screen.queryByText('Loading product…')).not.toBeInTheDocument();
  });

  it('uses standalone stock for a Simple product with old variant rows and an old alert link', async () => {
    getProductById.mockResolvedValue({ data: { ...product, quantity: 50, reservedQty: 27, variants: [
      { id: 'warned', sku: 'IGA-LOW', stockQty: 22, reservedQty: 19 },
      { id: 'other', sku: 'IGA-OTHER', stockQty: 28, reservedQty: 8 },
    ] } });
    mount('product', '?variantId=warned'); await loaded();
    expect(screen.queryByTestId('variant-editor')).not.toBeInTheDocument();
    expect(screen.getByText(/On hand:/)).toHaveTextContent('On hand: 50 · Reserved: 27 · Available to sell: 23');
    expect(screen.queryByRole('table', { name: 'Variant inventory stock' })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Stock Quantity/ })).not.toHaveAttribute('readonly');
    expect(screen.getByText(/previous variant alert no longer applies/)).toBeInTheDocument();
  });
  it('shows available stock after reservations for a simple product', async () => {
    getProductById.mockResolvedValue({ data: { ...product, quantity: 30, reservedQty: 26 } });
    mount(); await loaded();
    expect(screen.getByLabelText('Inventory stock breakdown')).toHaveTextContent('On hand: 30');
    expect(screen.getByLabelText('Inventory stock breakdown')).toHaveTextContent('Reserved: 26');
    expect(screen.getByLabelText('Inventory stock breakdown')).toHaveTextContent('Available to sell: 4');
  });
  it('keeps Simple product stock independent when every old variant is disabled', async () => {
    getProductById.mockResolvedValue({ data: { ...product, quantity: 50, variants: [{ stockQty: 22, reservedQty: 19, isActive: false }] } });
    mount(); await loaded();
    expect(screen.getByLabelText('Stock Quantity *')).toHaveValue(50);
    const summary = screen.getByLabelText('Inventory stock breakdown');
    expect(summary).toHaveTextContent('Available to sell: 50');
    expect(summary).not.toHaveTextContent('Disabled variants:');
  });
  it('explains that disabling a product retains its inventory and reservations', async () => {
    getProductById.mockResolvedValue({ data: { ...product, isEnabled: false, quantity: 30, reservedQty: 26 } });
    mount(); await loaded();
    expect(screen.getByLabelText('Inventory stock breakdown')).toHaveTextContent('Disabled product');
    expect(screen.getByLabelText('Inventory stock breakdown')).toHaveTextContent('Reserved: 26');
  });
  it('creates a catalog product without price or shipping measurements', async () => {
    disabledFeatures.add('pricing');
    disabledFeatures.add('shipping');
    mount('new');
    expect(screen.queryByLabelText(/Weight \(grams\)/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('This product requires shipping')).not.toBeInTheDocument();
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
  it.each([
    ['Draft variant stock', 14, 'Available to sell: 12'],
    ['Draft variant disabled', 0, 'Disabled variants: 5 on hand, 2 reserved'],
  ])('preserves %s in the summary after saving parent details', async (action, total, text) => {
    const persisted = { ...product, type: 'variable', variants: [{ id: 'v', stockQty: 5, reservedQty: 2, isActive: true }] };
    getProductById.mockResolvedValue({ data: persisted });
    updateProduct.mockResolvedValue({ data: persisted });
    mount(); await loaded();
    fireEvent.click(screen.getByRole('button', { name: action }));
    const summary = screen.getByLabelText('Inventory stock breakdown');
    expect(summary).toHaveTextContent(text);
    expect(summary).toHaveTextContent('Includes unsaved variant changes');
    fireEvent.change(screen.getByRole('textbox', { name: /Product Name/ }), { target: { value: 'Updated details' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await screen.findByText('Product updated successfully.');
    expect(summary).toHaveTextContent(text);
    expect(summary).toHaveTextContent('Includes unsaved variant changes');
    expect(screen.getByLabelText('Total variant stock')).toHaveValue(total);
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
  it('confirms clearing historical variant stock when Simple stock is already zero', async () => {
    getProductById.mockResolvedValue({ data: { ...product, quantity: 0, variants: [{ id: 'old', stockQty: 50, isActive: true }] } });
    updateProduct.mockResolvedValue({ data: { ...product, type: 'variable', quantity: 0, variants: [{ id: 'old', stockQty: 0, isActive: true }] } });
    mount(); await loaded(); await type('Variable Product');
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Change how stock is managed?' }));
    expect(dialog.getByText(/Historical variant stock will also be cleared/)).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Change type and clear stock' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('product', expect.objectContaining({ type: 'variable', confirmInventoryReset: true })));
    expect(await screen.findByLabelText('Total variant stock')).toHaveValue(0);
  });
  it('blocks switching away from Variable while inactive variants still exist', async () => {
    getProductById.mockResolvedValue({ data: { ...product, type: 'variable', variants: [{ stockQty: 10, isActive: false }] } });
    mount(); await loaded(); await type('Simple Product');
    expect(screen.getByRole('combobox', { name: 'Product Type' })).toHaveTextContent('Variable Product');
    expect(await screen.findByRole('alert')).toHaveTextContent('including inactive');
    expect(screen.getByLabelText('Total variant stock')).toHaveValue(0);
  });
  it('can revert an unsaved Variable selection back to the saved Simple type with historical rows', async () => {
    getProductById.mockResolvedValue({ data: { ...product, variants: [{ id: 'old', stockQty: 5 }] } });
    mount(); await loaded();
    await type('Variable Product');
    await type('Simple Product');
    expect(screen.getByRole('combobox', { name: 'Product Type' })).toHaveTextContent('Simple Product');
    expect(screen.getByLabelText('Stock Quantity *')).toHaveValue(10);
    expect(updateProduct).not.toHaveBeenCalled();
  });
  it('lets legacy Simple products with variants be corrected without discarding them', async () => {
    getProductById.mockResolvedValue({ data: { ...product, variants: [{ stockQty: 10 }] } });
    updateProduct.mockResolvedValue({ data: { ...product, type: 'variable', variants: [{ stockQty: 0 }] } });
    mount(); await loaded();
    await type('Variable Product');
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Change type and clear stock' }));
    expect(await screen.findByText('Variant editor')).toBeInTheDocument();
    expect(screen.getByLabelText('Total variant stock')).toHaveValue(0);
    expect(updateProduct.mock.calls[0][1]).toHaveProperty('confirmInventoryReset', true);
  });
  it.each([
    ['no', []],
    ['active legacy', [{ stockQty: 5, isActive: true }]],
    ['inactive legacy', [{ stockQty: 5, isActive: false }]],
  ])('saves a photo on a Simple product with %s variants without changing type or stock', async (_, variants) => {
    getProductById.mockResolvedValue({ data: { ...product, variants } });
    mount(); await loaded();
    expect(screen.getByLabelText('Stock Quantity *')).not.toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Add Product Media' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose product photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    const payload = updateProduct.mock.calls[0][1];
    expect(payload).toMatchObject({ type: 'simple', images: [expect.objectContaining({ mediaId: 'media-1', url: '/uploads/product.jpg' })] });
    expect(payload.quantity).toBe(product.quantity);
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

describe('product editor tag persistence', () => {
  it('loads existing labels and sends edited tags in the product payload', async () => {
    getProductById.mockResolvedValue({ data: { ...product, tags: [{ id: 'tag', name: 'Summer', slug: 'summer' }] } });
    mount(); await loaded();
    expect(screen.getByText('Summer', { exact: true })).toBeInTheDocument();
    const input = screen.getByRole('combobox', { name: 'Tags' });
    fireEvent.change(input, { target: { value: 'Beginner Friendly' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('product', expect.objectContaining({ tags: ['Summer', 'Beginner Friendly'] })));
  });
});
