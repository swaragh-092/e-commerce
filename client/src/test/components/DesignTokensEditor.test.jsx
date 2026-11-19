import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignTokensEditor from '../../components/admin/themes/DesignTokensEditor';

const Editor = () => {
  const [value, setValue] = useState({ buttonStyle: 'soft', primaryColor: '#2563eb', fontFamily: 'Inter' });
  return <><DesignTokensEditor value={value} onChange={setValue} /><output data-testid="settings">{JSON.stringify(value)}</output></>;
};

describe('Storefront style editing', () => {
  it('keeps settings when switching categories and presents each color once', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Outline button style' }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Edit storefront style' }));
    fireEvent.click(screen.getByRole('option', { name: 'Colors', exact: true }));
    expect(screen.getAllByLabelText('Primary Color')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Primary Color'), { target: { value: '#123456' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Edit storefront style' }));
    fireEvent.click(screen.getByRole('option', { name: 'Buttons', exact: true }));
    expect(screen.getByRole('button', { name: 'Outline button style' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(screen.getByTestId('settings').textContent)).toEqual({ buttonStyle: 'outline', primaryColor: '#123456', fontFamily: 'Inter' });
  });
});
