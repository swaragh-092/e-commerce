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
    C.imageUrl = function (url) {
        if (typeof url !== 'string' || !url.trim()) return 'images/orbi-seeds-logo.png';
        url = url.trim();
        if (/^https?:\/\//i.test(url)) return url;
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\\)/i.test(url)) return 'images/orbi-seeds-logo.png';
        if (url.charAt(0) === '/') return String(window.APP_URL || window.location.origin).replace(/\/+$/, '') + url;
        return url;
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
    // Product images stay shared; selecting a variant brings only its images first.
    C.galleryImages = function (product, variant) {
        var images = [], seen = new Set();
        function add(image) {
            if (!image) return;
            if (typeof image === 'string') image = { url: image };
            var raw = image.url || (image.media && image.media.url);
            if (typeof raw !== 'string' || !raw.trim()) return;
            var src = C.imageUrl(raw);
            if (src === 'images/orbi-seeds-logo.png' && raw.trim() !== src) return;
            var key;
            try { key = new URL(src, window.location.href).href; } catch (error) { return; }
            if (seen.has(key)) return;
            seen.add(key);
            images.push({ src: src, key: key, alt: image.alt || (image.media && image.media.alt) || product.name || 'Product' });
        }
        function ordered(rows) {
            return (Array.isArray(rows) ? rows : []).filter(Boolean).slice().sort(function (a, b) {
                return Number(!!b.isPrimary) - Number(!!a.isPrimary) || (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
            });
        }
        if (variant) {
            ordered(variant.images).forEach(add);
            add(variant.media);
        }
        ordered(product.images).forEach(add);
        if (!images.length) images.push({ src: 'images/orbi-seeds-logo.png', key: 'placeholder', alt: (product.name || 'Product') + ' — image unavailable', unavailable: true });
        return images;
    };

    var imageDialog, dialogGallery, dialogOpener, bodyOverflow;
    function cleanUpImageDialog() {
        if (!dialogGallery) return;
        document.body.style.overflow = bodyOverflow;
        dialogGallery = null;
        var opener = dialogOpener;
        dialogOpener = null;
        if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    }
    C.closeGallery = function () {
        if (imageDialog && imageDialog.open) { imageDialog.close(); cleanUpImageDialog(); }
    };
    function drawImageDialog() {
        if (!dialogGallery) return;
        var item = dialogGallery.images[dialogGallery.index];
        var img = imageDialog.querySelector('img');
        var src = item.failed ? 'images/orbi-seeds-logo.png' : item.src;
        if (img.getAttribute('src') !== src) img.src = src;
        img.alt = item.failed ? dialogGallery.label + ' — image unavailable' : item.alt;
        imageDialog.querySelector('h2').textContent = dialogGallery.label;
        imageDialog.querySelector('.product-gallery-count').textContent = dialogGallery.caption();
        imageDialog.querySelector('.product-image-dialog-nav').hidden = dialogGallery.images.length < 2;
    }
    function openImageDialog(gallery, opener) {
        if (!imageDialog) {
            imageDialog = document.createElement('dialog');
            imageDialog.className = 'product-image-dialog';
            imageDialog.setAttribute('aria-labelledby', 'product-image-dialog-title');
            imageDialog.innerHTML = '<div class="product-image-dialog-header"><h2 id="product-image-dialog-title"></h2>' +
                '<button type="button" class="product-image-dialog-close" autofocus>Close</button></div>' +
                '<div class="product-image-dialog-stage"><img alt=""></div>' +
                '<div class="product-image-dialog-nav"><button type="button" class="product-gallery-prev" aria-label="Previous image">&#8592;</button>' +
                '<span class="product-gallery-count" role="status"></span>' +
                '<button type="button" class="product-gallery-next" aria-label="Next image">&#8594;</button></div>';
            document.body.appendChild(imageDialog);
            imageDialog.querySelector('.product-image-dialog-close').addEventListener('click', C.closeGallery);
            imageDialog.querySelector('.product-gallery-prev').addEventListener('click', function () { if (dialogGallery) dialogGallery.move(-1); });
            imageDialog.querySelector('.product-gallery-next').addEventListener('click', function () { if (dialogGallery) dialogGallery.move(1); });
            imageDialog.querySelector('img').addEventListener('error', function () { if (dialogGallery) dialogGallery.fail(dialogGallery.images[dialogGallery.index]); });
            imageDialog.addEventListener('keydown', function (event) {
                if (dialogGallery && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                    event.preventDefault();
                    dialogGallery.move(event.key === 'ArrowLeft' ? -1 : 1);
                }
            });
            imageDialog.addEventListener('cancel', function (event) { event.preventDefault(); C.closeGallery(); });
            imageDialog.addEventListener('click', function (event) { if (event.target === imageDialog) C.closeGallery(); });
            imageDialog.addEventListener('close', function () {
                if (!imageDialog.open) cleanUpImageDialog();
            });
        }
        if (typeof imageDialog.showModal !== 'function') return;
        dialogGallery = gallery;
        dialogOpener = opener;
        drawImageDialog();
        if (!imageDialog.open) {
            bodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            imageDialog.showModal();
        }
    }
    C.mountGallery = function (section, product) {
        var host = section.querySelector('.products-left');
        if (!host) return null;
        host.classList.add('product-gallery');
        host.setAttribute('role', 'group');
        host.setAttribute('aria-label', (product.name || 'Product') + ' images');
        var open = document.createElement('button');
        open.type = 'button';
        open.className = 'product-gallery-open';
        var image = document.createElement('img');
        image.className = 'product-gallery-main';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.width = 400; image.height = 400;
        image.draggable = false;
        var enlarge = document.createElement('span');
        enlarge.className = 'product-gallery-enlarge';
        enlarge.textContent = 'View larger';
        open.append(image, enlarge);
        var controls = document.createElement('div');
        controls.className = 'product-gallery-controls';
        var previous = document.createElement('button');
        previous.type = 'button'; previous.className = 'product-gallery-prev';
        previous.textContent = '←'; previous.setAttribute('aria-label', 'Previous image of ' + product.name);
        var count = document.createElement('span');
        count.className = 'product-gallery-count';
        count.setAttribute('role', 'status');
        var next = document.createElement('button');
        next.type = 'button'; next.className = 'product-gallery-next';
        next.textContent = '→'; next.setAttribute('aria-label', 'Next image of ' + product.name);
        controls.append(previous, count, next);
        var thumbs = document.createElement('div');
        thumbs.className = 'product-gallery-thumbnails';
        thumbs.setAttribute('role', 'group');
        thumbs.setAttribute('aria-label', 'Choose an image of ' + product.name);
        var message = document.createElement('p');
        message.className = 'product-gallery-message';
        message.setAttribute('role', 'status');
        host.replaceChildren(open, controls, thumbs, message);
        var failed = new Set(), thumbnailButtons = [], suppressOpen = false, touch;
        var gallery = {
            images: [], index: 0, variant: undefined, label: product.name || 'Product',
            caption: function () { return 'Image ' + (gallery.index + 1) + ' of ' + gallery.images.length; },
            select: function (index) {
                gallery.index = (index + gallery.images.length) % gallery.images.length;
                render();
            },
            move: function (offset) { gallery.select(gallery.index + offset); },
            fail: function (item) {
                if (!item || item.failed || item.unavailable) return;
                failed.add(item.key); item.failed = true;
                var thumbnail = thumbnailButtons[gallery.images.indexOf(item)];
                if (thumbnail) thumbnail.querySelector('img').src = 'images/orbi-seeds-logo.png';
                render();
            },
            update: function (variant) {
                if (gallery.variant === variant && gallery.images.length) return;
                gallery.variant = variant;
                gallery.label = (product.name || 'Product') + (variant ? ' — ' + C.variantLabel(variant) : '');
                gallery.images = C.galleryImages(product, variant);
                gallery.images.forEach(function (item) { item.failed = failed.has(item.key); });
                gallery.index = 0;
                thumbs.replaceChildren(); thumbnailButtons = [];
                gallery.images.forEach(function (item, index) {
                    var button = document.createElement('button');
                    button.type = 'button'; button.className = 'product-gallery-thumbnail';
                    button.setAttribute('aria-label', 'View image ' + (index + 1) + ' of ' + product.name + ': ' + item.alt);
                    var img = document.createElement('img');
                    img.src = item.failed ? 'images/orbi-seeds-logo.png' : item.src;
                    img.alt = ''; img.loading = 'lazy'; img.width = 48; img.height = 48;
                    img.addEventListener('error', function () { gallery.fail(item); });
                    button.appendChild(img);
                    button.addEventListener('click', function () { gallery.select(index); });
                    button.addEventListener('keydown', function (event) {
                        var target;
                        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = index + 1;
                        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = index - 1;
                        else if (event.key === 'Home') target = 0;
                        else if (event.key === 'End') target = gallery.images.length - 1;
                        else return;
                        event.preventDefault(); gallery.select(target);
                        thumbnailButtons[gallery.index].focus({ preventScroll: true });
                        thumbnailButtons[gallery.index].scrollIntoView({ block: 'nearest', inline: 'nearest' });
                    });
                    thumbnailButtons.push(button); thumbs.appendChild(button);
                });
                render();
            }
        };
        function render() {
            var item = gallery.images[gallery.index];
            var unavailable = item.failed || item.unavailable;
            var src = unavailable ? 'images/orbi-seeds-logo.png' : item.src;
            if (image.getAttribute('src') !== src) image.src = src;
            image.alt = unavailable ? gallery.label + ' — image unavailable' : item.alt;
            open.disabled = !!unavailable;
            open.setAttribute('aria-label', 'Enlarge image ' + (gallery.index + 1) + ' of ' + gallery.label);
            enlarge.hidden = !!unavailable;
            controls.hidden = thumbs.hidden = gallery.images.length < 2;
            count.textContent = gallery.caption();
            message.textContent = unavailable ? 'Image unavailable' : '';
            thumbnailButtons.forEach(function (button, index) { button.setAttribute('aria-pressed', String(index === gallery.index)); });
            if (dialogGallery === gallery && imageDialog.open) drawImageDialog();
        }
        image.addEventListener('error', function () { gallery.fail(gallery.images[gallery.index]); });
        previous.addEventListener('click', function () { gallery.move(-1); });
        next.addEventListener('click', function () { gallery.move(1); });
        open.addEventListener('click', function (event) {
            if (suppressOpen) { suppressOpen = false; event.preventDefault(); return; }
            openImageDialog(gallery, open);
        });
        open.addEventListener('pointerdown', function (event) {
            suppressOpen = false;
            touch = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
        });
        open.addEventListener('pointercancel', function () { touch = null; });
        open.addEventListener('pointerup', function (event) {
            if (!touch) return;
            var dx = event.clientX - touch.x, dy = event.clientY - touch.y;
            touch = null;
            if (gallery.images.length > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                suppressOpen = true;
                gallery.move(dx < 0 ? 1 : -1);
            }
        });
        return gallery;
    };

    C.line = function (product, variant) {
        var unitRow = (product.attributes || []).find(function (a) { return /^(unit|uom)$/i.test(a.customName || (a.attribute && a.attribute.name) || ''); });
        return {
            id: String(product.id), name: product.name || 'Product', type: product.type,
            variantId: variant ? variant.id : null, variantLabel: C.variantLabel(variant), sku: (variant && variant.sku) || product.sku || '',
            image: C.galleryImages(product, variant)[0].src,
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
    C.addToCart = function (line, transferId) {
        var cart = C.getCart(), existing = cart.find(function (i) { return C.key(i) === C.key(line); });
        if (existing) {
            if (transferId && (existing.wishlistTransfers || []).includes(transferId)) return;
            existing.quantity = Math.min(99999, existing.quantity + 1);
            if (transferId) existing.wishlistTransfers = (existing.wishlistTransfers || []).concat(transferId);
        }
        else {
            if (cart.length >= 100) throw new Error('Your enquiry list has 100 items. Submit it before adding more.');
            cart.push(Object.assign({}, line, { quantity: 1, wishlistTransfers: transferId ? [transferId] : [] }));
        }
        C.saveCart(cart);
    };
    C.productUrl = function (line) {
        if (!line.slug) return 'product.html';
        var url = 'product.html?slug=' + encodeURIComponent(line.slug);
        if (line.categorySlug) url += '&category=' + encodeURIComponent(line.categorySlug);
        if (line.variantId) url += '&variant=' + encodeURIComponent(line.variantId);
        return url;
    };
    C.readResponse = function (response) {
        return response.json().then(function (result) {
            if (!response.ok || result.success === false) throw new Error((result.error && result.error.message) || 'Unable to complete the request. Please try again.');
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
        var gallery = C.mountGallery(section, product);
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
            if (gallery) gallery.update(variant);
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
