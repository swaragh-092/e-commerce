import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VariantSelector from '../../components/product/VariantSelector';

const variants = (displayType, value = {}) => ['Red', 'Blue'].map((name, index) => ({
  id: `variant-${index}`, stockQty: index === 0 ? 3 : 0,
  options: [{ attribute: { id: 'color', name: 'Color', displayType }, value: { id: `value-${index}`, value: name, ...value } }],
}));

describe('storefront attribute styles', () => {
  it.each(['button', 'chip', 'text', 'swatch', 'image'])('%s selects the correct variant and blocks unavailable choices', (style) => {
    const onSelect = vi.fn();
    const options = variants(style);
    render(<VariantSelector variants={options} onSelect={onSelect} />);
    const available = screen.getByRole('button', { name: 'Color, Red' });
    const unavailable = screen.getByRole('button', { name: 'Color, Blue, unavailable' });
    expect(unavailable.hasAttribute('disabled') || unavailable.getAttribute('aria-disabled') === 'true').toBe(true);
    fireEvent.click(unavailable);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(available);
    expect(onSelect).toHaveBeenCalledWith(options[0]);
    expect(available).toHaveAttribute('aria-pressed', 'true');
    if (style === 'text') expect(available).toHaveClass('MuiButton-text');
  });
  it.each(['swatch', 'image'])('%s keeps labels visible when a value has no visual', (style) => {
    render(<VariantSelector variants={variants(style, { value: 'Floral' })} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Color, Floral' })).toHaveTextContent('Floral');
  });
  it('honors color swatches even when a value also has an image', () => {
    render(<VariantSelector variants={variants('swatch', { imageUrl: '/pattern.jpg' })} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Color, Red' }).firstChild).toHaveStyle({ backgroundColor: '#dc2626' });
    expect(screen.getByRole('button', { name: 'Color, Red' }).firstChild).not.toHaveStyle({ backgroundImage: 'url(/pattern.jpg)' });
  });
  it('shows an image for image swatches', () => {
    render(<VariantSelector variants={variants('image', { imageUrl: '/pattern.jpg' })} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Color, Red' }).firstChild).toHaveStyle({ backgroundImage: 'url(/pattern.jpg)' });
  });
  it('supports radio selection and stock availability', () => {
    const onSelect = vi.fn(); const options = variants('radio');
    render(<VariantSelector variants={options} onSelect={onSelect} />);
    expect(screen.getByRole('radio', { name: 'Blue' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    expect(onSelect).toHaveBeenCalledWith(options[0]);
  });
  it('supports an accessible dropdown and stock availability', () => {
    const onSelect = vi.fn(); const options = variants('dropdown');
    render(<VariantSelector variants={options} onSelect={onSelect} />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Color' }));
    expect(screen.getByRole('option', { name: 'Blue' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('option', { name: 'Red' }));
    expect(onSelect).toHaveBeenCalledWith(options[0]);
  });
});
