(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.OrbiSEORoutes = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';

    const pages = {
        'index.html': ['Vegetable & Hybrid Seeds', 'Explore hybrid vegetable, fruit and flower seeds, breeding programs and seed production from Orbi Seeds International.', 'home-banner.jpg'],
        'about-orbis.html': ['About Orbi Seeds', 'Learn about Orbi Seeds International, our vegetable seed breeding, seed processing and the people behind our work.', 'about-us.jpg', 'AboutPage'],
        'contact-us.html': ['Contact Orbi Seeds', 'Contact Orbi Seeds International about seed varieties, product enquiries and distribution partnerships.', 'about-us.jpg', 'ContactPage'],
        'product.html': ['Seed Categories', 'Explore vegetable, fruit and flower seed categories from Orbi Seeds International.', 'seeds-and-vegetables.jpg', 'CollectionPage'],
        'products.html': ['Seed Catalogue', 'Browse seed varieties from Orbi Seeds International and compare their characteristics and available options.', 'seeds-and-vegetables.jpg', 'CollectionPage'],
        'research-and-development.html': ['Seed Research & Development', 'Explore the Orbi Seeds breeding stations, marker lab and research behind new vegetable seed varieties.', 'research.jpg'],
        'partners.html': ['Seed Distribution Partnerships', 'Learn about working with Orbi Seeds International as a seed distribution or agricultural research partner.', 'growing-together-innovation.jpg'],
        'testimonials.html': ['Grower & Client Testimonials', 'Read what growers and clients say about their experience with Orbi Seeds International.', 'about-us.jpg'],
        'resources.html': ['Agricultural Resources', 'Find articles from Orbi Seeds International on seeds, crop cultivation and agricultural research.', 'about-us.jpg', 'CollectionPage'],
        'resource.html': ['Agricultural Article', 'Read articles on seed varieties, crop cultivation and agricultural research from Orbi Seeds International.', 'about-us.jpg'],
        'gallery.html': ['Photo Gallery', 'Browse photo albums from Orbi Seeds International, including crops, seed trials and research facilities.', 'research.jpg', 'CollectionPage'],
        'gallery-detail.html': ['Photo Album', 'View photographs from the Orbi Seeds International gallery.', 'research.jpg', 'CollectionPage'],
        'page.html': ['Information', 'Published information from Orbi Seeds International.'],
        'sitemap.html': ['Site Map', 'Find seed categories, research, agricultural resources and contact information on the Orbi Seeds website.', 'home-banner.jpg'],
        'wishlist.html': ['Wishlist', 'Review your saved Orbi Seeds varieties.'],
        'enquiry-list.html': ['Enquiry List', 'Review the seed varieties in your Orbi Seeds enquiry.'],
        'thank-you.html': ['Thank You', 'Review your Orbi Seeds enquiry confirmation.'],
        'error.html': ['Page Not Found', 'The requested Orbi Seeds page could not be found.']
    };
    // Complete titles and descriptions supplied by the SEO team.
    const approvedCopy = {
        '/': {
            metaTitle: 'Best quality hybrid seeds for vegetables, fruits & flowers | Orbi Seeds International Pvt. Ltd.',
            metaDescription: "Discover Orbi Seeds' diverse range of hybrid vegetable, fruit and flower seeds, backed by advanced research, innovative breeding and seed development for the world.",
        },
        '/about-orbis.html': {
            metaTitle: 'About Orbi Seeds | Global Hybrid Seed Company',
            metaDescription: 'Learn about Orbi Seeds International, a global seed company specializing in hybrid seed development, agricultural research, innovative breeding and diverse seed varieties.',
        },
        '/category/fruit': {
            metaTitle: 'Hybrid Fruit Seeds – Watermelon & Muskmelon | Orbi Seeds',
            metaDescription: 'Explore quality hybrid fruit seeds from Orbi Seeds, including watermelon and muskmelon varieties developed through advanced breeding and research for better cultivation.',
        },
        '/category/vegetables': {
            metaTitle: 'Hybrid Vegetable Seeds & Varieties | Orbi Seeds India',
            metaDescription: 'Explore hybrid vegetable seeds from Orbi Seeds, including tomato, cucumber, cabbage, cauliflower, okra, eggplant and pepper varieties for diverse farming needs.',
        },
        '/category/flowers': {
            metaTitle: 'Hybrid Flower Seeds for Growers | Orbi Seeds India',
            metaDescription: 'Explore quality flower seeds from Orbi Seeds, featuring diverse ornamental flower varieties developed through innovative breeding for gardens and commercial cultivation.',
        },
        '/research-and-development.html': {
            metaTitle: 'Agricultural R&D & Seed Breeding | Orbi Seeds',
            metaDescription: 'Discover Orbi Seeds agricultural research and development, specializing in hybrid vegetable seed breeding, molecular genetics, seed quality testing and crop improvement.',
        },
        '/partners.html': {
            metaTitle: 'Global Seed Industry Partners & Collaborations | Orbi Seeds',
            metaDescription: "Discover Orbi Seeds' global partnerships with leading seed companies, supporting vegetable seed breeding, agricultural innovation and international collaboration.",
        },
        '/blogs': {
            metaTitle: 'Agricultural Resources & Seed Information | Orbi Seeds',
            metaDescription: "Explore Orbi Seeds' agricultural resources for useful information on vegetable seeds, hybrid varieties, seed technology, crop development and farming practices.",
        },
        '/gallery.html': {
            metaTitle: 'Agricultural & Seed Gallery | Orbi Seeds International Pvt. Ltd.',
            metaDescription: 'Explore the Orbi Seeds gallery featuring agricultural activities, research facilities, seed production and company events.',
        },
        '/gallery/vegetables': {
            metaTitle: 'Vegetable Seed Crops Photo Gallery | Orbi Seeds',
            metaDescription: 'Explore the Orbi Seeds vegetable gallery featuring images of diverse vegetable varieties, hybrid crops and agricultural products developed through seed research and innovation.',
        },
        '/gallery/flower': {
            metaTitle: 'Flower Seed Crops Photo Gallery | Orbi Seeds',
            metaDescription: 'Explore the ORBI Seeds flower gallery featuring beautiful flower varieties, ornamental crops and flower images showcasing diversity in breeding and cultivation.',
        },
        '/gallery/fresh-fruits': {
            metaTitle: 'Fresh Fruit Varieties Gallery & Images | ORBI Seeds',
            metaDescription: 'Explore the ORBI Seeds fresh fruits gallery featuring watermelon, muskmelon and other fruit varieties, showcasing hybrid crop quality, colours and characteristics.',
        },
        '/contact-us.html': {
            metaTitle: 'Contact the leading seed company in India | Orbi Seeds',
            metaDescription: 'Contact Orbi Seeds for hybrid seed enquiries, product information, distribution opportunities and business collaborations. Connect with our team today.',
        },
    };
    const utility = ['wishlist.html', 'enquiry-list.html', 'thank-you.html', 'error.html'];
    const siteName = 'Orbi Seeds';
    const pagePath = (file, params) => {
        const query = new URLSearchParams(params);
        return (file === 'index.html' ? '' : file) + (query.size ? '?' + query : '');
    };

    function resolve(file, params) {
        const known = Object.prototype.hasOwnProperty.call(pages, file);
        if (!known) file = 'error.html';
        const slug = params.get('slug');
        const category = params.get('category') || params.get('cat');
        const album = params.get('album');
        let route = { file, kind: 'general', publicPath: pagePath(file), key: ({ 'index.html': '/', 'products.html': '/products', 'resources.html': '/blogs' })[file] || '/' + file,
            missing: !known || file === 'error.html', noIndex: utility.includes(file) };
        if (file === 'products.html' && slug) {
            route = { ...route, kind: 'product', slug, publicPath: pagePath(file, { slug }), key: '/products/' + encodeURIComponent(slug) };
        } else if ((file === 'product.html' || file === 'products.html') && category) {
            route = { ...route, kind: 'category', slug: category, publicPath: pagePath(file, { [file === 'product.html' ? 'cat' : 'category']: category }), key: '/category/' + encodeURIComponent(category) };
        } else if (file === 'page.html') {
            if (slug) route = { ...route, kind: 'page', slug, publicPath: pagePath(file, { slug }), key: '/p/' + encodeURIComponent(slug) };
            else route.missing = route.noIndex = true;
        } else if (file === 'resource.html') {
            if (slug) route = { ...route, kind: 'blog', slug, publicPath: pagePath(file, { slug }), key: '/blogs/' + encodeURIComponent(slug) };
            else route.noIndex = true;
        } else if ((file === 'gallery.html' || file === 'gallery-detail.html') && album) {
            route = { ...route, kind: 'gallery', slug: album, publicPath: pagePath('gallery-detail.html', { album }), key: '/gallery/' + encodeURIComponent(album) };
        } else if (file === 'gallery-detail.html') {
            route.missing = route.noIndex = true;
        }

        const isListing = ['general', 'category'].includes(route.kind)
            && ['product.html', 'products.html', 'resources.html'].includes(file);
        const filtered = isListing && Boolean(params.get('q') || params.get('search') || params.get('sort') || params.get('limit')
            || (file === 'resources.html' && params.get('category')));
        route.noIndex ||= filtered || route.missing;
        const page = params.get('page');
        if ((isListing || route.kind === 'gallery') && /^[1-9]\d{0,5}$/.test(page || '') && page !== '1') {
            route.page = Number(page);
            route.publicPath += (route.publicPath.includes('?') ? '&' : '?') + 'page=' + page;
        }
        if (!route.noIndex && !route.page) route.approvedCopy = approvedCopy[route.key];
        return route;
    }

    function resolveApprovedCopy(route, entity) {
        const copy = route.approvedCopy;
        if (!copy || !['category', 'gallery'].includes(route.kind)) return copy;
        return {
            metaTitle: entity?.metaTitle?.trim() || copy.metaTitle,
            metaDescription: entity?.metaDescription?.trim() || copy.metaDescription,
        };
    }

    return { pages, siteName, pagePath, resolve, resolveApprovedCopy };
});
