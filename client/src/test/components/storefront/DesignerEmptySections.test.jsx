import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SettingsContext } from '../../../context/ThemeContext';
import ContentGridSection from '../../../components/storefront/sections/ContentGridSection';
import GallerySection from '../../../components/storefront/sections/GallerySection';
import HomeExperience from '../../../pages/storefront/HomeExperience';

vi.mock('../../../components/common/PageSEO', () => ({ default: () => null }));

it('shows instructions for empty gallery and testimonial sections only in preview', () => {
  const sections = (preview) => <SettingsContext.Provider value={{ features: { gallery: true } }}>
    <GallerySection frameProps={{ section: { id: 'gallery', type: 'gallery' }, preview }} />
    <ContentGridSection section={{ type: 'testimonials', items: [] }} mode={preview ? 'preview' : 'live'} />
  </SettingsContext.Provider>;
  const { rerender } = render(sections(true));
  expect(screen.getByText('Choose an album in the section settings.')).toBeInTheDocument();
  expect(screen.getByText('Add a testimonial in the section settings to display it here.')).toBeInTheDocument();

  rerender(sections(false));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('keeps the feature-disabled gallery discoverable only in Designer preview', () => {
  const originalUrl = window.location.href;
  const settings = { homepage: { sections: [{ id: 'gallery', type: 'gallery', enabled: true }] } };
  const home = () => <SettingsContext.Provider value={{ settings, features: { gallery: false } }}>
    <HomeExperience />
  </SettingsContext.Provider>;
  try {
    window.history.replaceState(null, '', '/?previewMode=1');
    const { rerender } = render(home());
    expect(screen.getByText('Enable Gallery in Features to display this section.')).toBeInTheDocument();
    window.history.replaceState(null, '', '/');
    rerender(home());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  } finally {
    window.history.replaceState(null, '', originalUrl);
  }
});
