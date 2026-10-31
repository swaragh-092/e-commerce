import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductVariantsPanel from '../../components/admin/ProductVariantsPanel';
import { NotificationProvider } from '../../context/NotificationContext';
import { UnitCatalogProvider } from '../../context/UnitCatalogContext';
import attributeService from '../../services/attributeService';
import settingsService from '../../services/settingsService';
import { getProductById, getProducts } from '../../services/productService';

const permission = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => permission.allowed }) }));
vi.mock('../../hooks/useSKUGenerator', () => ({ default: () => ({ generateProductSKU: vi.fn(), generateVariantSKU: vi.fn() }) }));
vi.mock('../../components/common/MediaPicker', () => ({ default: () => null }));
vi.mock('../../services/productService', () => ({ getProductById: vi.fn(), getProducts: vi.fn() }));
vi.mock('../../services/settingsService', () => ({ default: { getSettingsGroup: vi.fn() } }));
vi.mock('../../services/attributeService', () => ({ default: { getProductAttributes: vi.fn(), getProductVariants: vi.fn(), getAttributes: vi.fn(), getCategoryAttributes: vi.fn(), getAttributeById: vi.fn(), assignProductAttribute: vi.fn(), updateProductAttributeGroup: vi.fn(), deleteProductAttributeGroup: vi.fn(), deleteProductVariant: vi.fn(), cloneVariants: vi.fn(), updateProductVariant: vi.fn(), previewVariantGeneration: vi.fn(), bulkGenerateVariants: vi.fn() } }));
const height = { id: 'height', name: 'Height', unitCategory: 'Length', values: [{ id: 'ten', value: '10', unitLabel: 'cm' }] };
const row = { id: 'row', attributeId: 'height', valueId: 'ten', attribute: height, value: height.values[0], isVariantAttr: false };
const tree = (props = {}) => <MemoryRouter><NotificationProvider><UnitCatalogProvider><ProductVariantsPanel productId="product" canManageVariants {...props} /></UnitCatalogProvider></NotificationProvider></MemoryRouter>;

beforeEach(() => {
  vi.clearAllMocks(); permission.allowed = true;
  attributeService.deleteProductVariant.mockResolvedValue({ data: { data: null } });
  settingsService.getSettingsGroup.mockResolvedValue({});
  getProductById.mockResolvedValue({ data: { id: 'product', price: 100, quantity: 2 } });
  attributeService.getProductAttributes.mockResolvedValue({ data: { data: [] } });
  attributeService.getProductVariants.mockResolvedValue({ data: { data: [{ id: 'variant', sku: 'V1', price: 100, stockQty: 2, isActive: true, options: [], images: [] }] } });
  attributeService.getAttributes.mockResolvedValue({ data: { data: { rows: [height] } } });
  attributeService.getCategoryAttributes.mockResolvedValue({ data: { data: [] } });
  attributeService.getAttributeById.mockResolvedValue({ data: { data: height } });
  attributeService.assignProductAttribute.mockResolvedValue({ data: { data: [row] } });
  getProducts.mockResolvedValue({ data: [{ id: 'source', name: 'Source product', sku: 'SOURCE-SKU', type: 'variable', variants: [{ id: 'source-variant' }] }] });
  attributeService.cloneVariants.mockResolvedValue({ data: { data: [], meta: { createdCount: 1, skippedCount: 0, addedAssignments: 1 } } });
});

