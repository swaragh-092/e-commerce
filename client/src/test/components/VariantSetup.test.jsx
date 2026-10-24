import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VariantSetup from '../../components/admin/VariantSetup';
import attributeService from '../../services/attributeService';
import { NotificationProvider } from '../../context/NotificationContext';

vi.mock('../../services/attributeService', () => ({ default: { previewVariantGeneration: vi.fn(), bulkGenerateVariants: vi.fn() } }));
const row = (id, attributeId = 'height') => ({ attributeId, valueId: id, isVariantAttr: true, attribute: { id: attributeId, name: attributeId }, value: { value: id, unitLabel: 'cm' } });
const rows = [row('10'), row('20')];
const review = { token: 'a'.repeat(64), total: 2, addedCount: 2, keptCount: 0, removedCount: 0, blockedRemovalCount: 0, combinations: [{ valueIds: ['10'], label: '10 cm', isNew: true }, { valueIds: ['20'], label: '20 cm', isNew: true }], removals: [] };
const onCreated = vi.fn();
const onBusyChange = vi.fn();
const tree = (props = {}) => <NotificationProvider><VariantSetup productId="product" rows={rows} variants={[]} basePrice={100} canManage onCreated={onCreated} onBusyChange={onBusyChange} {...props} /></NotificationProvider>;
beforeEach(() => {
  vi.clearAllMocks();
  attributeService.previewVariantGeneration.mockResolvedValue({ data: { data: review } });
  attributeService.bulkGenerateVariants.mockResolvedValue({ data: { data: [] } });
});

