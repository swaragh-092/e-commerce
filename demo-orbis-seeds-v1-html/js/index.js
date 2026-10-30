function getLocalFallbackImage(nameOrSlug) {
    var s = String(nameOrSlug || '').toLowerCase();
    if (s.indexOf('cabbage') !== -1) return 'images/variety-of-seeds/cabbage.png';
    if (s.indexOf('cauliflower') !== -1) return 'images/variety-of-seeds/cauliflower.png';
    if (s.indexOf('pepper') !== -1 || s.indexOf('chilli') !== -1 || s.indexOf('jalapeno') !== -1 || s.indexOf('habanero') !== -1) return 'images/variety-of-seeds/pepper.png';
    if (s.indexOf('cucumber') !== -1) return 'images/variety-of-seeds/cucumber.png';
    if (s.indexOf('okra') !== -1 || s.indexOf('lady') !== -1) return 'images/variety-of-seeds/okra.png';
    if (s.indexOf('watermelon') !== -1) return 'images/variety-of-seeds/watermelon.png';
    if (s.indexOf('melon') !== -1) return 'images/variety-of-seeds/watermelon-2.png';
    if (s.indexOf('pumpkin') !== -1 || s.indexOf('gourd') !== -1 || s.indexOf('squash') !== -1) return 'images/variety-of-seeds/pumpkin.png';
    if (s.indexOf('corn') !== -1) return 'images/variety-of-seeds/sweet-corn.png';
    if (s.indexOf('egg') !== -1 || s.indexOf('brinjal') !== -1) return 'images/variety-of-seeds/eggplant.png';
    return 'images/variety-of-seeds/tomato.png';
}

function resolveItemImage(sub, uploadUrl) {
    if (!sub) return 'images/variety-of-seeds/tomato.png';
    var img = sub.icon || sub.image || sub.imageUrl || sub.image_url;
    if (!img && sub.media && sub.media.url) {
        img = sub.media.url;
    }
    if (!img && Array.isArray(sub.gallery) && sub.gallery.length > 0) {
        var g = sub.gallery[0];
        img = typeof g === 'string' ? g : (g && (g.url || g.image || g.path));
    }
    if (!img && Array.isArray(sub.images) && sub.images.length > 0) {
        var im = sub.images[0];
        img = typeof im === 'string' ? im : (im && (im.url || im.image || im.path));
    }
    if (img && typeof img === 'string' && img.trim()) {
        img = img.trim();
        if (/^https?:\/\//i.test(img)) return img;
        var base = (uploadUrl || '').replace(/\/+$/, '');
        return base + (img.charAt(0) === '/' ? img : '/' + img);
    }
    return getLocalFallbackImage(sub.slug || sub.name);
}

function renderHomeCategories(categories, uploadUrl) {
    if (!categories || !categories.length) return false;
    var html = "";
    categories.forEach(function (cat) {
        if (!cat.children || !cat.children.length) return;

        html += '<div class="vegetables">';
        html += '    <a href="product.html?cat=' + encodeURIComponent(cat.slug || '') + '" class="category-label">' + (cat.name || '') + '</a>';

        var children = cat.children.slice().sort(function (a, b) {
            var aHasImg = (a.icon || a.image || (a.media && a.media.url) || (a.images && a.images.length) || (a.gallery && a.gallery.length)) ? 1 : 0;
            var bHasImg = (b.icon || b.image || (b.media && b.media.url) || (b.images && b.images.length) || (b.gallery && b.gallery.length)) ? 1 : 0;
            if (aHasImg !== bHasImg) return bHasImg - aHasImg;
            return (a.sortOrder || 0) - (b.sortOrder || 0);
        });

        children.slice(0, 4).forEach(function (sub) {
            var subUrl = "products.html?category=" + encodeURIComponent(sub.slug || '');
            var iconUrl = resolveItemImage(sub, uploadUrl);
            var fallback = getLocalFallbackImage(sub.slug || sub.name);

            html += '<a href="' + subUrl + '" class="variety-of-seeds-1">';
            html += '    <div class="variety-of-seeds-img-parent">';
            html += '        <div class="variety-of-seeds-img">';
            html += '            <img src="' + iconUrl + '" alt="' + (sub.name || 'Image') + '" onerror="this.onerror=null;this.src=\'' + fallback + '\';">';
            html += '        </div>';
            html += '    </div>';
            html += '    <div class="variety-of-text">';
            html += '        <h3>' + (sub.name || '') + '</h3>';
            html += '        <div class="arrow">';
            html += '            <img src="images/icons/next.png" alt="Image">';
            html += '        </div>';
            html += '    </div>';
            html += '</a>';
        });
        html += '</div>';
    });

    if (html) {
        $('#orbis-home-section-categories').html(html);
        return true;
    }
    return false;
}

function fetchAndRenderHomeSections() {
    var apiUrl = typeof API_URL !== 'undefined' ? API_URL : "https://eshopadmin.swaragh.org.in/api/";
    var uploadUrl = typeof APP_URL !== 'undefined' ? APP_URL : "https://eshopadmin.swaragh.org.in/";
    var homeSectionUrl = apiUrl + "api-builder/public/orbis-home-section-1";

    fetch(homeSectionUrl)
        .then(function (r) { return r.json(); })
        .then(function (result) {
            var categories = result && result.success && result.data
                ? (result.data.categories || (result.data.data && result.data.data.categories))
                : null;

            if (categories && categories.length && renderHomeCategories(categories, uploadUrl)) {
                return;
            }
            throw new Error("No categories in home section");
        })
        .catch(function () {
            // Fallback to categories endpoint if api-builder is disabled or unavailable
            fetch(apiUrl + "categories")
                .then(function (r) { return r.json(); })
                .then(function (catResult) {
                    var categories = catResult && catResult.success && Array.isArray(catResult.data)
                        ? catResult.data
                        : [];
                    renderHomeCategories(categories, uploadUrl);
                })
                .catch(function (error) {
                    console.error("Error fetching categories for home section:", error);
                });
        });
}

$(document).ready(function () {
    fetchAndRenderHomeSections();
});
