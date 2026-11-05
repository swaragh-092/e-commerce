import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import InventoryWarningsWidget from '../../components/admin/dashboard/InventoryWarningsWidget';

describe('inventory warning identity', () => {
  it('distinguishes two low-stock variants of the same product', () => {
    render(<MemoryRouter><InventoryWarningsWidget spacing={2} lowStock={[
      { id: 'product', name: 'IGA', inventoryKey: 'variant:a', variantId: 'a', sku: 'IGA-250G', availableQty: 3 },
      { id: 'product', name: 'IGA', inventoryKey: 'variant:b', variantId: 'b', sku: 'IGA-500G', availableQty: 4 },
    ]} /></MemoryRouter>);
    expect(screen.getByText('Variant · SKU: IGA-250G')).toBeInTheDocument();
    expect(screen.getByText('Variant · SKU: IGA-500G')).toBeInTheDocument();
    expect(screen.getByText('3 available')).toBeInTheDocument();
    expect(screen.getByText('4 available')).toBeInTheDocument();
  });
});
