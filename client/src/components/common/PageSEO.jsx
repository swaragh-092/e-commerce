import React from 'react';
import { Helmet } from 'react-helmet-async';

const PageSEO = ({ title, description, image, url, type = 'website' }) => {
  const siteName = 'E-Commerce Store';
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
      
      {type === 'noindex' && <meta name="robots" content="noindex,nofollow" />}
    </Helmet>
  );
};

export default PageSEO;
