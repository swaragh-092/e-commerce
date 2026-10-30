$(document).ready(function () {
    var C = window.OrbiCatalog;
    var ENQUIRY_API_URL = API_URL + "enquiries";
    var enquiryEnabled = true;
    var detailCache = new Map(), detailQueue = [], activeDetailRequests = 0;
    C.getFeatures().then(function (features) {
        enquiryEnabled = features.enquiry !== false;
        if (!enquiryEnabled) $('<style>').text('.add-enquiry-list, .open-enquiry-popup, .move-to-cart-btn, #move-all-to-cart-btn, #cart-enquiry-btn, a[href*="enquiry-list.html"] { display: none !important; }').appendTo('head');
    }).catch(function () { /* Keep the page usable when feature settings cannot be refreshed. */ });

    /* ========================================================
       NEWSLETTER / FUTURE PRODUCTS API CONFIGURATION
       Endpoint: POST /api/newsletter/subscribe
       ======================================================== */
    var NEWSLETTER_API_URL = (typeof API_URL !== 'undefined' ? API_URL : "https://eshopadmin.swaragh.org.in/api/").replace(/\/+$/, '') + "/newsletter/subscribe";

    function subscribeNewsletter(subscriberData) {
        var email = typeof subscriberData === 'string' ? subscriberData.trim() : (subscriberData && subscriberData.email ? subscriberData.email.trim() : '');
        if (!email) {
            return Promise.resolve();
        }

        var payload = {
            email: email,
            source: (subscriberData && subscriberData.source) ? subscriberData.source : "orbi-enquiry"
        };

        return fetch(NEWSLETTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        }).then(C.readResponse);
    }

    window.subscribeNewsletter = subscribeNewsletter;

    function customAlert(title, text, type, timer) {
        var icon = type === 'success' ? 'OK' : (type === 'error' ? '!' : 'i');
        var color = type === 'success' ? '#58AE68' : (type === 'error' ? '#dc3545' : '#71C5DD');
        var toastKey = [type || '', title || '', text || ''].join('|');
        var safeToastKey = C.escape(toastKey);
        var html = `
        <div class="custom-toast" data-toast-key="${safeToastKey}" style="border-left: 4px solid ${color};">
            <div class="custom-toast-icon" style="background:${color};">${icon}</div>
            <div class="custom-toast-content"><strong>${C.escape(title)}</strong> ${C.escape(text)}</div>
            ${!timer ? `<button class="custom-toast-btn" style="color:${color};">OK</button>` : ''}
        </div>`;

        var $container = $('.custom-toast-container');
        if ($container.length === 0) {
            $('body').append('<div class="custom-toast-container"></div>');
            $container = $('.custom-toast-container');
        }

        if (type === 'error') {
            $container.find('.custom-toast').remove();
        } else if ($container.find('.custom-toast').filter(function () { return this.getAttribute('data-toast-key') === toastKey; }).length > 0) {
            return { then: function (callback) { if (typeof callback === 'function') callback(); } };
        }

        var $toast = $(html);
        $container.append($toast);
        setTimeout(function () { $toast.addClass('show'); }, 10);

        function close() {
            $toast.removeClass('show');
            setTimeout(function () { $toast.remove(); }, 300);
        }

        if (timer) setTimeout(close, timer);
        else $toast.find('.custom-toast-btn').on('click', close);

        return {
            then: function (callback) {
                if (timer) setTimeout(callback, timer);
                else $toast.find('.custom-toast-btn').on('click', callback);
            }
        };
    }

    window.customAlert = customAlert;

    function customConfirm(title, text, confirmText, callback) {
        var html = `
        <div class="custom-confirm-overlay">
            <div class="custom-confirm-box">
                <h3>${C.escape(title)}</h3>
                <p>${C.escape(text)}</p>
                <div class="custom-confirm-actions">
                    <button class="custom-confirm-cancel">Cancel</button>
                    <button class="custom-confirm-ok">${C.escape(confirmText)}</button>
                </div>
            </div>
        </div>`;
        $('body').append(html);
        var $overlay = $('.custom-confirm-overlay').last();
        setTimeout(function () { $overlay.addClass('show'); }, 10);

        function close() {
            $overlay.removeClass('show');
            setTimeout(function () { $overlay.remove(); }, 300);
        }

        $overlay.find('.custom-confirm-cancel').on('click', close);
        $overlay.find('.custom-confirm-ok').on('click', function () { close(); if (callback) callback(); });
    }

    function getCart() { return C.getCart(); }
    function saveCart(cart) { C.saveCart(cart); }
    function updateHeaderCounter() { $('#header-enquiry-count').text(getCart().length); updateEnquirySummary(); }
    window.addEventListener('orbi:cart-change', updateHeaderCounter);
    window.addEventListener('storage', function (event) {
        if (event.key === 'enquiryCart') { updateHeaderCounter(); renderCart(); }
    });

    $(document).on('click', '.add-enquiry-list', function (e) {
        e.preventDefault();
        if (!enquiryEnabled) return;
        try {
            var line = C.actionLine(this);
            if (!line.id) return;
            C.addToCart(line);
            customAlert('Added!', line.name + (line.variantLabel ? ' (' + line.variantLabel + ')' : '') + ' has been added to your enquiry list.', 'success', 2000);
        } catch (error) { customAlert('Enquiry list', error.message, 'error', 2500); }
    });

    function listIcon(path) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
    }
    function itemDetails(item) {
        var record = detailCache.get(item.slug), product = record && record.product;
        if (!product || String(product.id) !== String(item.id)) return { line: item, status: product ? 'error' : record && record.status };
        var variant = C.variants(product).find(function (option) { return option.id === item.variantId; });
        var review = !!((item.variantId || C.hasVariants(product)) && !variant);
        var fresh = C.line(product, variant);
        if (review) {
            fresh.variantId = item.variantId;
            fresh.variantLabel = item.variantLabel;
            fresh.sku = item.sku;
        }
        return { line: Object.assign({}, item, fresh, { quantity: item.quantity }), product: product, status: record.status, review: review };
    }
    function productExcerpt(product) {
        var template = document.createElement('template');
        template.innerHTML = C.description(product.description);
        template.content.querySelectorAll('p, div, li, br, tr, h2, h3, h4, h5, h6').forEach(function (node) { node.appendChild(document.createTextNode(' ')); });
        var text = (template.content.textContent || '').replace(/\s+/g, ' ').trim();
        var characters = Array.from(text);
        return characters.length > 220 ? characters.slice(0, 217).join('').trim() + '…' : text;
    }
    function productSpecifications(product) {
        var groups = new Map();
        (product.attributes || []).filter(Boolean).slice().sort(function (a, b) {
            return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
        }).forEach(function (row) {
            var name = String(row.customName || (row.attribute && row.attribute.name) || '').trim();
            var value = String(row.customValue || C.valueLabel(row.value, row.attribute)).trim();
            if (!name || !value || /^(unit|uom)$/i.test(name)) return;
            if (!groups.has(name)) groups.set(name, []);
            if (groups.get(name).indexOf(value) === -1) groups.get(name).push(value);
        });
        return Array.from(groups).slice(0, 4).map(function (entry) {
            return '<div><dt>' + C.escape(entry[0]) + '</dt><dd>' + C.escape(entry[1].join(', ')) + '</dd></div>';
        }).join('');
    }
    function productInfo(item) {
        var details = itemDetails(item), line = details.line, product = details.product, esc = C.escape;
        var category = product ? (product.categories || (product.category ? [product.category] : [])).map(function (entry) { return entry.name; }).filter(Boolean).join(' · ') : item.categoryName;
        var html = '<div class="enquiry-item-header">' + (category ? '<span class="enquiry-product-category">' + esc(category) + '</span>' : '') +
            '<h3 class="enquiry-item-title"><a href="' + esc(C.productUrl(line)) + '">' + esc(line.name) + '</a></h3><div class="enquiry-item-meta">' +
            (line.variantLabel && line.variantLabel !== line.sku ? '<span class="enquiry-option">' + esc(line.variantLabel) + '</span>' : '') +
            (line.sku ? '<span>SKU: ' + esc(line.sku) + '</span>' : '') + '</div></div><div class="enquiry-item-details">';
        if (product) {
            var specifications = productSpecifications(product), excerpt = productExcerpt(product);
            if (specifications) html += '<dl class="enquiry-item-specs">' + specifications + '</dl>';
            if (excerpt) html += '<p class="enquiry-item-description">' + esc(excerpt) + '</p>';
        }
        if (details.status === 'loading') html += '<div class="enquiry-details-status" role="status">Loading product details…</div>';
        if (details.status === 'error') html += '<div class="enquiry-details-status" role="status">More details could not be loaded.<button type="button" class="enquiry-details-retry">Retry</button></div>';
        if (details.review) html += '<div class="enquiry-details-status">Review this product to confirm your selected options.</div>';
        return html + '</div>';
    }
    function updateEnquirySummary() {
        if (!document.getElementById('enquiry-summary-details')) return;
        var cart = getCart(), groups = new Map();
        cart.forEach(function (item) {
            var unit = itemDetails(item).line.unit || '';
            groups.set(unit, (groups.get(unit) || 0) + item.quantity);
        });
        $('#enquiry-item-count').text(cart.length + (cart.length === 1 ? ' item' : ' items'));
        var html = '<div><dt>Selected items</dt><dd>' + cart.length + '</dd></div>';
        groups.forEach(function (quantity, unit) {
            html += '<div><dt>' + C.escape(unit ? 'Quantity (' + unit + ')' : 'Quantity') + '</dt><dd>' + quantity + '</dd></div>';
        });
        $('#enquiry-summary-details').html(html);
    }
    function patchProductDetails(slug) {
        var cart = getCart();
        $('#dynamic-cart-container .cart-inner').each(function () {
            var row = this, item = cart.find(function (line) { return C.key(line) === row.getAttribute('data-key'); });
            if (!item || item.slug !== slug) return;
            var details = itemDetails(item), line = details.line, $row = $(row);
            // Patch only product information: an unfinished quantity and its focus must survive.
            var $info = $row.find('.enquiry-item-info'), restoreFocus = $info[0].contains(document.activeElement);
            $info.html(productInfo(item));
            var image = $row.find('img')[0], source = C.imageUrl(line.image);
            if (image.getAttribute('src') !== source) {
                image.classList.toggle('is-placeholder', source === 'images/orbi-seeds-logo.png');
                image.src = source;
            }
            image.alt = line.name;
            $row.find('.cart-image a, .enquiry-view-product').attr('href', C.productUrl(line));
            $row.find('.enquiry-view-product').text(details.review ? 'Review options' : 'View full details');
            $row.find('.enquiry-quantity-label').text(line.unit ? 'Quantity (' + line.unit + ')' : 'Quantity');
            if (restoreFocus) $row.find('.enquiry-view-product')[0].focus({ preventScroll: true });
        });
        updateEnquirySummary();
    }
    function processDetailQueue() {
        while (activeDetailRequests < 4 && detailQueue.length) {
            (function (slug) {
                if (!getCart().some(function (item) { return item.slug === slug; })) {
                    detailCache.delete(slug);
                    return;
                }
                activeDetailRequests++;
                Promise.resolve().then(function () { return C.fetchProduct(slug); }).then(function (product) {
                    if (!product || !product.id) throw new Error('Product unavailable');
                    detailCache.set(slug, { status: 'ready', product: product });
                }).catch(function () {
                    detailCache.set(slug, { status: 'error' });
                }).finally(function () {
                    activeDetailRequests--;
                    patchProductDetails(slug);
                    processDetailQueue();
                });
            })(detailQueue.shift());
        }
    }
    function loadCartDetails(cart) {
        cart.forEach(function (item) {
            if (!item.slug || detailCache.has(item.slug)) return;
            detailCache.set(item.slug, { status: 'loading' });
            detailQueue.push(item.slug);
        });
        processDetailQueue();
    }
    function updateQuantityButtons($input, quantity) {
        var $controls = $input.closest('.quantity');
        $controls.find('.minus').prop('disabled', quantity <= 1);
        $controls.find('.plus').prop('disabled', quantity >= 99999);
    }
    function renderCart() {
        var $container = $('#dynamic-cart-container');
        if (!$container.length) return;
        var cart = getCart();
        $container.empty().closest('.enquiry-list-layout').toggleClass('is-empty', !cart.length);
        $container.siblings('.cart-buttons').prop('hidden', !cart.length);
        updateEnquirySummary();
        if (!cart.length) {
            $container.html('<section class="enquiry-empty-state" aria-labelledby="enquiry-empty-title">' +
                '<div class="enquiry-empty-icon" aria-hidden="true">' + listIcon('M5 3h14v18H5zM9 8h6M9 12h6M9 16h3') + '</div>' +
                '<h3 id="enquiry-empty-title">Your enquiry list is empty</h3>' +
                '<p>Explore our seed varieties and add the products you would like to enquire about.</p>' +
                '<a class="enquiry-primary" href="product.html">Explore seed products ' + listIcon('M5 12h14m-6-6 6 6-6 6') + '</a></section>');
            return;
        }
        loadCartDetails(cart);
        cart.forEach(function (item, index) {
            var esc = C.escape, details = itemDetails(item), line = details.line, url = esc(C.productUrl(line)), image = C.imageUrl(line.image);
            var inputId = 'enquiry-quantity-' + index;
            var $row = $('<article class="cart-inner enquiry-item">').attr('data-key', C.key(item));
            $row.html('<div class="cart-image"><a href="' + url + '"><img' + (image === 'images/orbi-seeds-logo.png' ? ' class="is-placeholder"' : '') + ' src="' + esc(image) + '" alt="' + esc(line.name) + '" width="144" height="144" loading="lazy"></a></div>' +
                '<div class="enquiry-item-info">' + productInfo(item) + '</div><button type="button" class="remove-item" aria-label="' + esc('Remove ' + line.name + ' from enquiry list') + '">' + listIcon('M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7') + '</button>' +
                '<div class="cart-bottom"><div class="enquiry-quantity-field"><label class="enquiry-quantity-label" for="' + inputId + '">' + esc(line.unit ? 'Quantity (' + line.unit + ')' : 'Quantity') + '</label>' +
                '<div class="quantity"><button type="button" class="qty-btn minus" aria-label="Decrease quantity">−</button>' +
                '<input id="' + inputId + '" type="number" class="qty-input" min="1" max="99999" step="1" value="' + item.quantity + '" aria-label="' + esc('Quantity for ' + line.name + ' ' + (line.variantLabel || '')) + '">' +
                '<button type="button" class="qty-btn plus" aria-label="Increase quantity">+</button></div></div>' +
                '<a class="enquiry-view-product" href="' + url + '">' + (details.review ? 'Review options' : 'View full details') + listIcon('M5 12h14m-6-6 6 6-6 6') + '</a></div>');
            $row.find('img').on('error', function () {
                this.classList.add('is-placeholder');
                if (this.getAttribute('src') !== 'images/orbi-seeds-logo.png') this.src = 'images/orbi-seeds-logo.png';
            });
            updateQuantityButtons($row.find('.qty-input'), item.quantity);
            $container.append($row);
        });
    }
    $(document).on('click', '.enquiry-details-retry', function () {
        var key = $(this).closest('.cart-inner').attr('data-key');
        var item = getCart().find(function (line) { return C.key(line) === key; });
        if (!item || !item.slug) return;
        detailCache.delete(item.slug);
        loadCartDetails(getCart());
        patchProductDetails(item.slug);
    });

    updateHeaderCounter();
    renderCart();

    $(document).on('click', '.qty-btn', function (e) {
        e.preventDefault();
        var $btn = $(this);
        var $parent = $btn.closest('.quantity');
        var $input = $parent.find('.qty-input');
        var id = $btn.closest('.cart-inner').attr('data-key');
        var cart = getCart();
        var item = cart.find(function (i) { return C.key(i) === id; });
        if (!item) return;

        var currentVal = C.quantity($input.val()) || item.quantity || 1;
        if ($btn.hasClass('plus')) currentVal = Math.min(99999, currentVal + 1);
        else if ($btn.hasClass('minus') && currentVal > 1) currentVal -= 1;

        item.quantity = currentVal;
        $input.val(currentVal);
        updateQuantityButtons($input, currentVal);
        saveCart(cart);
        updateHeaderCounter();
    });

    $(document).on('input', '.qty-input', function () {
        var $input = $(this);
        var id = $input.closest('.cart-inner').attr('data-key');
        var val = C.quantity($input.val());
        var cart = getCart();
        var item = cart.find(function (i) { return C.key(i) === id; });
        if (!item) return;

        if (val !== null) {
            item.quantity = val;
            updateQuantityButtons($input, val);
            saveCart(cart);
            updateHeaderCounter();
        }
    });

    $(document).on('change blur', '.qty-input', function () {
        var $input = $(this);
        var id = $input.closest('.cart-inner').attr('data-key');
        var val = C.quantity($input.val());
        var cart = getCart();
        var item = cart.find(function (i) { return C.key(i) === id; });
        if (!item) return;

        if (val === null) {
            val = item.quantity;
            $input.val(val);
        }
        item.quantity = val;
        updateQuantityButtons($input, val);
        saveCart(cart);
        updateHeaderCounter();
    });

    $(document).on('keydown', '.qty-input', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            $(this).blur();
        }
    });

    $(document).on('click', '.remove-item', function (e) {
        e.preventDefault();
        var id = $(this).closest('.cart-inner').attr('data-key');
        var cart = getCart().filter(function (i) { return C.key(i) !== id; });
        saveCart(cart);
        renderCart();
    });

    $(document).on('click', '#clear-cart-btn', function (e) {
        e.preventDefault();
        customConfirm('Are you sure?', 'This will clear all items from your enquiry list.', 'Yes, clear it!', function () {
            saveCart([]);
            renderCart();
            customAlert('Cleared!', 'Your enquiry list has been cleared.', 'success', 1500);
        });
    });

    function closePopup() {
        $('.enquiry-popup-wrapper').removeClass('active');
        $('body').css('overflow', '');
    }

    $(document).on('click', '.open-enquiry-popup, #cart-enquiry-btn', function (e) {
        e.preventDefault();
        if (!enquiryEnabled) return;
        var isCartBtn = $(this).attr('id') === 'cart-enquiry-btn';
        var line = null;
        if (!isCartBtn) {
            try { line = C.actionLine(this); }
            catch (error) { customAlert('Choose options', error.message, 'info', 2500); return; }
        }
        var productName = line ? line.name + (line.variantLabel ? ' — ' + line.variantLabel : '') : '';
        var productId = line && line.id || '';

        var $popup = $('.enquiry-popup-wrapper');
        var $form = $popup.find('form');
        if (!$form.length) return;
        $form[0].reset();
        $form.data('line', line).data('cart-mode', isCartBtn);
        $form.removeAttr('data-product-id');
        $form.find('.form-group').show();
        $form.find('input[name="txtProduct"], input[name="txtQuantity"]').prop('required', true);
        var $productInput = $form.find('input[name="txtProduct"]');
        $productInput.val('');
        $form.find('input[name="txtQuantity"]').attr({ min: 1, max: 99999, step: 1 }).val(1);
        $form.find('textarea[name="txtMessage"]').attr('maxlength', 2000);

        if (isCartBtn) {
            var cart = getCart();
            if (!cart.length) {
                customAlert('Empty List', 'Your enquiry list is empty. Add some products first!', 'info');
                return;
            }
            $form.find('input[name="txtProduct"], input[name="txtQuantity"]').closest('.form-group').hide();
            $form.find('input[name="txtProduct"], input[name="txtQuantity"]').prop('required', false);
            $form.find('textarea[name="txtMessage"]').attr('placeholder', 'Please share the final quote and delivery timeline.').val('');
            $form.find('#newsletter-checkbox-group').show();
        } else if (productName) {
            if (productId) $form.attr('data-product-id', productId);
            $productInput.val(productName);
            $form.find('textarea[name="txtMessage"]').attr('placeholder', 'Write Your Message').val('');
            $form.find('#newsletter-checkbox-group').show();
        } else {
            $form.find('textarea[name="txtMessage"]').attr('placeholder', 'Write Your Message').val('');
            $form.find('#newsletter-checkbox-group').show();
        }

        $popup.addClass('active');
        $('body').css('overflow', 'hidden');
    });

    $(document).on('keydown', function (event) { if (event.key === 'Escape') closePopup(); });

    $(document).on('click', '.close-enquiry-popup, .enquiry-overlay', function (e) {
        e.preventDefault();
        closePopup();
    });

    function sendEnquiry(payload) {
        return fetch(ENQUIRY_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(C.readResponse);
    }

    $(document).on('submit', '.enquiry-form', function (e) {
        e.preventDefault();
        var $form = $(this);
        var $submitBtn = $form.find('button[type="submit"]').first();
        if ($submitBtn.prop('disabled')) return false;

        var name = $form.find('input[name="txtName"]').val().trim();
        var phone = $form.find('input[name="txtPhone"]').val().trim();
        var email = $form.find('input[name="txtEmail"]').val().trim();
        var message = $form.find('textarea[name="txtMessage"]').val().trim();
        var isCartEnquiry = $form.data('cart-mode') === true;
        if (!message) message = 'Please share product details, the final quote and delivery timeline.';
        var quantity = $form.find('input[name="txtQuantity"]').val();
        var orbis = $form.find('input[name="orbis"]').val().trim();
        var selectedProductId = $form.attr('data-product-id') || '';
        var isNewsletterChecked = $form.find('input[name="chkNewsletter"]').is(':checked');

        var emailReg = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        var phoneReg = /^\d{10,12}$/;
        function showError(msg) { customAlert('Validation', msg, 'error', 2200); }

        if (!name) return showError('Please enter your name.'), false;
        if (name.length < 2 || name.length > 255) return showError('Name must be between 2 and 255 characters.'), false;
        if (message.length > 2000) return showError('Message must be 2000 characters or fewer.'), false;
        if (!phone) return showError('Please enter your phone number.'), false;
        if (!phoneReg.test(phone)) return showError('Invalid contact number. Please enter 10 to 12 digits.'), false;
        if (!email) return showError('Please enter your email address.'), false;
        if (!emailReg.test(email)) return showError('Invalid email address format.'), false;
        if (orbis) return showError('Bot detected. Please try again.'), false;

        if (!isCartEnquiry) {
            if (!selectedProductId) return showError('Please open enquiry from a product so productId can be sent.'), false;
            if (!C.quantity(quantity)) return showError('Please enter a valid quantity.'), false;
        }

        var payload = { name: name, email: email, phone: phone, message: message };
        if (isCartEnquiry) {
            var cart = getCart();
            if (!cart.length) return showError('Your enquiry list is empty. Add products first.'), false;
            if (cart.length > 100) return showError('Please submit up to 100 items per enquiry.'), false;
        } else {
            payload.productId = selectedProductId;
            payload.quantity = C.quantity(quantity);
            payload.variantId = ($form.data('line') || {}).variantId || null;
        }

        var originalBtnText = $submitBtn.text();
        $submitBtn.prop('disabled', true).attr('aria-busy', 'true').text('Submitting...');

        var submittedLines = isCartEnquiry ? getCart() : [Object.assign({}, $form.data('line'), { quantity: C.quantity(quantity) })];
        var enquiryItems = [];
        C.resolveLines(submittedLines).then(function (resolved) {
            enquiryItems = resolved.map(function (item) {
                var summary = { name: item.name, quantity: item.quantity };
                if (item.variantLabel) summary.variant = item.variantLabel;
                if (item.sku) summary.sku = item.sku;
                if (item.unit) summary.unit = item.unit;
                return summary;
            });
            if (isCartEnquiry) payload.cartItems = resolved.map(function (item) {
                return { product: { id: item.id }, variant: item.variantId ? { id: item.variantId } : null, quantity: item.quantity };
            });
            return sendEnquiry(payload);
        }).then(async function () {
            var params = new URLSearchParams({ name: name, phone: phone, email: email, message: message });
            params.set('items', JSON.stringify(enquiryItems));
            if (isCartEnquiry) {
                var remaining = getCart().map(function (item) {
                    var sent = submittedLines.find(function (line) { return C.key(line) === C.key(item); });
                    return Object.assign({}, item, { quantity: item.quantity - (sent ? sent.quantity : 0) });
                }).filter(function (item) { return item.quantity > 0; });
                try { saveCart(remaining); }
                catch (error) { params.set('listUpdate', 'failed'); }
            }
            // Finish the optional request before navigation so it is not cancelled on unload.
            if (isNewsletterChecked) {
                try {
                    await subscribeNewsletter({ email: email, source: 'orbi-enquiry' });
                    params.set('newsletter', 'subscribed');
                } catch (error) { params.set('newsletter', 'failed'); }
            }
            $form[0].reset();
            $form.removeAttr('data-product-id');
            closePopup();
            window.location.assign('thank-you.html?' + params.toString());
        }).catch(function (error) {
            customAlert('Submission Failed', (error && error.message) ? error.message : 'Failed to submit enquiry.', 'error');
        }).finally(function () {
            $submitBtn.prop('disabled', false).removeAttr('aria-busy').text(originalBtnText);
        });

        return false;
    });

    /* ========================================================
       STANDALONE NEWSLETTER FORM HANDLER
       ======================================================== */
    $(document).on('submit', '#newsletter-form, .newsletter-form, [data-newsletter-form]', function (e) {
        e.preventDefault();
        var $form = $(this);
        var $submitBtn = $form.find('button[type="submit"], input[type="submit"]');
        var email = ($form.find('input[type="email"], input[name="email"], input[name="txtEmail"]').val() || '').trim();
        var emailReg = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

        if (!email) {
            customAlert('Validation', 'Please enter your email address.', 'error', 2200);
            return;
        }
        if (!emailReg.test(email)) {
            customAlert('Validation', 'Please enter a valid email address.', 'error', 2200);
            return;
        }

        var originalText = $submitBtn.text();
        $submitBtn.prop('disabled', true).text('Subscribing...');

        subscribeNewsletter({ email: email, source: 'orbi-enquiry' }).then(function (res) {
            var msg = (res && (res.message || res.msg)) || 'Thank you for subscribing to our newsletter!';
            customAlert('Subscribed', msg, 'success', 2500);
            $form[0].reset();
        }).catch(function () {
            customAlert('Subscription Failed', 'Could not subscribe at this time. Please try again.', 'error');
        }).finally(function () {
            $submitBtn.prop('disabled', false).text(originalText);
        });
    });
});
