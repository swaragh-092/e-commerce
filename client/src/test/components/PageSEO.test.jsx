import { renderToString } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { StaticRouter } from 'react-router-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageSEO from '../../components/common/PageSEO';
import { formatSeoTitle, resolveCanonicalUrl } from '../../utils/seo/formatSeoTitle';

const state = vi.hoisted(() => ({ settings: {} }));
vi.mock('../../hooks/useSettings', () => ({ useSettings: () => state }));
const head = (props) => {
  const context = {};
  renderToString(<HelmetProvider context={context}><StaticRouter location="/products/seeds">
    <PageSEO {...props} />
  </StaticRouter></HelmetProvider>);
  return context.helmet;
};
beforeEach(() => {
  HelmetProvider.canUseDOM = false;
  state.settings = { general: { storeName: 'Shop' }, seo: { titleSuffix: ' | Shop', canonicalBaseUrl: 'https://shop.test' } };
});
afterEach(() => { HelmetProvider.canUseDOM = true; });

describe('SEO output', () => {
  it('preserves title suffix spacing and avoids duplicate suffixes', () => {
    expect(formatSeoTitle('Seeds', state.settings)).toBe('Seeds | Shop');
    expect(formatSeoTitle('Seeds', { general: { storeName: 'Shop' } })).toBe('Seeds | Shop');
    expect(formatSeoTitle('Seeds | Shop', state.settings)).toBe('Seeds | Shop');
    expect(formatSeoTitle('Seeds', { seo: { titleTemplate: '%s — Garden' } })).toBe('Seeds — Garden');
  });
  it('keeps product social cards typed as products', () => {
    const output = head({ title: 'Seeds', type: 'product', image: '/uploads/seeds.png' });
    expect(output.meta.toString()).toContain('property="og:type" content="product"');
    expect(output.meta.toString()).toContain('content="https://shop.test/uploads/seeds.png"');
    expect(output.title.toString()).toContain('Seeds | Shop');
  });
  it('uses the configured canonical origin for relative URLs and removes query parameters', () => {
    expect(resolveCanonicalUrl({ url: '/products/seeds?sort=price#details', settings: state.settings })).toBe('https://shop.test/products/seeds');
  });
  it('rejects non-web canonical URLs and falls back to the current route', () => {
    expect(resolveCanonicalUrl({ url: 'javascript:alert(1)', pathname: '/products/seeds', settings: state.settings })).toBe('https://shop.test/products/seeds');
    expect(resolveCanonicalUrl({ pathname: '/products/seeds', settings: { seo: { canonicalBaseUrl: 'javascript:alert(1)' } } })).toBe(`${window.location.origin}/products/seeds`);
  });
  it('marks utility pages noindex and omits their canonical link', () => {
    const output = head({ title: 'Cart', type: 'noindex' });
    expect(output.meta.toString()).toContain('name="robots" content="noindex,nofollow"');
    expect(output.link.toString()).not.toContain('canonical');
  });
  it('escapes script boundaries in structured content', () => {
    const output = head({ title: 'Seeds', structuredData: { '@type': 'Product', description: '</script><script>alert(1)</script>' } });
    expect(output.script.toString()).not.toContain('</script><script>');
    expect(output.script.toString()).toContain('\\u003c/script>');
  });
});
