import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PageProductRowsEditor from '../../../../components/admin/themes/designer/PageProductRowsEditor';

const EditorHarness = () => {
  const [rows, setRows] = useState([]);
  return <PageProductRowsEditor rows={rows} onChange={setRows} />;
};

describe('page product row editor', () => {
  it('adds a configurable row and offers Trending separately from Most Viewed', () => {
    render(<EditorHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Add product row' }));

    expect(screen.getByDisplayValue('Featured products')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Products to show' })).toHaveTextContent('Featured products');
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Products to show' }));
    expect(screen.getByRole('option', { name: 'Most viewed' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Trending This Week' }));
    expect(screen.getByRole('combobox', { name: 'Products to show' })).toHaveTextContent('Trending This Week');
  });
});
