import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { seoService } from '../../services/seoService';
import { SettingsContext } from '../../context/ThemeContext';
import { useContext } from 'react';

const SEO = () => {
    const { settings } = useContext(SettingsContext);
    const location = useLocation();
    const [metadata, setMetadata] = useState(null);

    useEffect(() => {
        let cancelled = false;
        if (settings?.features?.seo === false) return;
        
        const fetchMetadata = async () => {
            try {
                const data = await seoService.getMetadata(location.pathname);
                if (!cancelled && data) {
                    setMetadata(data);
                }
            } catch (err) {
                console.error('SEO effect failed:', err);
            }
        };

        fetchMetadata();
        return () => { cancelled = true; };
    }, [location.pathname, settings]);

    if (!metadata) return null;

    const title = metadata.title || 'E-Commerce Store';

    return (
        <Helmet>
            <title>{title}</title>
            {metadata.description && <meta name="description" content={metadata.description} />}
            {metadata.keywords && <meta name="keywords" content={metadata.keywords} />}
            {metadata.canonicalUrl && <link rel="canonical" href={metadata.canonicalUrl} />}

            {/* Open Graph Tags */}
            <meta property="og:title" content={title} />
            {metadata.description && <meta property="og:description" content={metadata.description} />}
            <meta property="og:type" content={metadata.type || 'website'} />
            {metadata.ogImage && <meta property="og:image" content={metadata.ogImage} />}
            {metadata.siteName && <meta property="og:site_name" content={metadata.siteName} />}

            {/* Rich Product Data */}
            {metadata.type === 'product' && metadata.productData && (
                <>
                    {metadata.productData.price && <meta property="product:price:amount" content={metadata.productData.price} />}
                    {metadata.productData.currency && <meta property="product:price:currency" content={metadata.productData.currency} />}
                    {metadata.productData.availability && <meta property="product:availability" content={metadata.productData.availability} />}
                </>
            )}

            {/* Robots */}
            {metadata.noIndex && <meta name="robots" content="noindex" />}
        </Helmet>
    );
};

export default SEO;
