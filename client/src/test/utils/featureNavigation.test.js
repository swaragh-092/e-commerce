import { describe, expect, it } from 'vitest';
import { filterFeatureLinks, getNavigationFeature } from '../../utils/featureNavigation';
import { getFirstAccessibleAdminPath } from '../../utils/permissions';
describe('Disabled content navigation', () => {
  it('hides nested local links while keeping unrelated and external links', () => {
    const links = [
      { url: '/products' }, { url: '/blogs?tag=latest' },
      { url: '/demo-orbis-seeds-v1-html/gallery.html' },
      { url: 'https://other.example.test/blogs' },
      { targetType: 'none', children: [{ url: '/blogs/news' }] },
    ];
    expect(filterFeatureLinks(links, { blogs: false, gallery: false })).toEqual([links[0], links[3]]);
    expect(getNavigationFeature('/blogs?tag=latest')).toBe('blogs');
  });
  it('does not loop through a disabled admin feature as the only landing page', () => {
    for (const key of ['newsletter', 'gallery', 'blogs']) {
      expect(getFirstAccessibleAdminPath({ permissions: [`${key}.read`] }, { [key]: false })).toBeNull();
      expect(getFirstAccessibleAdminPath({ permissions: [`${key}.read`] }, { [key]: true })).toBe(`/admin/${key}`);
    }
  });
});
