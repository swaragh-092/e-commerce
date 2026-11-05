import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InventoryStockSummary from '../../components/admin/InventoryStockSummary';

describe('inventory stock breakdown', () => {
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
