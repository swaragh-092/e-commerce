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
    var html = "";
    categories.forEach(function (cat) {
        if (!cat.children || !cat.children.length) return;

        html += '<div class="vegetables">';
        html += '    <a href="product.html?cat=' + encodeURIComponent(cat.slug || '') + '" class="category-label">' + OrbiCatalog.escape(cat.name) + '</a>';

        cat.children.slice(0, 4).forEach(function (sub) {
            var subUrl = (sub.children?.length ? 'product.html?cat=' : 'products.html?category=') + encodeURIComponent(sub.slug);
            var iconUrl = resolveItemImage(sub, uploadUrl);
            var fallback = getLocalFallbackImage(sub.slug || sub.name);

            html += '<a href="' + subUrl + '" class="variety-of-seeds-1">';
            html += '    <div class="variety-of-seeds-img-parent">';
            html += '        <div class="variety-of-seeds-img">';
            html += '            <img src="' + OrbiCatalog.escape(iconUrl) + '" alt="' + OrbiCatalog.escape(sub.name) + '" onerror="this.onerror=null;this.src=\'' + fallback + '\';">';
            html += '        </div>';
            html += '    </div>';
            html += '    <div class="variety-of-text">';
            html += '        <h3>' + OrbiCatalog.escape(sub.name) + '</h3>';
            html += '        <div class="arrow">';
            html += '            <img src="images/icons/next.png" alt="">';
            html += '        </div>';
            html += '    </div>';
            html += '</a>';
        });
        html += '</div>';
    });

    return html;
}

function fetchAndRenderHomeSections() {
    var container = document.getElementById('orbis-home-section-categories');
    var status = container.querySelector('[role="status"]');
    fetch(API_URL + 'categories')
        .then(OrbiCatalog.readResponse)
        .then(function (result) {
            if (!Array.isArray(result.data)) throw new Error('Invalid category response');
            var html = renderHomeCategories(result.data, APP_URL);
            if (html) container.innerHTML = html;
            else status.textContent = 'No seed categories available.';
        })
        .catch(function (error) {
            status.textContent = 'Unable to load seed categories.';
            console.error('Error fetching categories for home section:', error);
        });
}

document.addEventListener('DOMContentLoaded', fetchAndRenderHomeSections);
