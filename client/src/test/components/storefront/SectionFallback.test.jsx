import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionFrame } from '../../../components/storefront/sections/SectionFallback';

describe('SectionFrame', () => {
  it('exposes the selected section to mouse and keyboard users in preview mode', () => {
    const onSelect = vi.fn();

    render(
      <SectionFrame
        section={{ id: 'section-1', type: 'product-row' }}
        preview
        selected
        onSelect={onSelect}
      >
        <div>Preview content</div>
      </SectionFrame>
    );

    const section = screen.getByRole('group', { name: 'Edit Product row section' });
    expect(section).toHaveAttribute('aria-current', 'true');

    fireEvent.keyDown(section, { key: 'Enter' });
    fireEvent.keyDown(section, { key: ' ' });

    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
