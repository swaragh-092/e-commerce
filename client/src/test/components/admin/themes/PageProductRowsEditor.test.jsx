import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PageProductRowsEditor from '../../../../components/admin/themes/designer/PageProductRowsEditor';

const EditorHarness = () => {
  const [rows, setRows] = useState([]);
  return <PageProductRowsEditor rows={rows} onChange={setRows} />;
};

describe('page product row editor', () => {
  it('adds a configurable trending row to the page', () => {
    render(<EditorHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Add product row' }));

    expect(screen.getByDisplayValue('Trending products')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Products to show' })).toHaveTextContent('Trending / most viewed');
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
  });
});
