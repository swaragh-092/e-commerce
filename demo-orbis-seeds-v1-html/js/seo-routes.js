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
        return route;
    }

    return { pages, siteName, pagePath, resolve };
});
