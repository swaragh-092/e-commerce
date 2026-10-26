(function ($) {
    'use strict';
    if (!$) return;
    var C = window.OrbiCatalog;
    var api = API_URL + 'wishlist';
    var items = [], busy = false, loaded = false, requestVersion = 0;
    var enabled = localStorage.getItem('wishlist_feature_enabled') !== 'false';

    function notify(title, message, type) {
        if (window.customAlert) window.customAlert(title, message, type || 'info', 2500);
    }
    function sessionId() {
        var id = localStorage.getItem('wishlistSessionId');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '')) {
            id = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
            localStorage.setItem('wishlistSessionId', id);
        }
        return id;
    }
    function request(path, method, body) {
        return fetch(api + path, { method: method || 'GET', headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId() }, body: body ? JSON.stringify(body) : undefined })
            .then(function (response) { return response.status === 204 && response.ok ? {} : C.readResponse(response); });
    }
    function productOf(item) { return item.Product || item.product || {}; }
    function lineOf(item) {
        var product = productOf(item), line = C.line(product, item.variant);
        line.id = String(item.productId || product.id);
        line.variantId = item.variantId || (item.variant && item.variant.id) || null;
        line.wishlistItemId = item.id || C.key(line);
        line.categorySlug = line.categorySlug || item.categorySlug || '';
        return line;
    }
    function remove(line) {
        return request('/items/' + encodeURIComponent(line.id) + (line.variantId ? '?variantId=' + encodeURIComponent(line.variantId) : ''), 'DELETE');
    }
    function syncHearts() {
        var keys = new Set(items.map(function (item) { return C.key(lineOf(item)); }));
        $('.wishlist-heart-btn').each(function () {
            var active = keys.has(C.key({ id: this.getAttribute('data-id'), variantId: this.getAttribute('data-variant-id') }));
            $(this).toggleClass('active', active).attr('aria-pressed', String(active)).attr('aria-label', active ? 'Remove from wishlist' : 'Add to wishlist').attr('title', active ? 'Remove from wishlist' : 'Add to wishlist').html(active ? '&#10084;' : '&#9825;');
        });
    }
    window.syncWishlistHearts = syncHearts;
    function render() {
        $('#header-wishlist-count').text(items.length);
        syncHearts();
        var $container = $('#dynamic-wishlist-container');
        if (!$container.length) return;
        var $actions = $container.siblings('.cart-buttons');
        $container.empty();
        if (!items.length) {
            $container.html(
                '<section class="enquiry-empty-state wishlist-empty-state" aria-labelledby="wishlist-empty-title">' +
                    '<div class="enquiry-empty-icon" aria-hidden="true">' +
                        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
                    '</div>' +
                    '<h2 id="wishlist-empty-title">Your wishlist is empty</h2>' +
                    '<p>Explore our seed varieties and save your favorite products to your wishlist. You can easily move them to your enquiry list whenever you\'re ready.</p>' +
                    '<div class="enquiry-empty-actions">' +
                        '<a class="enquiry-empty-primary" href="product.html">Browse Products</a>' +
                        '<a class="enquiry-empty-secondary" href="index.html">Back to Home</a>' +
                    '</div>' +
                '</section>'
            );
            $actions.hide();
            return;
        }
        $actions.show();
        items.forEach(function (item) {
            var line = lineOf(item), esc = C.escape;
            var $row = $('<div class="cart-inner">').attr('data-key', C.key(line)).data('line', line);
            $row.html('<button type="button" class="close-btn remove-wishlist-item" aria-label="Remove from wishlist">&times;</button>' +
                '<div class="cart-image"><a href="' + esc(C.productUrl(line)) + '"><img src="' + esc(line.image) + '" alt="' + esc(line.name) + '"></a></div>' +
                '<div class="cart-content"><h2><a href="' + esc(C.productUrl(line)) + '">' + esc(line.name) + '</a></h2>' +
                (line.variantLabel ? '<p class="cart-variant">' + esc(line.variantLabel) + '</p>' : '') +
                (line.sku ? '<p class="cart-variant">SKU: ' + esc(line.sku) + '</p>' : '') +
                '<div class="cart-bottom"><button type="button" class="view-product-btn move-to-cart-btn">Move to Enquiry List</button></div></div>');
            $row.find('img').on('error', function () { if (this.getAttribute('src') !== 'images/default-image.png') this.src = 'images/default-image.png'; });
            $container.append($row);
        });
    }
    function refresh() {
        var version = ++requestVersion;
        return request('').then(function (result) {
            if (version !== requestVersion) return;
            var data = result.data;
            items = Array.isArray(data) ? data : (data && data.items) || result.items || [];
            loaded = true; render();
        }).catch(function (error) {
            var $container = $('#dynamic-wishlist-container');
            if ($container.length && !loaded) {
                $container.empty().append($('<p role="alert">').text('Unable to load your wishlist. '), $('<button type="button" class="view-product-btn retry-wishlist">Try again</button>'));
                $container.siblings('.cart-buttons').hide();
            }
            throw error;
        });
    }
    function withBusy(action) {
        if (busy) return;
        busy = true;
        $('.wishlist-heart-btn, .remove-wishlist-item, .move-to-cart-btn, #move-all-to-cart-btn, #clear-wishlist-btn').attr('aria-busy', 'true');
        Promise.resolve().then(action).catch(function (error) { notify('Wishlist', error.message || 'Unable to update wishlist.', 'error'); }).finally(function () {
            busy = false;
            $('.wishlist-heart-btn, .remove-wishlist-item, .move-to-cart-btn, #move-all-to-cart-btn, #clear-wishlist-btn').removeAttr('aria-busy');
        });
    }
    async function move(line, resolve) {
        var resolved = await (resolve || C.resolveLine)(line);
        C.addToCart(resolved, line.wishlistItemId);
        try { await remove(line); }
        catch (error) { throw new Error('Added to your enquiry list. Could not remove it from the wishlist; retry to finish the move.'); }
    }
    $(document).on('click', '.wishlist-heart-btn', function (event) {
        event.preventDefault();
        if (!enabled || busy) return;
        var line;
        try { line = C.actionLine(this); } catch (error) { notify('Choose options', error.message, 'info'); return; }
        if (!line.id) return;
        withBusy(async function () {
            if (!loaded) await refresh();
            var exists = items.some(function (item) { return C.key(lineOf(item)) === C.key(line); });
            if (exists) await remove(line);
            else await request('/items', 'POST', { productId: line.id, variantId: line.variantId });
            await refresh();
            notify(exists ? 'Removed' : 'Added', line.name + (exists ? ' removed from wishlist.' : ' added to wishlist.'), 'success');
        });
    });
    $(document).on('click', '.remove-wishlist-item, .move-to-cart-btn', function (event) {
        event.preventDefault();
        var line = $(this).closest('.cart-inner').data('line'), moving = $(this).hasClass('move-to-cart-btn');
        if (!line) return;
        withBusy(async function () {
            try { if (moving) await move(line); else await remove(line); }
            catch (error) {
                if (moving && /choose|reopen|no longer/.test(error.message)) {
                    notify('Choose product options', error.message, 'info');
                    var $row = $('#dynamic-wishlist-container .cart-inner').filter(function () { return $(this).data('line') === line; });
                    $row.find('.cart-bottom').append($('<a class="view-product-btn">').attr('href', C.productUrl(line)).text('Choose options'));
                    return;
                }
                throw error;
            }
            await refresh();
        });
    });
    $(document).on('click', '#clear-wishlist-btn', function (event) {
        event.preventDefault(); withBusy(async function () { await request('/items', 'DELETE'); await refresh(); });
    });
    $(document).on('click', '#move-all-to-cart-btn', function (event) {
        event.preventDefault();
        withBusy(async function () {
            if (!loaded) await refresh();
            var failures = 0, resolve = C.createResolver();
            for (var item of items.slice()) {
                try { await move(lineOf(item), resolve); } catch (error) { failures++; }
            }
            await refresh();
            notify('Enquiry list', failures ? 'Some items need attention. Open them to choose available options, then move them again.' : 'Wishlist items moved to your enquiry list.', failures ? 'info' : 'success');
        });
    });
    $(document).on('click', '.retry-wishlist', function () { withBusy(refresh); });
    $(function () {
        C.getFeatures().then(function (features) {
            enabled = features.wishlist !== false;
            localStorage.setItem('wishlist_feature_enabled', String(enabled));
        }).catch(function () { /* Preserve the cached feature setting while offline. */ }).then(function () {
            if (!enabled) {
                $('<style>').text('.wishlist, .wishlist-heart-btn, a[href*="wishlist.html"] { display: none !important; }').appendTo('head');
                if (/wishlist\.html$/.test(window.location.pathname)) window.location.replace('index.html');
                return;
            }
            refresh().catch(function () { /* The wishlist page displays a retry action. */ });
        });
    });
})(window.jQuery);
