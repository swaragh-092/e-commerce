/* Shared product/variant identity for the static storefront. */
(function (window) {
    'use strict';
    if (window.OrbiCatalog) return;
    var C = {};
    C.escape = function (value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    C.imageAlt = function (image, fallback) {
        var mediaAlt = image && image.media && image.media.alt;
        if (typeof mediaAlt === 'string' && mediaAlt.trim()) return mediaAlt.trim();
        var imageAlt = typeof image?.alt === 'string' ? image.alt.trim() : '';
        // Older product records copied the upload's filename into the alt field.
        if (imageAlt && !/\.(?:avif|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i.test(imageAlt) && !/^product image$/i.test(imageAlt)) {
            return imageAlt;
        }
        return (fallback || '').trim();
    };
    C.imageUrl = function (url) {
        if (typeof url !== 'string' || !url.trim()) return 'images/orbi-seeds-logo.png';
        url = url.trim();
        if (/^https?:\/\//i.test(url)) return url;
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\\)/i.test(url)) return 'images/orbi-seeds-logo.png';
        if (url.charAt(0) === '/') return String(window.APP_URL || window.location.origin).replace(/\/+$/, '') + url;
        return url.startsWith('uploads/') ? String(window.APP_URL || window.location.origin).replace(/\/+$/, '') + '/' + url : url;
    };
    var bannerRequests = new WeakMap();
    C.setCategoryBanner = function (element, source) {
        var url = C.imageUrl(source);
        if (bannerRequests.get(element)?.url === url) return;
        var request = { url: url };
        bannerRequests.set(element, request);
        element.style.backgroundImage = '';
        element.classList.remove('banner-fallback');
        if (url === 'images/orbi-seeds-logo.png') {
            element.classList.add('banner-fallback');
            return;
        }

        var image = new window.Image();
        image.onload = function () {
            if (bannerRequests.get(element) === request) {
                element.style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
            }
        };
        image.onerror = function () {
            if (bannerRequests.get(element) === request) element.classList.add('banner-fallback');
        };
        image.src = url;
    };
    C.valueLabel = function (value, attribute) {
        value = value || {};
        var label = String(value.displayLabel || value.value || '');
        var unit = String(value.unitLabel || (attribute && attribute.unit) || '').trim();
        if (unit && !label.toLowerCase().endsWith(unit.toLowerCase())) {
            label += (/^(g|kg|mg|mm|cm|m|in|ft|ml|l)$/i.test(unit) ? '' : ' ') + unit;
        }
        return label;
    };
    C.entries = function (variant) {
        return ((variant && variant.options) || []).map(function (o) {
            return {
                id: o.attributeId || (o.attribute && o.attribute.id), name: o.attribute && o.attribute.name,
                valueId: o.valueId || (o.value && o.value.id), label: C.valueLabel(o.value, o.attribute),
                order: o.attributeOrder == null ? ((o.attribute && o.attribute.sortOrder) || 0) : o.attributeOrder,
                valueOrder: o.valueOrder == null ? ((o.value && o.value.sortOrder) || 0) : o.valueOrder
            };
        }).filter(function (o) { return o.id && o.valueId && o.name && o.label; }).sort(function (a, b) { return a.order - b.order; });
    };
    C.variants = function (product) {
        return ((product && product.variants) || []).filter(function (v) { return v.isActive !== false; });
    };
    C.hasVariants = function (product) { return product.type === 'variable' || C.variants(product).length > 0; };
    C.variantLabel = function (variant) {
        return C.entries(variant).map(function (o) { return o.name + ': ' + o.label; }).join(', ') || (variant && (variant.optionLabel || variant.sku)) || '';
    };
    C.groups = function (product) {
        var groups = new Map();
        C.variants(product).forEach(function (v) {
            C.entries(v).forEach(function (o) {
                if (!groups.has(o.id)) groups.set(o.id, { id: o.id, name: o.name, order: o.order, values: [] });
                var group = groups.get(o.id);
                if (!group.values.some(function (v) { return v.id === o.valueId; })) group.values.push({ id: o.valueId, label: o.label, order: o.valueOrder });
            });
        });
        return Array.from(groups.values()).sort(function (a, b) { return a.order - b.order; }).map(function (g) {
            g.values.sort(function (a, b) { return a.order - b.order; }); return g;
        });
    };
    C.matchVariant = function (product, selected) {
        var ids = Object.keys(selected).filter(function (id) { return selected[id]; });
        if (!ids.length) return null;
        return C.variants(product).find(function (v) {
            var options = C.entries(v);
            return options.length === ids.length && ids.every(function (id) { return options.some(function (o) { return o.id === id && o.valueId === selected[id]; }); });
        }) || null;
    };
    function primaryImage(images) {
        var ordered = (images || []).slice().sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
        var available = ordered.filter(function (image) { return image.url || (image.media && image.media.url); });
        return available.find(function (image) { return image.isPrimary; }) || available[0];
    }
    C.line = function (product, variant) {
        var unitRow = (product.attributes || []).find(function (a) { return /^(unit|uom)$/i.test(a.customName || (a.attribute && a.attribute.name) || ''); });
        var image = primaryImage(variant && variant.images) || (variant && variant.media && variant.media.url && variant.media) || primaryImage(product.images);
        var variantLabel = C.variantLabel(variant);
        return {
            id: String(product.id), name: product.name || 'Product', type: product.type,
            variantId: variant ? variant.id : null, variantLabel: variantLabel, sku: (variant && variant.sku) || product.sku || '',
            image: C.imageUrl(image && (image.url || image.media.url)),
            imageAlt: C.imageAlt(image, (product.name || 'Product') + (variantLabel ? ' — ' + variantLabel : '')),
            slug: product.slug || '', categorySlug: (product.categories && product.categories[0] && product.categories[0].slug) || (product.category && product.category.slug) || '',
            unit: product.unit || (unitRow && (unitRow.customValue || C.valueLabel(unitRow.value, unitRow.attribute))) || '', quantity: 1
        };
    };
    C.key = function (line) { return String(line.id || line.productId) + ':' + (line.variantId || ''); };
    C.quantity = function (value) {
        var n = Number(value);
        return Number.isSafeInteger(n) && n >= 1 && n <= 99999 ? n : null;
    };
    C.getCart = function () {
        try {
            var raw = JSON.parse(localStorage.getItem('enquiryCart') || '[]');
            if (!Array.isArray(raw)) return [];
            var lines = new Map();
            raw.filter(function (i) { return i && (i.id || i.productId); }).forEach(function (i) {
                var line = Object.assign({}, i, { id: String(i.id || i.productId), variantId: i.variantId || null, quantity: C.quantity(i.quantity) || 1 });
                var key = C.key(line);
                if (lines.has(key)) lines.get(key).quantity = Math.min(99999, lines.get(key).quantity + line.quantity);
                else lines.set(key, line);
            });
            return Array.from(lines.values());
        } catch (e) { return []; }
    };
    C.saveCart = function (cart) {
        localStorage.setItem('enquiryCart', JSON.stringify(cart));
        window.dispatchEvent(new Event('orbi:cart-change'));
    };
    C.addToCart = function (line, { transferId, incrementExisting = true } = {}) {
        var cart = C.getCart(), existing = cart.find(function (i) { return C.key(i) === C.key(line); });
        if (existing) {
            if (!incrementExisting || (transferId && (existing.wishlistTransfers || []).includes(transferId))) return false;
            existing.quantity = Math.min(99999, existing.quantity + 1);
            if (transferId) existing.wishlistTransfers = (existing.wishlistTransfers || []).concat(transferId);
        }
        else {
            if (cart.length >= 100) throw new Error('Your enquiry list has 100 items. Submit it before adding more.');
            cart.push(Object.assign({}, line, { quantity: 1, wishlistTransfers: transferId ? [transferId] : [] }));
        }
        C.saveCart(cart);
        return true;
    };
    C.productUrl = function (line) {
        if (!line.slug) return 'product.html';
        var url = 'products.html?slug=' + encodeURIComponent(line.slug);
        if (line.categorySlug) url += '&category=' + encodeURIComponent(line.categorySlug);
        if (line.variantId) url += '&variant=' + encodeURIComponent(line.variantId);
        return url;
    };
    C.readResponse = function (response) {
        return response.json().then(function (result) {
            if (!response.ok || result.success === false) {
                var error = new Error((result.error && result.error.message) || 'Unable to complete the request. Please try again.');
                error.status = response.status;
                throw error;
            }
            return result;
        });
    };
    var featureRequest;
    C.getFeatures = function () {
        if (!featureRequest) featureRequest = fetch(window.API_URL + 'settings/features').then(C.readResponse).then(function (r) { return (r.data && r.data.features) || {}; });
        return featureRequest;
    };
    C.fetchProduct = function (slug) {
        return fetch(window.API_URL + 'products/' + encodeURIComponent(slug) + '?include=categories,attributes,variants').then(C.readResponse).then(function (r) { return r.data; });
    };
    C.createResolver = function () {
        var products = new Map();
        return function (line) {
            if (!line.slug) return Promise.reject(new Error('Please reopen this product and choose its options.'));
            if (!products.has(line.slug)) products.set(line.slug, C.fetchProduct(line.slug));
            return products.get(line.slug).then(function (product) {
                if (!product || String(product.id) !== String(line.id)) throw new Error('This product is no longer available.');
                var variant = C.variants(product).find(function (v) { return v.id === line.variantId; });
                if ((line.variantId && !variant) || (C.hasVariants(product) && !variant)) throw new Error('Please choose an available option for ' + product.name + '.');
                return Object.assign(C.line(product, variant), { quantity: C.quantity(line.quantity) || 1 });
            });
        };
    };
    C.resolveLine = function (line) { return C.createResolver()(line); };
    C.resolveLines = function (lines) { return Promise.all(lines.map(C.createResolver())); };
    C.actionLine = function (button) {
        var section = button.closest('.product-sec');
        if (section && section.orbiProduct) {
            if (C.hasVariants(section.orbiProduct) && !section.orbiVariant) {
                var select = section.querySelector('.variant-select');
                if (select) select.focus();
                throw new Error('Please choose all product options first.');
            }
            return C.line(section.orbiProduct, section.orbiVariant);
        }
        return {
            id: button.getAttribute('data-id'), name: button.getAttribute('data-name'), variantId: button.getAttribute('data-variant-id') || null,
            variantLabel: button.getAttribute('data-variant-label') || '', image: C.imageUrl(button.getAttribute('data-image')),
            slug: button.getAttribute('data-slug') || '', categorySlug: button.getAttribute('data-category') || '', unit: button.getAttribute('data-unit') || '', quantity: 1
        };
    };
    C.syncEnquiryButtons = function (root = document) {
        var cartItems = new Map(C.getCart().map(function (item) { return [C.key(item), item]; }));
        root.querySelectorAll('.add-enquiry-list').forEach(function (button) {
            var section = button.closest('.product-sec');
            var needsOption = section?.orbiProduct && C.hasVariants(section.orbiProduct) && !section.orbiVariant;
            var item = !needsOption && cartItems.get(C.key({ id: button.dataset.id, variantId: button.dataset.variantId }));
            var controls = button.parentElement.querySelector('.product-enquiry-quantity');
            button.setAttribute('aria-disabled', String(Boolean(needsOption)));
            if (!controls) return;
            button.hidden = !!item;
            controls.hidden = !item;
            if (!item) return;

            controls.querySelector('output').value = item.quantity;
            controls.querySelector('[data-enquiry-step="-1"]').setAttribute('aria-label',
                item.quantity === 1 ? 'Remove from enquiry list' : 'Decrease enquiry quantity');
            controls.querySelector('[data-enquiry-step="1"]').disabled = C.quantity(item.quantity + 1) === null;
        });
    };
    // Rich descriptions keep formatting; executable markup and arbitrary attributes are discarded.
    C.description = function (html) {
        var template = document.createElement('template');
        template.innerHTML = html || '';
        var allowed = /^(P|BR|B|STRONG|I|EM|U|S|UL|OL|LI|H[2-6]|BLOCKQUOTE|DIV|SPAN|SUB|SUP|A|TABLE|THEAD|TBODY|TR|TD|TH)$/;
        Array.from(template.content.querySelectorAll('*')).reverse().forEach(function (node) {
            if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|FORM|INPUT|BUTTON|TEMPLATE)$/.test(node.tagName)) { node.remove(); return; }
            if (!allowed.test(node.tagName)) { node.replaceWith.apply(node, Array.from(node.childNodes)); return; }
            var href = node.tagName === 'A' ? node.getAttribute('href') || '' : '';
            Array.from(node.attributes).forEach(function (attr) { node.removeAttribute(attr.name); });
            if (/^https?:\/\//i.test(href)) { node.setAttribute('href', href); node.setAttribute('rel', 'noopener noreferrer'); }
        });
        return template.innerHTML;
    };
    C.mountOptions = function (section, product, requestedVariant) {
        section.orbiProduct = product;
        section.orbiVariant = null;
        var host = section.querySelector('.product-options');
        var status = section.querySelector('.product-selection-status');
        var price = section.querySelector('.product-selected-price');
        var image = section.querySelector('.products-left img');
        var variants = C.variants(product), groups = C.groups(product), selected = {};
        var variable = C.hasVariants(product);
        // Old SKUs without complete option metadata remain selectable by their SKU.
        var bySku = variable && (!groups.length || variants.some(function (v) { return C.entries(v).length !== groups.length; }));
        var preselected = requestedVariant ? variants.find(function (v) { return v.id === requestedVariant || v.sku === requestedVariant; }) : null;
        if (!preselected && !requestedVariant && variants.length === 1) preselected = variants[0];
        if (preselected) C.entries(preselected).forEach(function (o) { selected[o.id] = o.valueId; });
        if (variable && variants.length) {
            var html = '<fieldset class="product-options-fieldset">' +
                '<div class="product-options-header">' +
                '<span class="product-options-title">Choose your options</span>' +
                '<button type="button" class="reset-product-options">Clear selection</button>' +
                '</div>' +
                '<div class="product-options-body">';
            if (bySku) {
                html += '<label>Variant <span class="required-star">*</span><select class="variant-select" data-attribute="sku"><option value="">Select an option</option>';
                variants.forEach(function (v) { html += '<option value="' + C.escape(v.id) + '">' + C.escape(C.variantLabel(v) || v.id) + '</option>'; });
                html += '</select></label>';
            } else groups.forEach(function (g) {
                html += '<label>' + C.escape(g.name) + ' <span class="required-star">*</span><select class="variant-select" data-attribute="' + C.escape(g.id) + '"><option value="">Select ' + C.escape(g.name) + '</option>';
                g.values.forEach(function (v) { html += '<option value="' + C.escape(v.id) + '">' + C.escape(v.label) + '</option>'; });
                html += '</select></label>';
            });
            html += '</div></fieldset>';
            host.innerHTML = html;
        }
        function update(variant) {
            section.orbiVariant = variant;
            var ready = !variable || !!variant;
            var line = C.line(product, variant);
            image.src = line.image;
            image.alt = line.imageAlt;
            if (variable && !variants.length) status.textContent = 'No options are currently available for this product.';
            else if (!ready) status.textContent = requestedVariant && !preselected ? 'The saved option is no longer available. Choose another option.' : '';
            else {
                var stock = variant ? variant.stockQty : product.quantity;
                var reserved = variant ? variant.reservedQty : product.reservedQty;
                status.textContent = [line.variantLabel, line.sku ? 'SKU: ' + line.sku : '', stock == null ? '' : Number(stock) - Number(reserved || 0) > 0 ? 'In stock' : 'Currently out of stock. You can still enquire.'].filter(Boolean).join(' · ');
            }
            var priced = variant || product;
            var amount = priced.unitPrice == null ? priced.effectivePrice : priced.unitPrice;
            if (amount == null) amount = priced.price;
            price.textContent = ready && amount != null && Number.isFinite(Number(amount)) ? 'Price: ' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
            section.querySelectorAll('.wishlist-heart-btn, .add-enquiry-list, .open-enquiry-popup').forEach(function (button) {
                button.setAttribute('aria-disabled', ready ? 'false' : 'true');
                button.setAttribute('data-variant-id', line.variantId || '');
                button.setAttribute('data-variant-label', line.variantLabel);
            });
            if (!bySku) host.querySelectorAll('select').forEach(function (select) {
                var id = select.getAttribute('data-attribute');
                select.value = selected[id] || '';
                Array.from(select.options).forEach(function (option) {
                    option.disabled = !!option.value && !variants.some(function (v) {
                        var entries = C.entries(v);
                        return entries.some(function (o) { return o.id === id && o.valueId === option.value; }) && Object.keys(selected).every(function (other) {
                            return other === id || !selected[other] || entries.some(function (o) { return o.id === other && o.valueId === selected[other]; });
                        });
                    });
                });
            });
            C.syncEnquiryButtons(section);
            if (window.syncWishlistHearts) window.syncWishlistHearts();
        }
        host.addEventListener('change', function (event) {
            if (!event.target.matches('select.variant-select')) return;
            requestedVariant = null;
            if (bySku) update(variants.find(function (v) { return v.id === event.target.value; }) || null);
            else {
                selected[event.target.getAttribute('data-attribute')] = event.target.value;
                update(C.matchVariant(product, selected));
            }
            if (section.orbiVariant) {
                var params = new URLSearchParams(window.location.search);
                params.set('slug', product.slug); params.set('variant', section.orbiVariant.id);
                window.history.replaceState(null, '', '?' + params.toString());
            }
        });
        var reset = host.querySelector('.reset-product-options');
        if (reset) reset.addEventListener('click', function () {
            selected = {}; requestedVariant = null;
            host.querySelectorAll('select').forEach(function (select) { select.value = ''; });
            var params = new URLSearchParams(window.location.search);
            if (params.get('slug') === product.slug) { params.delete('variant'); window.history.replaceState(null, '', '?' + params.toString()); }
            update(null);
        });
        if (bySku && preselected) host.querySelector('select').value = preselected.id;
        update(preselected || null);
    };
    window.OrbiCatalog = C;
})(window);
