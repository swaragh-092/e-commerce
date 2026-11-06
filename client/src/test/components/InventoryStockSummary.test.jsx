import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InventoryStockSummary from '../../components/admin/InventoryStockSummary';

describe('inventory stock breakdown', () => {
  it('shows the warned SKU separately from the combined product total', () => {
    render(<InventoryStockSummary tracksVariants enabled published selectedVariantId="warned" variants={[
      { id: 'warned', sku: 'iga-FRUITs-WEIGHTs', stockQty: 22, reservedQty: 19 },
      { id: 'other', sku: 'iga-other', stockQty: 28, reservedQty: 8 },
    ]} />);
    expect(screen.getByText(/On hand:/)).toHaveTextContent('On hand: 50 · Reserved: 27 · Available to sell: 23');
    const row = screen.getByRole('row', { name: /iga-FRUITs-WEIGHTs/ });
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      expect.stringContaining('Selected from inventory alert'), '22', '19', '3',
    ]);
  });
  it('shows disabled SKU stock and reservations while excluding it from availability', () => {
    render(<InventoryStockSummary tracksVariants enabled published variants={[{ id: 'disabled', sku: 'IGA-DISABLED', stockQty: 22, reservedQty: 19, isActive: false }]} />);
    const row = screen.getByRole('row', { name: /IGA-DISABLED/ });
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['IGA-DISABLEDDisabled', '22', '19', '0']);
  });
  it('reports an unavailable deep-linked variant instead of highlighting another SKU', () => {
    render(<InventoryStockSummary tracksVariants enabled published selectedVariantId="deleted" variants={[]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('selected variant is no longer available');
  });
  it('keeps disabled reservations separate from active available stock', () => {
    render(<InventoryStockSummary tracksVariants enabled published variants={[
      { stockQty: 22, reservedQty: 19 },
      { stockQty: 30, reservedQty: 26 },
      { stockQty: 40, reservedQty: 10, isActive: false },
    ]} />);
    expect(screen.getByLabelText('Inventory stock breakdown')).toHaveTextContent('On hand: 52 · Reserved: 45 · Available to sell: 7');
    expect(screen.getByText(/Disabled variants:/)).toHaveTextContent('40 on hand, 10 reserved');
  });
  it('shows zero rather than stale parent stock without active variants', () => {
    render(<InventoryStockSummary tracksVariants enabled published quantity={99} variants={[]} />);
    expect(screen.getByText(/On hand:/)).toHaveTextContent('On hand: 0 · Reserved: 0 · Available to sell: 0');
    expect(screen.getByText(/No active variants/)).toBeInTheDocument();
  });
  it('does not let over-reserved variants reduce another variant’s available stock', () => {
    render(<InventoryStockSummary tracksVariants enabled published variants={[{ stockQty: 2, reservedQty: 4 }, { stockQty: 5, reservedQty: 1, _dirty: true }]} />);
    expect(screen.getByText(/On hand:/)).toHaveTextContent('Available to sell: 4');
    expect(screen.getByText(/Includes unsaved/)).toBeInTheDocument();
  });
  it('explains stockout without switching off the product', () => {
    render(<InventoryStockSummary enabled published quantity={4} reservedQty={4} />);
    expect(screen.getByText(/Out of stock/)).toHaveTextContent('enabled setting stays unchanged');
  });
});
