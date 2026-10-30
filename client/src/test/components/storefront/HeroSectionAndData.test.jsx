import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HeroSection from '../../../components/storefront/sections/HeroSection';
import { buildSectionRendererData } from '../../../components/storefront/sections/sectionData';

vi.mock('../../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { theme: { buttonStyle: 'solid' } } }),
}));

describe('HeroSection live and preview synchronization', () => {
  it('makes individual slide headings authoritative over section name', () => {
    const customSection = {
      id: 'hero-1',
      type: 'hero-carousel',
      title: 'Homepage Hero Section',
      subtitle: 'Section Subtitle',
    };

    render(
      <HeroSection
        section={customSection}
        slides={[{ eyebrow: 'New', title: 'Summer Splash 2026', subtitle: 'Dive into exclusive savings' }]}
        mode="live"
      />
    );

    expect(screen.getByRole('heading', { name: 'Summer Splash 2026' })).toBeInTheDocument();
    expect(screen.getByText('Dive into exclusive savings')).toBeInTheDocument();
    expect(screen.queryByText('Homepage Hero Section')).not.toBeInTheDocument();
  });

  it('falls back to section title and subtitle when slide has no title or subtitle', () => {
    const customSection = {
      id: 'hero-1',
      type: 'hero-carousel',
      title: 'Winter Wonder Deals',
      subtitle: 'Exclusive discounts on all seasonal gear',
    };

    render(
      <HeroSection
        section={customSection}
        slides={[{ eyebrow: 'Special', title: '', subtitle: '' }]}
        mode="live"
      />
    );

    expect(screen.getByRole('heading', { name: 'Winter Wonder Deals' })).toBeInTheDocument();
    expect(screen.getByText('Exclusive discounts on all seasonal gear')).toBeInTheDocument();
  });

  it('applies authoritative slide title in preview mode', () => {
    const customSection = {
      id: 'hero-1',
      type: 'hero-carousel',
      title: 'Section Sidebar Name',
      subtitle: 'Section Subtitle',
    };

    render(
      <HeroSection
        section={customSection}
        slides={[{ eyebrow: 'Special', title: 'Preview Headliner', subtitle: 'Draft subtitle preview' }]}
        mode="preview"
      />
    );

    expect(screen.getByRole('heading', { name: 'Preview Headliner' })).toBeInTheDocument();
    expect(screen.getByText('Draft subtitle preview')).toBeInTheDocument();
  });
});

describe('buildSectionRendererData promo banners resolution', () => {
  it('prioritizes section.items for promo banners over demo and fallback content', () => {
    const customItems = [
      { kicker: 'Sale', title: '50% Off Outerwear', subtitle: 'Limited stock', ctaText: 'Shop Now' },
    ];
    const section = {
      id: 'promo-1',
      type: 'promo-banners',
      items: customItems,
    };
    const homepage = {
      promoBanners: [{ title: 'Homepage Default' }],
    };
    const demoContent = {
      promoBanners: [{ title: 'Demo Default' }],
    };

    const result = buildSectionRendererData({ section, homepage, demoContent });

    expect(result.promoBanners).toEqual(customItems);
    expect(result.banners).toEqual(customItems);
  });

  it('falls back to homepage promoBanners when section.items is undefined', () => {
    const section = { id: 'promo-1', type: 'promo-banners' };
    const homepage = { promoBanners: [{ title: 'Homepage Default' }] };
    const demoContent = { promoBanners: [{ title: 'Demo Default' }] };

    const result = buildSectionRendererData({ section, homepage, demoContent });

    expect(result.promoBanners).toEqual([{ title: 'Homepage Default' }]);
    expect(result.banners).toEqual([{ title: 'Homepage Default' }]);
  });

  it('preserves empty array when section.items is explicitly empty', () => {
    const section = { id: 'promo-1', type: 'promo-banners', items: [] };
    const homepage = { promoBanners: [{ title: 'Homepage Default' }] };
    const demoContent = { promoBanners: [{ title: 'Demo Default' }] };

    const result = buildSectionRendererData({ section, homepage, demoContent });

    expect(result.promoBanners).toEqual([]);
    expect(result.banners).toEqual([]);
  });
});
