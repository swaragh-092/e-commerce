import React, { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductAttributesSection from '../../components/admin/ProductAttributesSection';
import { NotificationProvider } from '../../context/NotificationContext';
import attributeService from '../../services/attributeService';
import { getVariantAttributeGroups } from '../../utils/variantOptions';

const dnd = vi.hoisted(() => ({ end: null }));
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ onDragEnd, children }) => { dnd.end = onDragEnd; return children; },
  Droppable: ({ children }) => children({ innerRef: () => {}, droppableProps: {}, placeholder: null }),
  Draggable: ({ children, isDragDisabled }) => children({ innerRef: () => {}, draggableProps: {}, dragHandleProps: { role: 'button', tabIndex: isDragDisabled ? -1 : 0, 'aria-disabled': isDragDisabled } }, { isDragging: false }),
}));
vi.mock('../../services/attributeService', () => ({ default: { reorderProductAttributes: vi.fn() } }));
vi.mock('../../components/admin/ProductAttributeDialog', () => ({ default: () => null }));
const initial = [
  { id: 'a1', attributeId: 'volume', valueId: 'small', attribute: { id: 'volume', name: 'Volume' }, value: { value: '250ml' } },
  { id: 'a2', attributeId: 'volume', valueId: 'large', attribute: { id: 'volume', name: 'Volume' }, value: { value: '500ml' } },
  { id: 'b1', attributeId: 'color', valueId: 'red', attribute: { id: 'color', name: 'Color' }, value: { value: 'Red' } },
  { id: 'b2', attributeId: 'color', valueId: 'blue', attribute: { id: 'color', name: 'Color' }, value: { value: 'Blue' } },
];
function Harness({ canManage = true }) {
  const [rows, setRows] = useState(initial);
  return <NotificationProvider><ProductAttributesSection productId="product" rows={rows} templates={[]} canManage={canManage} onRowsChange={setRows} /></NotificationProvider>;
}
const drop = async (type, droppableId, from, to) => act(async () => { await dnd.end({ type, source: { droppableId, index: from }, destination: { droppableId, index: to } }); });
beforeEach(() => {
  vi.clearAllMocks();
  attributeService.reorderProductAttributes.mockImplementation(async (_, ids) => ({ data: { data: ids.map((id, sortOrder) => ({ ...initial.find((row) => row.id === id), sortOrder })) } }));
});

describe('product attribute drag order', () => {
  it('moves complete attribute groups and saves their value assignments atomically', async () => {
    render(<Harness />);
    await drop('ATTRIBUTE', 'product-attributes', 1, 0);
    expect(attributeService.reorderProductAttributes).toHaveBeenCalledWith('product', ['b1', 'b2', 'a1', 'a2']);
    const handles = within(screen.getByRole('list', { name: 'Product attribute order' })).getAllByRole('button', { name: /^Reorder (Volume|Color)$/ });
    expect(handles[0]).toHaveAccessibleName('Reorder Color');
    expect(await screen.findByRole('alert')).toHaveTextContent('order saved');
  });
  it('moves a value within its own attribute without moving other groups', async () => {
    render(<Harness />);
    await drop('VALUE:color', 'values:color', 1, 0);
    expect(attributeService.reorderProductAttributes).toHaveBeenCalledWith('product', ['a1', 'a2', 'b2', 'b1']);
    expect(within(screen.getByRole('list', { name: 'Color value order' })).getAllByRole('listitem')[0]).toHaveTextContent('Blue');
  });
  it('restores the previous order when saving fails', async () => {
    attributeService.reorderProductAttributes.mockRejectedValueOnce(new Error('Offline. Refresh and retry.'));
    render(<Harness />); await drop('ATTRIBUTE', 'product-attributes', 1, 0);
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
    expect(screen.getAllByRole('button', { name: /^Reorder (Volume|Color)$/ })[0]).toHaveAccessibleName('Reorder Volume');
  });
  it('does not save cancelled drops, no-ops, or moves without permission', async () => {
    render(<Harness canManage={false} />);
    expect(screen.queryByRole('button', { name: /^Reorder/ })).not.toBeInTheDocument();
    await drop('ATTRIBUTE', 'product-attributes', 1, 0);
    expect(attributeService.reorderProductAttributes).not.toHaveBeenCalled();
  });
  it('ignores cancelled drops, no-ops, and attempts to move a value into another attribute', async () => {
    render(<Harness />);
    await act(async () => { await dnd.end({ destination: null }); });
    await drop('ATTRIBUTE', 'product-attributes', 0, 0);
    await act(async () => { await dnd.end({ type: 'VALUE:color', source: { droppableId: 'values:color', index: 0 }, destination: { droppableId: 'values:volume', index: 0 } }); });
    expect(attributeService.reorderProductAttributes).not.toHaveBeenCalled();
  });
  it('keeps drag controls disabled while the new order is saving', async () => {
    let finish;
    attributeService.reorderProductAttributes.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<Harness />);
    act(() => { dnd.end({ type: 'ATTRIBUTE', source: { droppableId: 'product-attributes', index: 1 }, destination: { droppableId: 'product-attributes', index: 0 } }); });
    expect(screen.getByRole('button', { name: 'Reorder Color' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Updating');
    await act(async () => finish({ data: { data: initial } }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reorder Color' })).toHaveAttribute('aria-disabled', 'false'));
  });
  it('renders storefront groups and choices by API order rather than variant insertion order', () => {
    const makeVariant = (color, order) => ({ options: [
      { attribute: { id: 'volume', name: 'Volume' }, value: { id: 'small', value: '250ml' }, attributeOrder: 1, valueOrder: 0 },
      { attribute: { id: 'color', name: 'Color' }, value: { id: color, value: color }, attributeOrder: 0, valueOrder: order },
    ] });
    const groups = getVariantAttributeGroups([makeVariant('Red', 1), makeVariant('Blue', 0)]);
    expect(groups.map((group) => group.attributeName)).toEqual(['Color', 'Volume']);
    expect(groups[0].values.map((value) => value.value)).toEqual(['Blue', 'Red']);
  });
});
