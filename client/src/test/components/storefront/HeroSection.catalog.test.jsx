import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HeroSection from '../../../components/storefront/sections/HeroSection';
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => ({ mode: 'catalog', settings: {} }) }));
describe('catalog default hero copy', () => {
  it.each(['live', 'preview'])('adapts legacy defaults in %s and preserves custom text', (mode) => {
    const { rerender } = render(<HeroSection mode={mode} slides={[{ title: 'Everything your cart has been waiting for' }]} />);
    expect(screen.getByRole('heading', { name: 'Discover your next favorite' })).toBeInTheDocument();
    rerender(<HeroSection mode={mode} slides={[{ title: 'Our custom cart story' }]} />);
    expect(screen.getByRole('heading', { name: 'Our custom cart story' })).toBeInTheDocument();
  });
});
