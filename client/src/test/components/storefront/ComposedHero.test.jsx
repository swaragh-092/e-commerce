import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ComposedHero from '../../../components/storefront/sections/ComposedHero';

vi.mock('../../../components/storefront/EnquiryModal', () => ({ default: () => null }));

it('reads care instructions from each product and hides the heading when the field is empty', () => {
  const section = { heroBlocks: [{
    id: 'care', type: 'product-attribute', attributeName: 'Care instructions', text: 'Care instructions',
  }] };
  const product = (customValue) => ({ attributes: [{ customName: 'Care instructions', customValue }] });
  const { rerender } = render(<ComposedHero embedded section={section} product={product('Sow in full sun.')} />);
  expect(screen.getByText('Sow in full sun.')).toBeInTheDocument();
  rerender(<ComposedHero embedded section={section} product={product('Keep the soil moist.')} />);
  expect(screen.getByText('Keep the soil moist.')).toBeInTheDocument();
  expect(screen.queryByText('Sow in full sun.')).not.toBeInTheDocument();
  rerender(<ComposedHero embedded section={section} product={product('  ')} />);
  expect(screen.queryByRole('heading', { name: 'Care instructions' })).not.toBeInTheDocument();
});
