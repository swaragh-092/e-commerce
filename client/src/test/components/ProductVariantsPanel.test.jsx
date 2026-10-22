import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductVariantsPanel from '../../components/admin/ProductVariantsPanel';
import { NotificationProvider } from '../../context/NotificationContext';
import { UnitCatalogProvider } from '../../context/UnitCatalogContext';
import attributeService from '../../services/attributeService';
import settingsService from '../../services/settingsService';
import { getProductById } from '../../services/productService';

const permission = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => permission.allowed }) }));
vi.mock('../../hooks/useSKUGenerator', () => ({ default: () => ({ generateProductSKU: vi.fn(), generateVariantSKU: vi.fn() }) }));
vi.mock('../../components/common/MediaPicker', () => ({ default: () => null }));
vi.mock('../../services/productService', () => ({ getProductById: vi.fn(), getProducts: vi.fn() }));
vi.mock('../../services/settingsService', () => ({ default: { getSettingsGroup: vi.fn() } }));
vi.mock('../../services/attributeService', () => ({ default: { getProductAttributes: vi.fn(), getProductVariants: vi.fn(), getAttributes: vi.fn(), getCategoryAttributes: vi.fn(), getAttributeById: vi.fn(), assignProductAttribute: vi.fn(), deleteProductVariant: vi.fn() } }));
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
});

describe('product attributes and variant drafts', () => {
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
