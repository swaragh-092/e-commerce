import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import CategorySection from '../../../components/storefront/sections/CategorySection';
import BrandShowcaseSection from '../../../components/storefront/sections/BrandShowcaseSection';
import { SettingsContext } from '../../../context/ThemeContext';

vi.mock('../../../services/categoryService', async (importOriginal) => ({
  ...await importOriginal(),
  getCategories: vi.fn().mockResolvedValue([{ id: 'a', slug: 'grocery', name: 'Grocery', children: [
    { id: 'b', slug: 'produce', name: 'Produce' },
  ] }]),
}));
vi.mock('../../../services/brandService', async (importOriginal) => ({
  ...await importOriginal(),
  getBrands: vi.fn().mockResolvedValue({ data: { data: [
    { id: 'a', slug: 'local', name: 'Local' }, { id: 'b', slug: 'craft', name: 'Craft' },
  ] } }),
}));

it('renders the merchant’s chosen categories in order and skips unavailable references', async () => {
  const { container } = render(<SettingsContext.Provider value={{ settings: {} }}>
    <MemoryRouter><CategorySection
      section={{ selectedCategorySlugs: ['produce', 'missing', 'grocery'] }}
      configuredTiles={[{ title: 'Old custom tile', link: '/products' }]} />
    </MemoryRouter>
  </SettingsContext.Provider>);
  await screen.findByRole('link', { name: /Produce/ });
  expect(within(container).getAllByRole('link').map((link) => link.getAttribute('href')))
    .toEqual(['/category/produce', '/category/grocery']);
  expect(screen.queryByText('Old custom tile')).not.toBeInTheDocument();
});

it('renders curated Brand Showcase links in saved order and skips unavailable brands', async () => {
  render(<SettingsContext.Provider value={{ settings: {}, features: { brands: true } }}>
    <MemoryRouter><BrandShowcaseSection section={{ selectedBrandSlugs: ['craft', 'missing', 'local'] }} /></MemoryRouter>
  </SettingsContext.Provider>);
  await screen.findByRole('link', { name: /Craft/ });
  expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    '/brands', '/products?brand=craft', '/products?brand=local',
  ]);
});
