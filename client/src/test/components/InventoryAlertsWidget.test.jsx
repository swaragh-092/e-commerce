import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import InventoryAlertsWidget from '../../components/admin/dashboard/InventoryAlertsWidget';

function CurrentPath() {
  const location = useLocation();
  return <output aria-label="Opened inventory">{location.pathname}{location.search}</output>;
}

describe('inventory alert navigation', () => {
  it.each([['variant-1', '?variantId=variant-1'], [null, '']])('opens the correct inventory target for variant %s', (variantId, search) => {
    render(<MemoryRouter><InventoryAlertsWidget spacing={{ panel: 2 }} lowStock={[
      { id: 'product', inventoryKey: variantId ? `variant:${variantId}` : 'product:product', variantId, name: 'IGA', sku: 'IGA-LOW', quantity: 22, reservedQty: 19, availableQty: 3, threshold: 10 },
    ]} /><CurrentPath /></MemoryRouter>);
    fireEvent.click(screen.getByRole('row', { name: /IGA-LOW/ }));
    expect(screen.getByLabelText('Opened inventory')).toHaveTextContent(`/admin/products/product/edit${search}`);
  });
});
