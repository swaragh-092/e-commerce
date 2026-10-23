import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VariantPriceGroups from '../../components/admin/VariantPriceGroups';

const rows = [
  { attributeId: 'days', valueId: 'early', attribute: { name: 'Flowering Days' }, value: { value: '50–55 days' } },
  { attributeId: 'days', valueId: 'late', attribute: { name: 'Flowering Days' }, value: { value: '60–65 days' } },
  { attributeId: 'colour', valueId: 'red', attribute: { name: 'Flower Colour' }, value: { value: 'Red' } },
  { attributeId: 'colour', valueId: 'yellow', attribute: { name: 'Flower Colour' }, value: { value: 'Yellow' } },
];
const entries = ['early', 'late'].flatMap((days) => ['red', 'yellow'].map((colour, index) => ({
  id: `${days}-${colour}`, price: index ? 30 : 20,
  options: [{ attributeId: 'days', valueId: days }, { attributeId: 'colour', valueId: colour }],
  stockQty: index + 2, sku: `${days}-${colour}`, isActive: index === 0,
})));
const setup = (props = {}) => {
  const onApply = vi.fn();
  render(<VariantPriceGroups rows={rows} entries={entries} onApply={onApply} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Set prices by attribute' }));
  return onApply;
};

describe('shared variant price editor', () => {
  it('prices by flowering days while sharing prices across all colours, including unavailable variants', () => {
    const apply = setup();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flowering Days' }));
    expect(screen.getByRole('checkbox', { name: 'Flower Colour' })).not.toBeChecked();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Apply prices to draft' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('MRP for Flowering Days: 50–55 days'), { target: { value: '45.50' } });
    fireEvent.change(screen.getByLabelText('MRP for Flowering Days: 60–65 days'), { target: { value: '60' } });
    expect(screen.getByText('4 of 4 variant prices will change.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply prices to draft' }));
    expect([...apply.mock.calls[0][0]]).toEqual([
      ['early-red', 45.5], ['early-yellow', 45.5], ['late-red', 60], ['late-yellow', 60],
    ]);
    expect(entries[0].price).toBe(20);
    expect(entries[1].stockQty).toBe(3);
  });

  it('leaves untouched mixed-price groups unchanged', () => {
    const apply = setup();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flowering Days' }));
    fireEvent.change(screen.getByLabelText('MRP for Flowering Days: 50–55 days'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply prices to draft' }));
    expect([...apply.mock.calls[0][0].keys()]).toEqual(['early-red', 'early-yellow']);
  });

  it('can price every variant the same and can group by multiple attributes', () => {
    setup();
    expect(screen.getByLabelText('MRP for All variants')).toHaveValue(null);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flowering Days' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flower Colour' }));
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4);
  });

  it.each(['-1', '1.234', '100000000', ''])('blocks invalid price %s without applying anything', (value) => {
    const apply = setup();
    fireEvent.change(screen.getByLabelText('MRP for All variants'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('MRP for All variants'), { target: { value } });
    expect(screen.getByRole('button', { name: 'Apply prices to draft' })).toBeDisabled();
    expect(apply).not.toHaveBeenCalled();
  });

  it('discards unapplied changes when regrouping or cancelling', () => {
    const apply = setup();
    fireEvent.change(screen.getByLabelText('MRP for All variants'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flowering Days' }));
    expect(screen.getByRole('button', { name: 'Apply prices to draft' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(apply).not.toHaveBeenCalled();
  });

  it('does not offer editing without permission or while busy', () => {
    render(<VariantPriceGroups rows={rows} entries={entries} disabled onApply={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Set prices by attribute' })).toBeDisabled();
  });
});
