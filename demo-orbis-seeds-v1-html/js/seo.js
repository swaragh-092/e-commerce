(function (window) {
    'use strict';

    if (window.OrbiSEO) return;

    var OrbiSEO = {
        toAbsoluteUrl: function (url) {
            if (!url || typeof url !== 'string' || !url.trim()) return '';
            url = url.trim();
            if (/^https?:\/\//i.test(url)) return url;
            var base = (typeof APP_URL !== 'undefined' ? APP_URL : 'https://eshopadmin.swaragh.org.in/').replace(/\/+$/, '');
            if (url.charAt(0) === '/') return base + url;
            return base + '/' + url;
        },

        stripHtml: function (html) {
            if (!html) return '';
            var tmp = document.createElement('div');
            tmp.innerHTML = html;
            return (tmp.textContent || tmp.innerText || '').trim();
        },

        getOrCreateMeta: function (attrName, attrValue) {
            var selector = 'meta[' + attrName + '="' + attrValue + '"]';
            var el = document.querySelector(selector);
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute(attrName, attrValue);
                document.head.appendChild(el);
            }
            return el;
        },

        setMeta: function (options) {
            options = options || {};
            var title = options.title || options.metaTitle || 'Orbi Seeds International';
            var description = options.description || options.metaDescription || '';
            var keywords = options.keywords || options.metaKeywords || '';
            var image = options.image || options.ogImage || '';
            var url = options.url || window.location.href;
            var type = options.type || 'website';
            var schema = options.schema || null;

            // 1. Title Tag
            if (title) {
                var cleanTitle = title.trim();
                if (!/\|\s*Orbi Seeds/i.test(cleanTitle)) {
                    document.title = cleanTitle + ' | Orbi Seeds';
                } else {
                    document.title = cleanTitle;
                }
            }

            // 2. Standard Meta Description & Keywords
            if (description) {
                OrbiSEO.getOrCreateMeta('name', 'description').setAttribute('content', description.trim());
            }
            if (keywords) {
                OrbiSEO.getOrCreateMeta('name', 'keywords').setAttribute('content', keywords.trim());
            }

            // 3. Open Graph Tags
            OrbiSEO.getOrCreateMeta('property', 'og:title').setAttribute('content', document.title);
            if (description) {
                OrbiSEO.getOrCreateMeta('property', 'og:description').setAttribute('content', description.trim());
            }
            OrbiSEO.getOrCreateMeta('property', 'og:url').setAttribute('content', url.split('#')[0]);
            OrbiSEO.getOrCreateMeta('property', 'og:type').setAttribute('content', type);
            OrbiSEO.getOrCreateMeta('property', 'og:site_name').setAttribute('content', 'Orbi Seeds International');

            var absImage = OrbiSEO.toAbsoluteUrl(image);
            if (absImage) {
                OrbiSEO.getOrCreateMeta('property', 'og:image').setAttribute('content', absImage);
            }

            // 4. Twitter Card Tags
            OrbiSEO.getOrCreateMeta('name', 'twitter:card').setAttribute('content', 'summary_large_image');
            OrbiSEO.getOrCreateMeta('name', 'twitter:title').setAttribute('content', document.title);
            if (description) {
                OrbiSEO.getOrCreateMeta('name', 'twitter:description').setAttribute('content', description.trim());
            }
            if (absImage) {
                OrbiSEO.getOrCreateMeta('name', 'twitter:image').setAttribute('content', absImage);
            }

            // 5. Canonical Link
            var canonical = document.querySelector('link[rel="canonical"]');
            if (!canonical) {
                canonical = document.createElement('link');
                canonical.setAttribute('rel', 'canonical');
                document.head.appendChild(canonical);
            }
            canonical.setAttribute('href', url.split('#')[0]);

            // 6. Schema.org JSON-LD Structured Data
            if (schema) {
                var script = document.getElementById('orbi-dynamic-schema');
                if (!script) {
                    script = document.createElement('script');
                    script.id = 'orbi-dynamic-schema';
                    script.type = 'application/ld+json';
                    document.head.appendChild(script);
                }
                script.textContent = JSON.stringify(schema);
            }
        },

        // --- Category SEO ---
        setCategorySEO: function (category, path) {
            if (!category) return;
            var name = category.name || 'Category';
            var title = category.metaTitle || name;
            var cleanDesc = category.description ? OrbiSEO.stripHtml(category.description) : '';
            var desc = category.metaDescription || cleanDesc || ('Explore premium ' + name + ' seeds cultivated for superior performance, high yield, and disease resistance by Orbi Seeds.');
            var keywords = category.metaKeywords || (name + ', ' + name.toLowerCase() + ' seeds, hybrid seeds, vegetable seeds, Orbi Seeds');
            var image = category.ogImage || category.bannerImage || category.image || 'images/inr-bnr.avif';
            var pageUrl = window.location.href;

            var schema = {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                'name': title,
                'description': desc,
                'url': pageUrl,
                'isPartOf': {
                    '@type': 'WebSite',
                    'name': 'Orbi Seeds',
                    'url': window.location.origin
                }
            };

            OrbiSEO.setMeta({
                title: title,
                description: desc,
                keywords: keywords,
                image: image,
                type: 'website',
                schema: schema
            });
        },

        // --- Product SEO ---
        setProductSEO: function (product) {
            if (!product) return;
            var name = product.name || 'Product';
            var title = product.metaTitle || name;
            var cleanDesc = product.shortDescription || (product.description ? OrbiSEO.stripHtml(product.description) : '');
            var desc = product.metaDescription || cleanDesc || ('Buy high-yielding ' + name + ' hybrid seeds from Orbi Seeds. High germination rate and excellent disease tolerance.');
            var keywords = product.metaKeywords || (name + ', ' + name.toLowerCase() + ' seeds, hybrid seed varieties, Orbi Seeds International');

            var primaryImg = '';
            if (product.ogImage) {
                primaryImg = product.ogImage;
            } else if (product.images && product.images.length > 0) {
                var pImg = product.images.find(function (i) { return i.isPrimary; }) || product.images[0];
                primaryImg = pImg.url || pImg.image || (pImg.media && pImg.media.url) || '';
            }
            var absImage = OrbiSEO.toAbsoluteUrl(primaryImg || 'images/default-image.png');
            var pageUrl = window.location.href;

            var schema = {
                '@context': 'https://schema.org',
                '@type': 'Product',
                'name': name,
                'image': absImage ? [absImage] : undefined,
                'description': desc,
                'sku': product.sku || undefined,
                'brand': {
                    '@type': 'Brand',
                    'name': 'Orbi Seeds'
                },
                'offers': {
                    '@type': 'Offer',
                    'availability': (product.quantity > 0 || product.isEnabled) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                    'url': pageUrl
                }
            };

            OrbiSEO.setMeta({
                title: title,
                description: desc,
                keywords: keywords,
                image: absImage,
                type: 'product',
                schema: schema
            });
        },

        // --- Blog / Single Resource SEO ---
        setBlogSEO: function (post) {
            if (!post) return;
            var title = post.metaTitle || post.title || 'Blog';
            var cleanDesc = post.summary || (post.content ? OrbiSEO.stripHtml(post.content).slice(0, 160) : '');
            var desc = post.metaDescription || cleanDesc || ('Read insights and farming tips on ' + (post.title || 'seeds and agriculture') + ' from Orbi Seeds.');
            var keywords = post.metaKeywords || ((post.title || '') + ', agricultural insights, farming guide, hybrid seeds, Orbi Seeds blog');

            var image = post.ogImage || (post.featuredImage && (post.featuredImage.url || post.featuredImage.path)) || 'images/about-us.jpg';
            var absImage = OrbiSEO.toAbsoluteUrl(image);
            var pageUrl = window.location.href;

            var schema = {
                '@context': 'https://schema.org',
                '@type': 'BlogPosting',
                'headline': post.title || title,
                'description': desc,
                'image': absImage ? [absImage] : undefined,
                'datePublished': post.publishedAt || post.createdAt,
                'dateModified': post.updatedAt || post.publishedAt || post.createdAt,
                'mainEntityOfPage': {
                    '@type': 'WebPage',
                    '@id': pageUrl
                },
                'author': {
                    '@type': 'Person',
                    'name': (post.author && (post.author.firstName + ' ' + (post.author.lastName || '')).trim()) || 'Orbi Seeds Team'
                },
                'publisher': {
                    '@type': 'Organization',
                    'name': 'Orbi Seeds International Pvt Ltd',
                    'logo': {
                        '@type': 'ImageObject',
                        'url': OrbiSEO.toAbsoluteUrl('images/orbi-seeds-logo.png')
                    }
                }
            };

            OrbiSEO.setMeta({
                title: title,
                description: desc,
                keywords: keywords,
                image: absImage,
                type: 'article',
                schema: schema
            });
        },

        // --- Blog / Resources List SEO ---
        setBlogListSEO: function () {
            OrbiSEO.setMeta({
                title: 'Resources & Agricultural Blog',
                description: 'Discover agricultural insights, seed cultivation tips, and industry updates from Orbi Seeds International.',
                keywords: 'agricultural blog, farming resources, hybrid seeds, crop management, Orbi Seeds',
                type: 'website'
            });
        }
    };

    window.OrbiSEO = OrbiSEO;
})(window);
