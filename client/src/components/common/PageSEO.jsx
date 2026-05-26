import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useSettings } from '../../hooks/useSettings';
import { getStoreName } from '../../utils/store';

const PageSEO = ({ title, description, image, url, type = 'website', structuredData }) => {
  const { settings } = useSettings();
  const siteName = getStoreName(settings);
  const fullTitle = title ? `${title} | ${siteName}` : siteName;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      {url && <meta property="og:url" content={url} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}
      
      {/* Canonical URL */}
      {url ? <link rel="canonical" href={url} /> : null}

      {structuredData ? (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      ) : null}
      
      {type === 'noindex' && <meta name="robots" content="noindex,nofollow" />}
    </Helmet>
  );
};

export default PageSEO;
