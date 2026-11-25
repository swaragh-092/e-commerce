import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ComposedHero from '../../../components/storefront/sections/ComposedHero';

vi.mock('../../../components/storefront/EnquiryModal', () => ({ default: () => null }));

it('applies heading typography while preserving heading semantics', () => {
  render(<ComposedHero embedded section={{ id: 'hero', heroBlocks: [{
    id: 'heading', type: 'heading', text: 'Market', textAlign: 'center', textSize: 'small', textWeight: 'bold',
  }] }} />);
  const heading = screen.getByRole('heading', { level: 2, name: 'Market' });
  expect(heading).toHaveClass('MuiTypography-h4');
  expect(heading).toHaveStyle({ textAlign: 'center', fontWeight: '700' });
});

it('resolves the current product name and uses manual text when it is unavailable', () => {
  const section = { id: 'hero', heroBlocks: [{ id: 'heading', type: 'heading', text: 'Fallback', binding: 'productName' }] };
  const { rerender } = render(<ComposedHero embedded section={section} product={{ name: 'Olive oil' }} />);
  expect(screen.getByRole('heading', { name: 'Olive oil' })).toBeVisible();
  rerender(<ComposedHero embedded section={section} product={{}} />);
  expect(screen.getByRole('heading', { name: 'Fallback' })).toBeVisible();
});

it('skips hidden nested blocks and keeps the remaining siblings visible', () => {
  render(<ComposedHero embedded section={{ id: 'hero', heroBlocks: [{
    id: 'group', type: 'group', children: [
      { id: 'hidden', type: 'heading', text: 'Hidden heading', enabled: false },
      { id: 'visible', type: 'text', text: 'Visible text' },
    ],
  }] }} />);
  expect(screen.getByText('Visible text')).toBeVisible();
  expect(screen.queryByText('Hidden heading')).not.toBeInTheDocument();
});

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