describe('guided variant setup', () => {
  it('sets new variant prices by one attribute while preserving selected combinations and stock', async () => {
    const rows = [
      ['days', 'early', 'Flowering Days', 'Early'], ['days', 'late', 'Flowering Days', 'Late'],
      ['colour', 'red', 'Flower Colour', 'Red'], ['colour', 'yellow', 'Flower Colour', 'Yellow'],
    ].map(([attributeId, valueId, name, value]) => ({ attributeId, valueId, attribute: { name }, value: { value }, isVariantAttr: true }));
    const combinations = ['early', 'late'].flatMap((days) => ['red', 'yellow'].map((colour) => ({ valueIds: [days, colour], label: `${days}/${colour}`, isNew: true })));
    attributeService.previewVariantGeneration.mockResolvedValue({ data: { data: { ...review, total: 4, addedCount: 4, combinations } } });
    render(tree({ rows }));
    fireEvent.click(screen.getByRole('button', { name: 'Create 4 variants' }));
    const parent = within(await screen.findByRole('dialog', { name: 'Create variants' }));
    fireEvent.change(within(parent.getByRole('group', { name: 'early/red' })).getByLabelText('Stock'), { target: { value: '7' } });
    fireEvent.click(within(parent.getByRole('group', { name: 'late/yellow' })).getByRole('checkbox'));
    fireEvent.click(parent.getByRole('button', { name: 'Set prices by attribute' }));
    const pricing = within(await screen.findByRole('dialog', { name: 'Set prices by attribute' }));
    fireEvent.click(pricing.getByRole('checkbox', { name: 'Flowering Days' }));
    fireEvent.change(pricing.getByLabelText('MRP for Flowering Days: Early'), { target: { value: '45' } });
    fireEvent.change(pricing.getByLabelText('MRP for Flowering Days: Late'), { target: { value: '60' } });
    fireEvent.click(pricing.getByRole('button', { name: 'Apply prices to draft' }));
    expect(attributeService.bulkGenerateVariants).not.toHaveBeenCalled();
    fireEvent.click(await parent.findByRole('button', { name: 'Create 3 variants' }));
    await waitFor(() => expect(attributeService.bulkGenerateVariants).toHaveBeenCalledWith('product', expect.objectContaining({ newVariants: [
      { valueIds: ['early', 'red'], price: 45, stockQty: 7 },
      { valueIds: ['early', 'yellow'], price: 45, stockQty: 0 },
      { valueIds: ['late', 'red'], price: 60, stockQty: 0 },
    ] })));
  });

  it('guides users to select attributes before offering creation', () => {
    render(tree({ rows: [] }));
    expect(screen.getByText('Start with your product options')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create/ })).not.toBeInTheDocument();
  });
  it('counts combinations rather than individual values', () => {
    render(tree({ rows: [...rows, row('S', 'size'), row('L', 'size'), row('L', 'size')] }));
    expect(screen.getByRole('button', { name: 'Create 4 variants' })).toBeEnabled();
    expect(attributeService.bulkGenerateVariants).not.toHaveBeenCalled();
  });
  it('previews units, allows starting values, and creates only after confirmation', async () => {
    render(tree());
    fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create variants' });
    expect(within(dialog).getByText('10 cm')).toBeInTheDocument();
    expect(attributeService.bulkGenerateVariants).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Starting MRP'), { target: { value: '125.50' } });
    fireEvent.change(within(dialog).getByLabelText('Starting stock'), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create 2 variants' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(attributeService.bulkGenerateVariants).toHaveBeenCalledWith('product', { planToken: review.token, confirmRemovals: false, newVariants: [
      { valueIds: ['10'], price: 125.5, stockQty: 3 }, { valueIds: ['20'], price: 125.5, stockQty: 3 },
    ] });
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });
  it('cancels without creating records', async () => {
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Back' }));
    expect(attributeService.bulkGenerateVariants).not.toHaveBeenCalled();
  });
  it('saves distinct prices and stock only for the selected combinations', async () => {
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    const dialog = within(await screen.findByRole('dialog'));
    const first = within(dialog.getByRole('group', { name: '10 cm' }));
    fireEvent.change(first.getByLabelText('MRP'), { target: { value: '199.50' } });
    fireEvent.change(first.getByLabelText('Stock'), { target: { value: '7' } });
    const second = within(dialog.getByRole('group', { name: '20 cm' }));
    fireEvent.change(second.getByLabelText('MRP'), { target: { value: '249' } });
    fireEvent.change(second.getByLabelText('Stock'), { target: { value: '2' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Create 2 variants' }));
    await waitFor(() => expect(attributeService.bulkGenerateVariants).toHaveBeenCalledWith('product', expect.objectContaining({ newVariants: [
      { valueIds: ['10'], price: 199.5, stockQty: 7 }, { valueIds: ['20'], price: 249, stockQty: 2 },
    ] })));
  });
  it('skips unchecked combinations and ignores their invalid fields', async () => {
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    const dialog = within(await screen.findByRole('dialog'));
    const second = within(dialog.getByRole('group', { name: '20 cm' }));
    fireEvent.change(second.getByLabelText('Stock'), { target: { value: '1.5' } });
    expect(dialog.getByRole('button', { name: 'Create 2 variants' })).toBeDisabled();
    fireEvent.click(second.getByRole('checkbox'));
    expect(second.getByLabelText('Stock')).toBeDisabled();
    fireEvent.click(dialog.getByRole('button', { name: 'Create 1 variant' }));
    await waitFor(() => expect(attributeService.bulkGenerateVariants).toHaveBeenCalledWith('product', expect.objectContaining({ newVariants: [{ valueIds: ['10'], price: 100, stockQty: 0 }] })));
  });
  it('keeps individual overrides until defaults are explicitly applied to selected rows', async () => {
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    const dialog = within(await screen.findByRole('dialog'));
    const first = within(dialog.getByRole('group', { name: '10 cm' }));
    fireEvent.change(first.getByLabelText('MRP'), { target: { value: '199' } });
    fireEvent.change(dialog.getByLabelText('Starting MRP'), { target: { value: '250' } });
    expect(first.getByLabelText('MRP')).toHaveValue(199);
    fireEvent.click(dialog.getByRole('button', { name: 'Apply defaults to selected' }));
    expect(first.getByLabelText('MRP')).toHaveValue(250);
    fireEvent.click(dialog.getByRole('button', { name: 'Deselect all new' }));
    expect(dialog.getByRole('button', { name: 'Create 0 variants' })).toBeDisabled();
    fireEvent.click(dialog.getByRole('button', { name: 'Select all new' }));
    expect(dialog.getByRole('button', { name: 'Create 2 variants' })).toBeEnabled();
  });
  it('preserves edited combination values after a failed save', async () => {
    attributeService.bulkGenerateVariants.mockRejectedValueOnce(new Error('Offline'));
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    const dialog = within(await screen.findByRole('dialog'));
    const first = within(dialog.getByRole('group', { name: '10 cm' }));
    fireEvent.change(first.getByLabelText('Stock'), { target: { value: '9' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Create 2 variants' }));
    await screen.findByText('Offline');
    expect(first.getByLabelText('Stock')).toHaveValue(9);
    fireEvent.click(dialog.getByRole('button', { name: 'Create 2 variants' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(attributeService.bulkGenerateVariants.mock.calls[0]).toEqual(attributeService.bulkGenerateVariants.mock.calls[1]);
  });
  it('searches and edits combinations beyond the original preview limit', async () => {
    const combinations = Array.from({ length: 15 }, (_, index) => ({ valueIds: [`v${index}`], label: `Option ${index}`, isNew: true }));
    attributeService.previewVariantGeneration.mockResolvedValue({ data: { data: { ...review, total: 15, addedCount: 15, combinations } } });
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Find a combination'), { target: { value: 'Option 14' } });
    expect(dialog.queryByRole('group', { name: 'Option 0', exact: true })).not.toBeInTheDocument();
    fireEvent.change(within(dialog.getByRole('group', { name: 'Option 14' })).getByLabelText('MRP'), { target: { value: '350' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Create 15 variants' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const payload = attributeService.bulkGenerateVariants.mock.calls[0][1];
    expect(payload.newVariants).toHaveLength(15);
    expect(payload.newVariants[14]).toEqual({ valueIds: ['v14'], price: 350, stockQty: 0 });
  });
  it('requires saving edits before updating options', () => {
    render(tree({ hasUnsavedChanges: true }));
    expect(screen.getByRole('button', { name: 'Create 2 variants' })).toBeDisabled();
    expect(screen.getByText(/Save your price, stock, or image changes/)).toBeInTheDocument();
  });
  it('keeps starting values after a failed request so it can be retried', async () => {
    attributeService.bulkGenerateVariants.mockRejectedValueOnce(new Error('Offline'));
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Starting MRP'), { target: { value: '175' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Create 2 variants' }));
    await screen.findByText('Offline');
    expect(dialog.getByLabelText('Starting MRP')).toHaveValue(175);
    fireEvent.click(dialog.getByRole('button', { name: 'Create 2 variants' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });
  it('blocks invalid stock and price before submitting', async () => {
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Starting stock'), { target: { value: '1.5' } });
    expect(dialog.getByRole('button', { name: 'Create 2 variants' })).toBeDisabled();
    fireEvent.change(dialog.getByLabelText('Starting stock'), { target: { value: '0' } });
    fireEvent.change(dialog.getByLabelText('Starting MRP'), { target: { value: '-5' } });
    expect(dialog.getByRole('button', { name: 'Create 2 variants' })).toBeDisabled();
  });
  it('requires a separate acknowledgement before removing old combinations', async () => {
    attributeService.previewVariantGeneration.mockResolvedValue({ data: { data: { ...review, removedCount: 1, removals: [{ id: 'old', label: '30 cm', stockQty: 0, reservedQty: 0 }] } } });
    render(tree({ variants: [{ id: 'old', options: [{ attributeId: 'height', valueId: '30' }] }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Review option changes' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    fireEvent.click(dialog.getByRole('checkbox', { name: /Remove 1 variant/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Apply changes' }));
    await waitFor(() => expect(attributeService.bulkGenerateVariants).toHaveBeenCalledWith('product', expect.objectContaining({ confirmRemovals: true })));
  });
  it('blocks removals with inventory and explains how to resolve them', async () => {
    attributeService.previewVariantGeneration.mockResolvedValue({ data: { data: { ...review, removedCount: 1, blockedRemovalCount: 1, removals: [{ id: 'old', label: '30 cm', stockQty: 5, reservedQty: 1 }] } } });
    render(tree({ variants: [{ id: 'old', options: [] }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Review option changes' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    expect(dialog.getByText(/reserved for active orders/)).toBeInTheDocument();
  });
  it('requires a fresh review when server state changes', async () => {
    attributeService.bulkGenerateVariants.mockRejectedValueOnce({ response: { status: 409, data: { error: { message: 'Options changed' } } } });
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Create 2 variants' }));
    await screen.findByText('Options changed');
    expect(dialog.getByRole('button', { name: 'Create 2 variants' })).toBeDisabled();
    expect(dialog.getByText(/product changed after this preview/)).toBeInTheDocument();
  });
  it('does not offer generation when all selected combinations already exist', () => {
    render(tree({ variants: [{ options: [{ attributeId: 'height', valueId: '10' }] }, { options: [{ attributeId: 'height', valueId: '20' }] }] }));
    expect(screen.getByText('Your variants are ready')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create|Review/ })).not.toBeInTheDocument();
  });
  it('handles excessive combinations without enumerating or requesting them', () => {
    const many = Array.from({ length: 23 }, (_, index) => [row(String(index)), row(String(index), 'size')]).flat();
    render(tree({ rows: many }));
    expect(screen.getByText(/up to 500 variant combinations/)).toBeInTheDocument();
    expect(attributeService.previewVariantGeneration).not.toHaveBeenCalled();
  });
  it('shows a request failure and allows preview to be retried', async () => {
    attributeService.previewVariantGeneration.mockRejectedValueOnce(new Error('Preview unavailable'));
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    await screen.findByText('Preview unavailable');
    expect(screen.getByRole('button', { name: 'Create 2 variants' })).toBeEnabled();
    expect(onCreated).not.toHaveBeenCalled();
  });
  it('refreshes existing variants after a previous successful write lost its response', async () => {
    attributeService.previewVariantGeneration.mockResolvedValue({ data: { data: { ...review, addedCount: 0, keptCount: 2 } } });
    render(tree()); fireEvent.click(screen.getByRole('button', { name: 'Create 2 variants' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(attributeService.bulkGenerateVariants).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('accepts a custom subset without forcing all possible combinations', () => {
    render(tree({ variants: [{ options: [{ attributeId: 'height', valueId: '10' }] }] }));
    expect(screen.getByText('Your variants are ready')).toBeInTheDocument();
    expect(screen.getByText(/1 variant selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add missing variants' })).toBeEnabled();
    expect(screen.queryByText('Your options have changed')).not.toBeInTheDocument();
    expect(attributeService.bulkGenerateVariants).not.toHaveBeenCalled();
  });
  it('allows ordinary stock to be removed through the acknowledged review', async () => {
    attributeService.previewVariantGeneration.mockResolvedValue({ data: { data: { ...review, removedCount: 1, removals: [{ id: 'old', label: '30 cm', stockQty: 26, reservedQty: 0 }] } } });
    render(tree({ variants: [{ id: 'old', options: [] }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Review option changes' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/26 units/)).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('checkbox', { name: /Remove 1 variant/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Apply changes' }));
    await waitFor(() => expect(attributeService.bulkGenerateVariants).toHaveBeenCalledWith('product', expect.objectContaining({ confirmRemovals: true })));
  });

});
