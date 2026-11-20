(function () {
    'use strict';

    const routes = window.OrbiSEORoutes;
    let requestId = 0;
    let currentUrl = '';
    let serverHead = false;

    function setHead(title, tags) {
        document.title = title;
        document.head.querySelectorAll('[data-orbi-seo]').forEach((tag) => tag.remove());
        tags.forEach((tag) => {
            const copy = document.createElement(tag.tagName.toLowerCase());
            for (const attribute of tag.attributes) copy.setAttribute(attribute.name, attribute.value);
            copy.setAttribute('data-orbi-seo', '');
            copy.textContent = tag.textContent;
            document.head.appendChild(copy);
        });
    }

    function plainText(value) {
        const template = document.createElement('template');
        template.innerHTML = value || '';
        return template.content.textContent.replace(/\s+/g, ' ').trim();
    }

    function mediaUrl(value) {
        if (!value) return '';
        try {
            const url = new URL(value, window.APP_URL);
            return /^https?:$/.test(url.protocol) ? url.href : '';
        } catch (_) {
            return '';
        }
    }

    function fallback(route, entity) {
        const [pageTitle, pageDescription, pageImage, pageType] = routes.pages[route.file];
        const storefront = new URL('.', window.location.href);
        const name = entity && (entity.customHeading || entity.name || entity.title);
        const rawTitle = (entity && entity.metaTitle) || name || pageTitle;
        const title = rawTitle.endsWith(' | ' + routes.siteName) ? rawTitle : rawTitle + ' | ' + routes.siteName;
        const description = (entity && entity.metaDescription) || (entity && plainText(entity.shortDescription || entity.summary || entity.description || entity.content).slice(0, 160)) || pageDescription;
        const mainImage = entity && (entity.featuredImage || entity.coverImage);
        const product = route.kind === 'product' && entity ? OrbiCatalog.line(entity) : null;
        const image = mediaUrl(entity && (entity.ogImage || (mainImage && mainImage.url) || entity.bannerImage || entity.image))
            || (product && product.image !== 'images/orbi-seeds-logo.png' ? new URL(product.image, storefront).href : '')
            || (pageImage ? new URL('images/' + pageImage, storefront).href : '');
        const imageAlt = (entity && !entity.ogImage && ((mainImage && mainImage.alt) || (product && product.imageAlt))) || name || routes.siteName;
        const type = route.kind === 'blog' && entity ? 'article' : route.kind === 'product' && entity ? 'product' : 'website';
        const schemaType = { product: 'Product', blog: 'BlogPosting', category: 'CollectionPage', gallery: 'ImageGallery' }[entity && route.kind] || pageType || 'WebPage';
        let publicPath = route.publicPath;
        if (route.kind === 'category' && entity && Array.isArray(entity.children)) {
            publicPath = entity.children.length ? routes.pagePath('product.html', { cat: entity.slug })
                : routes.pagePath('products.html', { category: entity.slug });
            if (route.page) publicPath += '&page=' + route.page;
        }
        const canonical = new URL(publicPath, storefront).href;
        const tags = [];
        function meta(attribute, key, content) {
            if (!content) return;
            const element = document.createElement('meta');
            element.setAttribute(attribute, key);
            element.content = content;
            tags.push(element);
        }
        meta('name', 'description', description);
        meta('name', 'keywords', entity && entity.metaKeywords);
        meta('name', 'robots', route.noIndex ? 'noindex, nofollow' : 'index, follow');
        if (!route.noIndex) {
            const link = document.createElement('link');
            link.rel = 'canonical';
            link.href = canonical;
            tags.push(link);
            meta('property', 'og:url', canonical);
            const script = document.createElement('script');
            script.type = 'application/ld+json';
            script.textContent = JSON.stringify({
                '@context': 'https://schema.org', '@type': schemaType, url: canonical,
                name: name || pageTitle, description, ...(image && { image }),
                ...(type === 'article' && { headline: entity.title, datePublished: entity.publishedAt, dateModified: entity.updatedAt }),
            });
            tags.push(script);
        }
        meta('property', 'og:site_name', routes.siteName);
        meta('property', 'og:type', type);
        meta('property', 'og:title', title);
        meta('property', 'og:description', description);
        meta('property', 'og:image', image);
        meta('property', 'og:image:alt', image && imageAlt);
        meta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
        meta('name', 'twitter:title', title);
        meta('name', 'twitter:description', description);
        meta('name', 'twitter:image', image);
        meta('name', 'twitter:image:alt', image && imageAlt);
        setHead(title, tags);
    }

    function refresh(entity) {
        const file = window.location.pathname.split('/').pop() || 'index.html';
        const location = '/' + file + window.location.search;
        const route = routes.resolve(file, new URLSearchParams(window.location.search));
        if (location === currentUrl) {
            if (entity && !serverHead) fallback(route, entity);
            return;
        }
        currentUrl = location;
        serverHead = false;
        fallback(route, entity);
        const activeRequest = ++requestId;

        const query = new URLSearchParams({ path: location });
        fetch(window.API_URL + 'seo/orbi/metadata?' + query)
            .then((response) => response.ok ? response.json() : null)
            .then((result) => {
                if (!result?.data || activeRequest !== requestId) return;
                const parsed = new DOMParser().parseFromString('<head>' + result.data.tags + '</head>', 'text/html');
                const tags = Array.from(parsed.head.children).filter((tag) =>
                    tag.matches('meta[name], meta[property], link[rel="canonical"], script[type="application/ld+json"]'));
                setHead(result.data.title, tags);
                serverHead = true;
            })
            .catch(() => { /* Keep local page and entity metadata if the API is unavailable. */ });
    }

    function unavailable() {
        if (serverHead) return;
        requestId++;
        setHead(routes.pages['error.html'][0] + ' | ' + routes.siteName, []);
        const robots = document.createElement('meta');
        robots.name = 'robots';
        robots.content = 'noindex, nofollow';
        robots.setAttribute('data-orbi-seo', '');
        document.head.appendChild(robots);
    }

    window.OrbiSEO = { refresh, unavailable };
    if (document.head.querySelector('meta[name="orbi-seo-rendered"]')) {
        currentUrl = '/' + (window.location.pathname.split('/').pop() || 'index.html') + window.location.search;
        serverHead = true;
    } else {
        refresh();
    }
})();
