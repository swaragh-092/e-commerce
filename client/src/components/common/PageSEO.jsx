import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useSettings } from '../../hooks/useSettings';
import { getStoreName } from '../../utils/store';
import { useLocation } from 'react-router-dom';
import { formatSeoTitle, resolveCanonicalUrl } from '../../utils/seo/formatSeoTitle';
import { getMediaUrl } from '../../utils/media';

const PageSEO = ({ title, description, image, url, type = 'website', structuredData, articlePublishedTime }) => {
  const { settings } = useSettings();
  const location = useLocation();
  const siteName = settings?.seo?.siteName || getStoreName(settings);
  const fullTitle = formatSeoTitle(title || siteName, settings);
  const canonicalUrl = type === 'noindex' ? null : resolveCanonicalUrl({ url, pathname: location.pathname, settings });
  const imageUrl = (() => {
    if (!image) return '';
    const base = resolveCanonicalUrl({ pathname: '/', settings });
    try { return new URL(getMediaUrl(image), base).toString(); }
    catch (_) { return getMediaUrl(image); }
  })();
  const schemas = [...(Array.isArray(structuredData) ? structuredData : [structuredData])].filter(Boolean);
  if (type === 'article' && title && canonicalUrl) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      ...(description ? { description } : {}),
      ...(imageUrl ? { image: [imageUrl] } : {}),
      ...(articlePublishedTime ? { datePublished: articlePublishedTime } : {}),
      mainEntityOfPage: canonicalUrl,
    });
  } else if (type === 'collection' && title && canonicalUrl) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      ...(description ? { description } : {}),
      url: canonicalUrl,
    });
  } else if (type === 'page' && title && canonicalUrl) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      ...(description ? { description } : {}),
      url: canonicalUrl,
    });
  }
  const openGraphType = ['article', 'product'].includes(type) ? type : 'website';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:type" content={openGraphType} />
      <meta property="og:site_name" content={siteName} />
      {description && <meta property="og:description" content={description} />}
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      {type === 'article' && articlePublishedTime && <meta property="article:published_time" content={articlePublishedTime} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {imageUrl && <meta name="twitter:image" content={imageUrl} />}
      
      {/* Canonical URL */}
      {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}

      {schemas.map((schema, index) => (
        <script key={schema['@id'] || `${schema['@type'] || 'schema'}-${index}`} type="application/ld+json">
          {JSON.stringify(schema).replace(/</g, '\\u003c')}
        </script>
      ))}
      
      {type === 'noindex' && <meta name="robots" content="noindex,nofollow" />}
    </Helmet>
  );
};

export default PageSEO;
