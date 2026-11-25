import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Container } from '@mui/material';
import { useFeatureVisible, useSettings } from '../../../hooks/useSettings';
import { getPageProductRows, getPageSectionTypes, findAssignedPageTemplate, PAGE_SETTINGS_GROUPS } from '../../../utils/designerSections';
import { fetchStaffPicks, getProductRowQuery } from '../../../utils/productRowSources';
import React, { useContext, useEffect, useState } from 'react';
import { getProducts } from '../../../services/productService';
import SectionRenderer from './SectionRenderer';
import { SettingsContext } from '../../../context/ThemeContext';
import ProductRow from '../../product/ProductRow';
import productRow from '../../../../../shared/product-row.json';

const DiscoveryRow = ({ row, category, designerPreview }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const count = row.source === 'staffPicks' ? row.productIds?.length || 0 : Math.min(
    productRow.limits.editorMaxCount,
    Math.max(productRow.limits.minCount, Number.parseInt(row.count, 10) || productRow.defaults.count),
  );
  const source = row.source || productRow.defaults.source;
  useEffect(() => {
    let active = true;
    setLoading(true);
    const limit = source === 'bestSellers' ? Math.max(4, count) : source === 'mostViewed' ? Math.max(5, count) : count;
    const request = source === 'staffPicks' ? fetchStaffPicks(row, getProducts) : getProducts(
      getProductRowQuery(row, { source: Object.hasOwn(productRow.sources, source) ? source : productRow.defaults.source, limit, category }),
    );
    request
      .then(result => { if (active) setProducts((result?.data || []).slice(0, count)); })
      .catch(() => { if (active) setProducts([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [count, source, category, row]);

  if (!loading && !products.length) {
    return designerPreview ? <SectionRenderer section={row} mode="preview" data={{ showProductEmptyState: true }} /> : null;
  }
  const defaultLink = productRow.sources[source]?.link;
  const scopedLink = defaultLink && category
    ? `${defaultLink}&category=${encodeURIComponent(category)}`
    : defaultLink;
  const viewAllLink = row.viewAllLink || scopedLink;
  const layout = row.variant || row.layout || productRow.defaults.layout;
  return <ProductRow title={row.title || 'Recommended products'} viewAllLink={viewAllLink} products={products}
    loading={loading} count={count} layout={layout} compact={layout === 'grid-compact'}
    columnsDesktop={row.columnsDesktop} columnsMobile={row.columnsMobile} columnsTablet={row.columnsTablet}
    horizontalGap={row.horizontalGap} verticalGap={row.verticalGap} mobileCarousel={row.mobileCarousel} />;
};

export default function PageProductRows({ rows = [], category, designerPreview = false }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return <>{rows.filter(row => row?.type === 'product-row' && row.enabled !== false).map(row => <DiscoveryRow key={row.id} row={row} category={row.productScope === 'store' ? undefined : category} designerPreview={designerPreview} />)}</>;
}

export function RoutedProductRows({ page, children }) {
  const settingsContext = useContext(SettingsContext);
  const { settings } = useSettings();
  const pricingEnabled = useFeatureVisible('pricing', 'storefront');
  const { categorySlug, slug } = useParams();
  const [searchParams] = useSearchParams();
  const designerPreview = searchParams.get('previewMode') === '1';
  const alternate = findAssignedPageTemplate(settings, page, page === 'category' ? categorySlug : slug);
  const pageSettings = alternate ? { ...settings, [PAGE_SETTINGS_GROUPS[page]]: alternate.settings } : settings;
  const allowedTypes = getPageSectionTypes(page);
  const configuredRows = getPageProductRows(pageSettings, page);
  const showInsertion = designerPreview && page !== 'checkout' && configuredRows.length < 6;
  const rows = configuredRows.filter((row) => allowedTypes.includes(row?.type) && row.enabled !== false && (row.source !== 'sale' || pricingEnabled || designerPreview));
  const category = page === 'category' ? categorySlug : undefined;
  const above = rows.filter(({ pagePosition }) => pagePosition === 'above');
  const below = rows.filter(({ pagePosition }) => pagePosition !== 'above');
  const insertion = (position, anchor) => showInsertion && (
    <button type="button" hidden data-store-add-section={position} data-store-anchor={anchor}>Add section here</button>
  );
  const renderSections = (sections, position) => sections.map((section) => (
    <React.Fragment key={section.id}>
      {insertion(position, section.id)}
      {section.type === 'product-row' ? (
        <Container data-store-section={section.id} maxWidth="lg" sx={{ display: {
          xs: section.hideOnMobile ? 'none' : 'block',
          md: section.hideOnDesktop ? 'none' : 'block',
        } }}>
          {section.source === 'sale' && !pricingEnabled
            ? <SectionRenderer section={section} mode="preview" data={{ showProductEmptyState: true, pricingEnabled: false }} />
            : <PageProductRows rows={[section]} category={category} designerPreview={designerPreview} />}
        </Container>
      ) : <Box data-store-section={section.id}><SectionRenderer section={section} mode={designerPreview && ['gallery', 'testimonials'].includes(section.type) ? 'preview' : 'live'} /></Box>}
    </React.Fragment>
  ));

  const layout = <>
    {renderSections(above, 'above')}{insertion('above')}
    {designerPreview && (page === 'cart' || page === 'checkout')
      ? <Box data-store-component={page === 'cart' ? 'cartItem' : 'checkoutBlock'}>{children}</Box>
      : children}
    {renderSections(below, 'below')}{insertion('below')}
  </>;
  return alternate
    ? <SettingsContext.Provider value={{ ...settingsContext, settings: pageSettings, productTemplateId: page === 'product' ? alternate.id : undefined }}>
        {layout}
      </SettingsContext.Provider>
    : layout;
}
