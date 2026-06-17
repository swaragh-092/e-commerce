import React, { useEffect, useRef, useState } from 'react';
import { Box, Skeleton } from '@mui/material';
import { SECTION_TYPES, getSectionType, isKnownSectionType } from './sectionRegistry';
import { SectionFrame, UnsupportedSection } from './SectionFallback';
import HeroSection from './HeroSection';
import TrustSection from './TrustSection';
import PromoBannerSection from './PromoBannerSection';
import EditorialSection from './EditorialSection';
import ContentGridSection from './ContentGridSection';
import CategorySection from './CategorySection';
import ProductRowSection from './ProductRowSection';
import NewsletterSection from './NewsletterSection';
import CountdownSection from './CountdownSection';
import RecentlyViewedSection from './RecentlyViewedSection';
import BrandShowcaseSection from './BrandShowcaseSection';

const LAZY_ROOT_MARGIN = '720px 0px';

const sectionMinHeight = (section, preview) => {
  if (section?.minHeight) return section.minHeight;
  const type = getSectionType(section);
  if (type === SECTION_TYPES.HERO_CAROUSEL) return preview ? 320 : 520;
  if (type === SECTION_TYPES.PRODUCT_ROW || type === SECTION_TYPES.CATEGORY_SHORTCUTS || type === SECTION_TYPES.FEATURED_COLLECTION_GRID) return preview ? 220 : 360;
  if (type === SECTION_TYPES.PROMO_BANNERS || type === SECTION_TYPES.BRAND_SHOWCASE) return preview ? 200 : 300;
  return preview ? 180 : 260;
};

const LazySectionGate = ({ enabled, minHeight, rootMargin = LAZY_ROOT_MARGIN, children }) => {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(!enabled);

  useEffect(() => {
    if (!enabled || mounted) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setMounted(true);
        observer.disconnect();
      }
    }, { rootMargin, threshold: 0.01 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled, mounted, rootMargin]);

  if (mounted) return children;

  return (
    <Box ref={ref} sx={{ minHeight, display: 'grid', alignItems: 'center', px: { xs: 2, md: 4 }, py: 3 }}>
      <Skeleton variant="rounded" height={Math.min(Number.parseInt(minHeight, 10) || 180, 260)} sx={{ borderRadius: 3 }} />
    </Box>
  );
};

/**
 * SectionRenderer — single entry point that resolves section type → component → variant.
 * Used by both live storefront (HomeExperience) and admin preview (StorefrontTemplatePreview).
 */
