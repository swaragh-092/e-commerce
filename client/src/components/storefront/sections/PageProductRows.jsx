import { useParams } from 'react-router-dom';
import { Container } from '@mui/material';
import { useFeatureVisible, useSettings } from '../../../hooks/useSettings';
import { getPageProductRows, getPageSectionTypes, findAssignedPageTemplate, PAGE_SETTINGS_GROUPS } from '../../../utils/designerSections';
import { fetchStaffPicks, PRODUCT_SOURCE_PARAMS } from '../../../utils/productRowSources';
import React, { useContext, useEffect, useState } from 'react';
import { getProducts } from '../../../services/productService';
import SectionRenderer from './SectionRenderer';
import { SettingsContext } from '../../../context/ThemeContext';
import ProductRow from '../../product/ProductRow';

const DiscoveryRow = ({ row, category }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const count = row.source === 'staffPicks' ? row.productIds?.length || 0 : Math.min(24, Math.max(1, Number.parseInt(row.count, 10) || 8));
  const source = row.source || 'featured';
  useEffect(() => {
    let active = true;
    const limit = source === 'bestSellers' ? Math.max(4, count) : source === 'mostViewed' ? Math.max(5, count) : count;
    const request = source === 'staffPicks' ? fetchStaffPicks(row, getProducts) : getProducts({
      ...(PRODUCT_SOURCE_PARAMS[source] || PRODUCT_SOURCE_PARAMS.featured),
      ...(category && { category }),
      ...(source === 'sale' && row.saleLabel && { saleLabel: row.saleLabel }),
      limit,
      status: 'published',
    });
    request
      .then(result => { if (active) setProducts((result?.data || []).slice(0, count)); })
      .catch(() => { if (active) setProducts([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [count, source, category, row]);

  if (!loading && !products.length) return null;
  const sourceLinks = {
    bestSellers: '/products?sort=best-selling',
    mostViewed: '/products?sort=most-viewed',
    trending: '/products?sort=trending',
    newest: '/products?sort=newest',
    sale: '/products?onSale=true',
    featured: '/products?featured=true',
  };
  const defaultLink = sourceLinks[source];
  const scopedLink = defaultLink && category
    ? `${defaultLink}&category=${encodeURIComponent(category)}`
    : defaultLink;
  const viewAllLink = row.viewAllLink || scopedLink;
  const layout = row.variant || row.layout || 'carousel';
  return <ProductRow title={row.title || 'Recommended products'} viewAllLink={viewAllLink} products={products} loading={loading} count={count} layout={layout} compact={layout === 'grid-compact'} />;
};

export default function PageProductRows({ rows = [], category }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return <>{rows.filter(row => row?.type === 'product-row' && row.enabled !== false).map(row => <DiscoveryRow key={row.id} row={row} category={row.productScope === 'store' ? undefined : category} />)}</>;
}

export function RoutedProductRows({ page, children }) {
  const settingsContext = useContext(SettingsContext);
  const { settings } = useSettings();
  const pricingEnabled = useFeatureVisible('pricing', 'storefront');
  const { categorySlug, slug } = useParams();
  const alternate = findAssignedPageTemplate(settings, page, page === 'category' ? categorySlug : slug);
  const pageSettings = alternate ? { ...settings, [PAGE_SETTINGS_GROUPS[page]]: alternate.settings } : settings;
  const allowedTypes = getPageSectionTypes(page);
  const rows = getPageProductRows(pageSettings, page)
    .filter((row) => allowedTypes.includes(row?.type) && row.enabled !== false && (row.source !== 'sale' || pricingEnabled));
  const category = page === 'category' ? categorySlug : undefined;
  const above = rows.filter(({ pagePosition }) => pagePosition === 'above');
  const below = rows.filter(({ pagePosition }) => pagePosition !== 'above');
  const renderSections = (sections) => sections.map((section) => section.type === 'product-row'
    ? <Container key={section.id} maxWidth="lg" sx={{ display: {
        xs: section.hideOnMobile ? 'none' : 'block',
        md: section.hideOnDesktop ? 'none' : 'block',
      } }}>
        <PageProductRows rows={[section]} category={category} />
      </Container>
    : <SectionRenderer key={section.id} section={section} />);

  const layout = <>{renderSections(above)}{children}{renderSections(below)}</>;
  return alternate
    ? <SettingsContext.Provider value={{ ...settingsContext, settings: pageSettings, productTemplateId: page === 'product' ? alternate.id : undefined }}>
        {layout}
      </SettingsContext.Provider>
    : layout;
}