describe('product attributes and variant drafts', () => {
  it('unlocks attribute removal only after deleting the last dependent variant and disabling variant use', async () => {
    attributeService.getProductAttributes.mockResolvedValue({ data: { data: [{ ...row, isVariantAttr: true }] } });
    attributeService.getProductVariants.mockResolvedValue({ data: { data: [{ id: 'variant', optionLabel: 'Height option', price: 100, stockQty: 0, isActive: false, options: [{ attributeId: 'height', valueId: 'ten' }], images: [] }] } });
    attributeService.updateProductAttributeGroup.mockResolvedValue({ data: { data: [row] } });
    attributeService.deleteProductAttributeGroup.mockImplementation(async () => {
      attributeService.getProductAttributes.mockResolvedValue({ data: { data: [] } });
      return { data: { data: null } };
    });
    render(tree());
    const toggle = await screen.findByRole('checkbox', { name: 'Use Height for variants' });
    expect(toggle).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Height attribute' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Height option', exact: true }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Delete variant?' })).getByRole('button', { name: 'Delete variant', exact: true }));
    await waitFor(() => expect(toggle).toBeEnabled());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Remove Height attribute' })).toBeDisabled();
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Height attribute' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Remove Height attribute' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Remove attribute from product?' })).getByRole('button', { name: 'Remove attribute', exact: true }));
    expect(await screen.findByText('No attributes assigned')).toBeInTheDocument();
    expect(attributeService.updateProductAttributeGroup).toHaveBeenCalledWith('product', 'row', { isVariantAttr: false });
    expect(attributeService.deleteProductAttributeGroup).toHaveBeenCalledWith('product', 'row');
  });
  const pickCopySource = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Copy from product' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search products' }), { target: { value: 'SOURCE' } });
    fireEvent.click(await screen.findByRole('option', { name: /Source product/ }));
    return within(screen.getByRole('dialog', { name: 'Clone Variants from Another Product' }));
  };
  it('stages grouped prices and saves them without changing stock or SKUs', async () => {
    const rows = [
      ['days', 'early', 'Flowering Days', 'Early'], ['days', 'late', 'Flowering Days', 'Late'],
      ['colour', 'red', 'Flower Colour', 'Red'], ['colour', 'yellow', 'Flower Colour', 'Yellow'],
    ].map(([attributeId, valueId, name, value]) => ({ id: valueId, attributeId, valueId, attribute: { name }, value: { value }, isVariantAttr: true }));
    const variants = ['early', 'late'].flatMap((days) => ['red', 'yellow'].map((colour, index) => ({
      id: `${days}-${colour}`, optionLabel: `${days}-${colour}`, sku: `${days}-${colour}`, price: index ? 110 : 100,
      stockQty: 5, reservedQty: 1, isActive: index === 0, options: [{ attributeId: 'days', valueId: days }, { attributeId: 'colour', valueId: colour }], images: [],
    })));
    attributeService.getProductAttributes.mockResolvedValue({ data: { data: rows } });
    attributeService.getProductVariants.mockResolvedValue({ data: { data: variants } });
    render(tree());
    const earlyButton = await screen.findByRole('button', { name: 'early-red', exact: true });
    const earlyEditor = within(earlyButton.closest('.MuiAccordion-root'));
    fireEvent.click(earlyButton);
    fireEvent.change(earlyEditor.getByLabelText('Stock Qty'), { target: { value: '9' } });
    fireEvent.change(earlyEditor.getByLabelText('SKU'), { target: { value: 'EDITED-SKU' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set prices by attribute' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Set prices by attribute' }));
    fireEvent.click(dialog.getByRole('checkbox', { name: 'Flowering Days' }));
    fireEvent.change(dialog.getByLabelText('MRP for Flowering Days: Early'), { target: { value: '45' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Apply prices to draft' }));
    expect(attributeService.updateProductVariant).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Save variant changes' }));
    await waitFor(() => expect(attributeService.updateProductVariant).toHaveBeenCalledTimes(2));
    expect(attributeService.updateProductVariant).toHaveBeenCalledWith('product', 'early-red', expect.objectContaining({ price: 45, stockQty: 9, sku: 'EDITED-SKU', isActive: true }));
    expect(attributeService.updateProductVariant).toHaveBeenCalledWith('product', 'early-yellow', expect.objectContaining({ price: 45, stockQty: 5, sku: 'early-yellow', isActive: false }));
  });

  it('searches by product SKU and refreshes attributes and variants after copying', async () => {
    render(tree());
    const dialog = await pickCopySource();
    expect(getProducts).toHaveBeenCalledWith({ search: 'SOURCE', limit: 20, include: 'variants', hasVariants: true });
    expect(dialog.getByRole('combobox', { name: 'Search products' })).toHaveValue('Source product');
    expect(dialog.getByText(/fresh unique SKUs/)).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Clone Variants' }));
    await waitFor(() => expect(attributeService.cloneVariants).toHaveBeenCalledWith('product', { sourceProductId: 'source' }));
    await waitFor(() => expect(attributeService.getProductAttributes).toHaveBeenCalledTimes(2));
    expect(attributeService.getProductVariants).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert')).toHaveTextContent('1 variant copied');
  });
  it('keeps the selected source after a copy failure so the operation can be retried', async () => {
    attributeService.cloneVariants.mockRejectedValueOnce({ response: { data: { error: { message: 'Source changed. Please retry.' } } } });
    render(tree()); const dialog = await pickCopySource();
    fireEvent.click(dialog.getByRole('button', { name: 'Clone Variants' }));
    expect(await screen.findByText('Source changed. Please retry.')).toBeInTheDocument();
    expect(dialog.getByRole('combobox', { name: 'Search products' })).toHaveValue('Source product');
    fireEvent.click(dialog.getByRole('button', { name: 'Clone Variants' }));
    await waitFor(() => expect(attributeService.cloneVariants).toHaveBeenCalledTimes(2));
  });
  it('does not allow cancelling or changing source while a copy is in progress', async () => {
    let finish;
    attributeService.cloneVariants.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(tree()); const dialog = await pickCopySource();
    fireEvent.click(dialog.getByRole('button', { name: 'Clone Variants' }));
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(dialog.getByRole('combobox', { name: 'Search products' })).toBeDisabled();
    finish({ data: { meta: { createdCount: 0, skippedCount: 1 } } });
    expect(await screen.findByText(/0 variants copied; 1 already present/)).toBeInTheDocument();
  });
  it('filters out the current product, bundles, and products without variants', async () => {
    getProducts.mockResolvedValue({ data: [
      { id: 'product', name: 'Current product', variants: [{}] },
      { id: 'empty', name: 'Empty product', variants: [] },
      { id: 'bundle', name: 'Bundle product', type: 'combo', variants: [{}] },
      { id: 'source', name: 'Source product', sku: 'SOURCE', variants: [{}] },
    ] });
    render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Copy from product' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search products' }), { target: { value: 'SOURCE' } });
    expect(await screen.findByRole('option', { name: /Source product/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Current|Empty|Bundle/ })).not.toBeInTheDocument();
  });
  it('rejects duplicate SKUs within the product before sending variant edits', async () => {
    attributeService.getProductVariants.mockResolvedValue({ data: { data: [
      { id: 'one', optionLabel: 'First', sku: 'FIRST', price: 100, stockQty: 1 },
      { id: 'two', optionLabel: 'Second', sku: 'SECOND', price: 100, stockQty: 1 },
    ] } });
    render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Second', exact: true }));
    fireEvent.change(screen.getByRole('textbox', { name: 'SKU', exact: true }), { target: { value: 'FIRST' } });
    expect(screen.getByText('Each variant must have a different SKU.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save variant changes' })).toBeDisabled();
    expect(attributeService.updateProductVariant).not.toHaveBeenCalled();
  });
  it('copies from a source selected by category', async () => {
    render(tree({ flatCatFiles: [{ id: 'clothes', name: 'Clothes', path: 'Clothes', depth: 0 }] }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy from product' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Browse by Category' }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Select Category' }));
    fireEvent.click(screen.getByRole('option', { name: 'Clothes', exact: true }));
    fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Select Product' }));
    fireEvent.click(screen.getByRole('option', { name: /Source product/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clone Variants' }));
    await waitFor(() => expect(attributeService.cloneVariants).toHaveBeenCalledWith('product', { sourceProductId: 'source' }));
    expect(getProducts).toHaveBeenCalledWith({ categoryId: 'clothes', limit: 100, include: 'variants', hasVariants: true });
  });
  it('ignores an old search response after the search text has changed', async () => {
    let finishOld;
    getProducts.mockImplementation(({ search }) => search === 'OLD' ? new Promise((resolve) => { finishOld = resolve; }) : Promise.resolve({ data: [{ id: 'source', name: 'New source', sku: 'NEW', variants: [{}] }] }));
    render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Copy from product' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search products' }), { target: { value: 'OLD' } });
    await waitFor(() => expect(finishOld).toBeTypeOf('function'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search products' }), { target: { value: 'NEW' } });
    expect(await screen.findByRole('option', { name: /New source/ })).toBeInTheDocument();
    await act(async () => finishOld({ data: [{ id: 'old', name: 'Old source', variants: [{}] }] }));
    expect(screen.queryByRole('option', { name: /Old source/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /New source/ })).toBeInTheDocument();
  });
  it('keeps unsaved variant edits when assigning attributes through the unified picker', async () => {
    render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Variant SKU' }));
    fireEvent.change(screen.getByLabelText('MRP'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add attribute', exact: true }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Attribute', exact: true }), { target: { value: 'Height' } });
    fireEvent.click(screen.getByRole('option', { name: 'Height', exact: true }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: '10cm', exact: true })).toBeEnabled());
    fireEvent.click(screen.getByRole('checkbox', { name: '10cm', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to product' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add attribute', exact: true })).not.toBeInTheDocument());
    expect(screen.getByLabelText('MRP')).toHaveValue(150);
    expect(screen.getByRole('button', { name: 'Save variant changes' })).toBeEnabled();
    expect(attributeService.getProductVariants).toHaveBeenCalledTimes(1);
    expect(screen.getByText('10cm')).toBeInTheDocument();
  });
  it('refreshes category suggestions without resetting edited variant prices', async () => {
    const view = render(tree({ categoryIds: ['first'] }));
    fireEvent.click(await screen.findByRole('button', { name: 'Variant SKU' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'MRP', exact: true }), { target: { value: '175' } });
    view.rerender(tree({ categoryIds: ['second'] }));
    await waitFor(() => expect(attributeService.getCategoryAttributes).toHaveBeenLastCalledWith(['second'], true));
    expect(screen.getByLabelText('MRP')).toHaveValue(175);
    expect(attributeService.getProductVariants).toHaveBeenCalledTimes(1);
  });
  it('does not send requests for an unsaved product', async () => {
    render(tree({ productId: undefined }));
    expect(screen.getByText('Save the product before adding attributes or variants.')).toBeInTheDocument();
    expect(attributeService.getProductAttributes).not.toHaveBeenCalled();
    expect(attributeService.getProductVariants).not.toHaveBeenCalled();
  });
  it('offers a retry and disables editing after loading fails', async () => {
    attributeService.getProductAttributes.mockRejectedValueOnce(new Error('Offline'));
    render(tree());
    await screen.findByText('Attributes could not be loaded. Retry before making changes.');
    expect(screen.getByRole('button', { name: 'Add attribute', exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add attribute', exact: true })).toBeEnabled());
  });
  it('requires attribute-management permission for changes', async () => {
    permission.allowed = false;
    render(tree());
    await screen.findByText('No attributes assigned');
    expect(screen.getByRole('button', { name: 'Add attribute', exact: true })).toBeDisabled();
  });
  it('preserves legacy product-only specifications without offering them as variant dimensions', async () => {
    attributeService.getProductAttributes.mockResolvedValue({ data: { data: [{ id: 'legacy', customName: 'Care', customValue: 'Keep in shade', isVariantAttr: true }] } });
    render(tree());
    expect(await screen.findByText('Keep in shade')).toBeInTheDocument();
    expect(screen.getByText('Product-only specification · display only')).toBeInTheDocument();
    expect(screen.getByText('Start with your product options')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create .*variant/ })).not.toBeInTheDocument();
  });
  it('explains invalid stock quantities before allowing variant changes to be saved', async () => {
    render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Variant SKU' }));
    fireEvent.change(screen.getByLabelText('Stock Qty'), { target: { value: '1.5' } });
    expect(screen.getByRole('button', { name: 'Save variant changes' })).toBeDisabled();
    expect(screen.getByText('Enter a whole number, at least 0.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Stock Qty'), { target: { value: '3' } });
    expect(screen.getByRole('button', { name: 'Save variant changes' })).toBeEnabled();
  });
  it('preserves variant prices when editing stock in catalog mode', async () => {
    attributeService.updateProductVariant.mockResolvedValue({ data: { data: {} } });
    render(tree({ pricingEnabled: false }));
    fireEvent.click(await screen.findByRole('button', { name: 'Variant SKU' }));
    expect(screen.queryByLabelText('MRP')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set prices by attribute' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Stock Qty'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save variant changes' }));
    await waitFor(() => expect(attributeService.updateProductVariant).toHaveBeenCalled());
    expect(attributeService.updateProductVariant.mock.calls[0][2]).not.toHaveProperty('price');
  });
  it('passes admin pricing visibility into the variant creation review', async () => {
    attributeService.getProductAttributes.mockResolvedValue({ data: { data: [{ ...row, isVariantAttr: true }] } });
    attributeService.getProductVariants.mockResolvedValue({ data: { data: [] } });
    attributeService.previewVariantGeneration.mockResolvedValue({ data: { data: {
      token: 'a'.repeat(64), total: 1, addedCount: 1, keptCount: 0, removedCount: 0, blockedRemovalCount: 0,
      combinations: [{ valueIds: ['ten'], label: '10 cm', isNew: true }], removals: [],
    } } });
    render(tree({ pricingEnabled: false }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create 1 variant' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Create variants' }));
    expect(dialog.queryByLabelText('Starting MRP')).not.toBeInTheDocument();
    expect(dialog.queryByLabelText('MRP')).not.toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Set prices by attribute' })).not.toBeInTheDocument();
    expect(dialog.getByLabelText('Starting stock')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Create 1 variant' })).toBeEnabled();
  });
  it('deletes ordinary stock after confirmation and preserves edits on other variants', async () => {
    attributeService.getProductVariants.mockResolvedValue({ data: { data: [
      { id: 'first', optionLabel: 'First', price: 100, stockQty: 26, reservedQty: 0, images: [] },
      { id: 'second', optionLabel: 'Second', price: 100, stockQty: 5, reservedQty: 0, images: [] },
    ] } });
    render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Second', exact: true }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'MRP', exact: true }), { target: { value: '175' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete First', exact: true }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete variant?' }));
    expect(dialog.getByText(/26 units/)).toBeInTheDocument();
    expect(attributeService.deleteProductVariant).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: 'Delete variant', exact: true }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'First', exact: true })).not.toBeInTheDocument());
    expect(attributeService.deleteProductVariant).toHaveBeenCalledWith('product', 'first');
    expect(screen.getByLabelText('MRP')).toHaveValue(175);
    expect(screen.getByRole('button', { name: 'Save variant changes' })).toBeEnabled();
    expect(attributeService.getProductVariants).toHaveBeenCalledTimes(1);
  });
  it('updates the product quantity when the last stocked variant is deleted', async () => {
    const stockChanged = vi.fn(); render(tree({ onStockTotalChange: stockChanged }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete variant', exact: true }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete variant', exact: true }));
    await screen.findByText('No variants yet');
    expect(stockChanged).toHaveBeenCalledWith(0, 0, 0);
  });
  it('keeps a reserved variant and explains the active order restriction', async () => {
    attributeService.getProductVariants.mockResolvedValue({ data: { data: [{ id: 'variant', price: 100, stockQty: 26, reservedQty: 2, options: [], images: [] }] } });
    render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'Delete variant', exact: true }));
    await screen.findByText(/2 units reserved for active orders/);
    expect(attributeService.deleteProductVariant).not.toHaveBeenCalled();
  });
  it('keeps the variant when deletion fails or is cancelled', async () => {
    attributeService.deleteProductVariant.mockRejectedValue(new Error('Delete failed'));
    render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'Delete variant', exact: true }));
    const cancelledDialog = await screen.findByRole('dialog');
    fireEvent.click(within(cancelledDialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(cancelledDialog).not.toBeInTheDocument());
    expect(attributeService.deleteProductVariant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete variant', exact: true }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete variant', exact: true }));
    await screen.findByText('Delete failed');
    expect(await screen.findByRole('button', { name: 'Variant SKU', exact: true })).toBeInTheDocument();
  });

});
