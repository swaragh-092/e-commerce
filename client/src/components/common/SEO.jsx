import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { seoService } from '../../services/seoService';
import { SettingsContext } from '../../context/ThemeContext';
import { useContext } from 'react';
import { useFeature } from '../../hooks/useSettings';
import { getStoreName } from '../../utils/store';
import { buildOrganizationJsonLd } from '../../utils/seo/buildOrganizationJsonLd';
import { formatSeoTitle } from '../../utils/seo/formatSeoTitle';

const SEO = () => {
    const { settings } = useContext(SettingsContext);
    const seoEnabled = useFeature('seo');
    const location = useLocation();
    const [resolved, setResolved] = useState(null);

    useEffect(() => {
        let cancelled = false;
        if (!seoEnabled) {
            setResolved(null);
            return undefined;
        }
        
        const fetchMetadata = async () => {
            try {
                const data = await seoService.getMetadata(location.pathname);
                if (!cancelled && data) {
                    setResolved({ pathname: location.pathname, data });
                }
            } catch (err) {
                console.error('SEO effect failed:', err);
            }
        };

        fetchMetadata();
        return () => { cancelled = true; };
    }, [location.pathname, settings, seoEnabled]);

    const metadata = resolved?.pathname === location.pathname ? resolved.data : null;
    if (!seoEnabled || !metadata) return null;
    // Utility pages own their specific titles (for example an order number).
    // The server supplies their crawl restriction without replacing that title.
    if (metadata.pageKind === 'utility') {
        return <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>;
    }

    const title = formatSeoTitle(metadata.title || settings?.seo?.defaultTitle || getStoreName(settings), settings);

    return (
        <Helmet>
            <title>{title}</title>
            <script type="application/ld+json">{JSON.stringify(buildOrganizationJsonLd({ settings })).replace(/</g, '\\u003c')}</script>
            {metadata.description && <meta name="description" content={metadata.description} />}
            {metadata.keywords && <meta name="keywords" content={metadata.keywords} />}
            {metadata.canonicalUrl && <link rel="canonical" href={metadata.canonicalUrl} />}

            {/* Open Graph Tags */}
            <meta property="og:title" content={title} />
            {metadata.description && <meta property="og:description" content={metadata.description} />}
            <meta property="og:type" content={metadata.type || 'website'} />
            {metadata.canonicalUrl && <meta property="og:url" content={metadata.canonicalUrl} />}
            {metadata.ogImage && <meta property="og:image" content={metadata.ogImage} />}
            {metadata.siteName && <meta property="og:site_name" content={metadata.siteName} />}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            {metadata.description && <meta name="twitter:description" content={metadata.description} />}
            {metadata.ogImage && <meta name="twitter:image" content={metadata.ogImage} />}
            {metadata.twitterHandle && <meta name="twitter:site" content={metadata.twitterHandle} />}

            {/* Rich Product Data */}
            {metadata.type === 'product' && metadata.productData && (
                <>
                    {metadata.productData.price != null && <meta property="product:price:amount" content={metadata.productData.price} />}
                    {metadata.productData.currency && <meta property="product:price:currency" content={metadata.productData.currency} />}
                    {metadata.productData.availability && <meta property="product:availability" content={metadata.productData.availability} />}
                </>
            )}

            {/* Robots */}
            <meta name="robots" content={metadata.noIndex ? 'noindex, nofollow' : 'index, follow'} />
        </Helmet>
    );
};

export default SEO;
