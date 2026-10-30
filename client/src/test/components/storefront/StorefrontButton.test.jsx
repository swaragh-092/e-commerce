import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StorefrontButton from '../../../components/storefront/StorefrontButton';

describe('StorefrontButton activation', () => {
  it('disables a loading native button and restores activation when ready', () => {
    const onClick = vi.fn();
    const { rerender } = render(<StorefrontButton loading onClick={onClick}>Buy now</StorefrontButton>);
    const button = screen.getByRole('button', { name: 'Buy now' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    rerender(<StorefrontButton onClick={onClick}>Buy now</StorefrontButton>);
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each([{ loading: true }, { disabled: true }, { forcedState: 'loading' }])(
    'blocks pointer and keyboard activation for disabled link buttons: %o', (state) => {
      const onClick = vi.fn();
      render(<StorefrontButton component="a" href="#checkout" onClick={onClick} {...state}>Checkout</StorefrontButton>);
      const link = screen.getByRole('link', { name: 'Checkout' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(fireEvent.click(link)).toBe(false);
      fireEvent.keyDown(link, { key: 'Enter' });
      fireEvent.keyUp(link, { key: ' ' });
      expect(onClick).not.toHaveBeenCalled();
    }
  );
});