const SectionRenderer = ({
  section,
  mode = 'live',
  data = {},
  index = 0,
  selected = false,
  lazy = true,
  eagerCount = 2,
  lazyRootMargin = LAZY_ROOT_MARGIN,
  onSelect,
  onSelectComponent,
  onInlineFieldChange,
  onInlineFieldCommit,
  onInlineBlockFocus,
}) => {
  if (!section || section.enabled === false) return null;

  const type = getSectionType(section);
  const preview = mode === 'preview';
  const editorProps = { onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus };

  if (!isKnownSectionType(type)) {
    return <SectionFrame section={section} index={index} preview={preview}><UnsupportedSection section={section} mode={mode} /></SectionFrame>;
  }

  let content = null;

  switch (type) {
    case SECTION_TYPES.HERO_CAROUSEL:
      content = <HeroSection section={section} slides={data.slides || data.heroSlides || []} mode={mode} onSelectComponent={onSelectComponent} {...editorProps} />;
      break;
    case SECTION_TYPES.VALUE_PROPS:
      content = <TrustSection section={section} items={data.items || data.valueProps || []} mode={mode} onSelectComponent={onSelectComponent} {...editorProps} />;
      break;
    case SECTION_TYPES.TRUST_BADGES:
      content = <TrustSection section={section} items={data.items || data.valueProps || section.items || []} mode={mode} onSelectComponent={onSelectComponent} {...editorProps} />;
      break;
    case SECTION_TYPES.CATEGORY_SHORTCUTS:
    case SECTION_TYPES.FEATURED_COLLECTION_GRID:
      content = (
        <CategorySection
          section={section}
          categories={data.categories || []}
          configuredTiles={data.configuredTiles || section.items || []}
          loading={data.loading || false}
          titleOverride={type === SECTION_TYPES.FEATURED_COLLECTION_GRID ? (section.title || 'Featured Collections') : undefined}
          mode={mode}
          onSelectComponent={onSelectComponent}
          {...editorProps}
        />
      );
      break;
    case SECTION_TYPES.PROMO_BANNERS:
      content = <PromoBannerSection section={section} banners={data.banners || data.promoBanners || []} mode={mode} onSelectComponent={onSelectComponent} {...editorProps} />;
      break;
    case SECTION_TYPES.PRODUCT_ROW:
      content = (
        <ProductRowSection
          section={section}
          products={data.products || []}
          loading={data.loading || false}
          count={data.count || section.count || 8}
          pricingEnabled={data.pricingEnabled !== false}
          mode={mode}
          onSelectComponent={onSelectComponent}
          {...editorProps}
        />
      );
      break;
    case SECTION_TYPES.BRAND_SHOWCASE:
      content = (
        <BrandShowcaseSection
          section={section}
          brands={data.brands || []}
          loading={data.loading || false}
          mode={mode}
          onSelectComponent={onSelectComponent}
          {...editorProps}
        />
      );
      break;
    case SECTION_TYPES.EDITORIAL_IMAGE_TEXT:
      content = <EditorialSection section={section} mode={mode} onSelectComponent={onSelectComponent} {...editorProps} />;
      break;
    case SECTION_TYPES.TESTIMONIALS:
      content = <ContentGridSection section={section} fallbackTitle="Customer Story" mode={mode} {...editorProps} />;
      break;
    case SECTION_TYPES.LOGO_CLOUD:
      content = <ContentGridSection section={section} fallbackTitle="Partner" kind="logo" mode={mode} {...editorProps} />;
      break;
    case SECTION_TYPES.FAQ:
      content = <ContentGridSection section={section} fallbackTitle="Question" mode={mode} {...editorProps} />;
      break;
    case SECTION_TYPES.NEWSLETTER_SIGNUP:
      content = <NewsletterSection section={section} mode={mode} onSelectComponent={onSelectComponent} {...editorProps} />;
      break;
    case SECTION_TYPES.COUNTDOWN_SALE:
      content = <CountdownSection section={section} mode={mode} onSelectComponent={onSelectComponent} {...editorProps} />;
      break;
    case SECTION_TYPES.RECENTLY_VIEWED:
      content = <RecentlyViewedSection section={section} mode={mode} {...editorProps} />;
      break;
    case SECTION_TYPES.PRODUCT_INFO:
    case SECTION_TYPES.PRODUCT_REVIEWS:
    case SECTION_TYPES.CATEGORY_HEADER:
    case SECTION_TYPES.CATEGORY_PRODUCTS:
    case SECTION_TYPES.CATALOG_HEADER:
    case SECTION_TYPES.CATALOG_PRODUCTS:
    case SECTION_TYPES.BRANDS_HEADER:
    case SECTION_TYPES.BRANDS_LIST:
    case SECTION_TYPES.BLOG_HEADER:
    case SECTION_TYPES.BLOG_POSTS:
    case SECTION_TYPES.ACCOUNT_MAIN:
    case SECTION_TYPES.CART_MAIN:
      content = typeof data.render === 'function' ? data.render() : <UnsupportedSection section={section} mode={mode} />;
      break;
    default:
      content = <UnsupportedSection section={section} mode={mode} />;
  }

  const lazyEnabled = Boolean(lazy) && !selected && index >= eagerCount;

  return (
    <SectionFrame
      section={section}
      index={index}
      preview={preview}
      selected={selected}
      onSelect={onSelect}
      onInlineFieldChange={onInlineFieldChange}
      onInlineFieldCommit={onInlineFieldCommit}
      onInlineBlockFocus={onInlineBlockFocus}
    >
      <LazySectionGate enabled={lazyEnabled} minHeight={sectionMinHeight(section, preview)} rootMargin={lazyRootMargin}>
        {content}
      </LazySectionGate>
    </SectionFrame>
  );
};

export default SectionRenderer;
