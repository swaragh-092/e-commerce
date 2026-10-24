$(document).ready(function() {
    var C = window.OrbiCatalog;
    var ENQUIRY_API_URL = API_URL + "enquiries";
    var enquiryEnabled = true;
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
            return { then: function(callback) { if (typeof callback === 'function') callback(); } };
        }

        var $toast = $(html);
        $container.append($toast);
        setTimeout(function() { $toast.addClass('show'); }, 10);

        function close() {
            $toast.removeClass('show');
            setTimeout(function() { $toast.remove(); }, 300);
        }

        if (timer) setTimeout(close, timer);
        else $toast.find('.custom-toast-btn').on('click', close);

        return {
            then: function(callback) {
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
        setTimeout(function() { $overlay.addClass('show'); }, 10);

        function close() {
            $overlay.removeClass('show');
            setTimeout(function() { $overlay.remove(); }, 300);
        }

        $overlay.find('.custom-confirm-cancel').on('click', close);
        $overlay.find('.custom-confirm-ok').on('click', function() { close(); if (callback) callback(); });
    }

    function getCart() { return C.getCart(); }
    function saveCart(cart) { C.saveCart(cart); }
    function updateHeaderCounter() { $('#header-enquiry-count').text(getCart().length); }
    window.addEventListener('orbi:cart-change', updateHeaderCounter);
    window.addEventListener('storage', function (event) {
        if (event.key === 'enquiryCart') { updateHeaderCounter(); renderCart(); }
    });

    $(document).on('click', '.add-enquiry-list', function(e) {
        e.preventDefault();
        if (!enquiryEnabled) return;
        try {
            var line = C.actionLine(this);
            if (!line.id) return;
            C.addToCart(line);
            customAlert('Added!', line.name + (line.variantLabel ? ' (' + line.variantLabel + ')' : '') + ' has been added to your enquiry list.', 'success', 2000);
        } catch (error) { customAlert('Enquiry list', error.message, 'error', 2500); }
    });

    function renderCart() {
        var $container = $('#dynamic-cart-container');
        if (!$container.length) return;
        $('.cart-wrapper h1').show();
        var cart = getCart();
        $container.empty();
        $container.siblings('.cart-buttons').toggle(!!cart.length);
        if (!cart.length) {
            $container.html('<p style="text-align:center; padding: 20px;">Your enquiry list is currently empty.</p>');
            return;
        }
        cart.forEach(function(item) {
            var esc = C.escape, url = esc(C.productUrl(item));
            var $row = $('<div class="cart-inner">').attr('data-key', C.key(item));
            $row.html('<button type="button" class="close-btn remove-item" aria-label="Remove from enquiry list">&times;</button>' +
                '<div class="cart-image"><a href="' + url + '"><img src="' + esc(C.imageUrl(item.image)) + '" alt="' + esc(item.name) + '"></a></div>' +
                '<div class="cart-content"><h2><a href="' + url + '">' + esc(item.name) + '</a></h2>' +
                (item.variantLabel ? '<p class="cart-variant">' + esc(item.variantLabel) + '</p>' : '') +
                (item.sku ? '<p class="cart-variant">SKU: ' + esc(item.sku) + '</p>' : '') +
                (item.unit ? '<p class="cart-unit">Unit: ' + esc(item.unit) + '</p>' : '') +
                '<div class="cart-bottom"><div class="quantity"><button type="button" class="qty-btn minus" aria-label="Decrease quantity">-</button>' +
                '<input type="number" class="qty-input" min="1" max="99999" step="1" value="' + item.quantity + '" aria-label="Quantity for ' + esc(item.name + ' ' + (item.variantLabel || '')) + '">' +
                '<button type="button" class="qty-btn plus" aria-label="Increase quantity">+</button></div></div></div>');
            $row.find('img').on('error', function () { if (this.getAttribute('src') !== 'images/default-image.png') this.src = 'images/default-image.png'; });
            $container.append($row);
        });
    }

    function renderThankYouState(message) {
        var $container = $('#dynamic-cart-container');
        if ($container.length === 0) return;
        $container.closest('.cart-wrapper').find('h1').hide();
        $container.siblings('.cart-buttons').hide();
        var msg = message || 'Your enquiry has been submitted successfully.';
        var html = `
            <div class="cart-thankyou-message" style="text-align:center; padding: 45px 20px; background: #fff; border-radius: 12px; border: 1px solid #e2ebe4; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin: 10px auto 30px; max-width: 600px;">
                <div style="width: 60px; height: 60px; line-height: 60px; border-radius: 50%; background: #e8f5e9; color: #58AE68; font-size: 32px; font-weight: bold; margin: 0 auto 15px;">&#10003;</div>
                <h2 style="font-size: 24px; color: #1f2933; margin-bottom: 10px; font-weight: 700;">Thank You!</h2>
                <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 25px; text-align: center;">${C.escape(msg)}<br>Our team will contact you shortly.</p>
                <a href="product.html" class="view-product-btn" style="display: inline-block; padding: 12px 28px; text-decoration: none;">Explore More Products</a>
            </div>
        `;
        $container.html(html);
    }

    updateHeaderCounter();
    renderCart();

    $(document).on('click', '.qty-btn', function(e) {
        e.preventDefault();
        var $btn = $(this);
        var $parent = $btn.closest('.quantity');
        var $input = $parent.find('.qty-input');
        var id = $btn.closest('.cart-inner').attr('data-key');
        var cart = getCart();
        var item = cart.find(function(i) { return C.key(i) === id; });
        if (!item) return;

        var currentVal = C.quantity($input.val()) || item.quantity || 1;
        if ($btn.hasClass('plus')) currentVal = Math.min(99999, currentVal + 1);
        else if ($btn.hasClass('minus') && currentVal > 1) currentVal -= 1;

        item.quantity = currentVal;
        $input.val(currentVal);
        saveCart(cart);
        updateHeaderCounter();
    });

    $(document).on('input', '.qty-input', function() {
        var $input = $(this);
        var id = $input.closest('.cart-inner').attr('data-key');
        var val = C.quantity($input.val());
        var cart = getCart();
        var item = cart.find(function(i) { return C.key(i) === id; });
        if (!item) return;

        if (val !== null) {
            item.quantity = val;
            saveCart(cart);
            updateHeaderCounter();
        }
    });

    $(document).on('change blur', '.qty-input', function() {
        var $input = $(this);
        var id = $input.closest('.cart-inner').attr('data-key');
        var val = C.quantity($input.val());
        var cart = getCart();
        var item = cart.find(function(i) { return C.key(i) === id; });
        if (!item) return;

        if (val === null) {
            val = item.quantity;
            $input.val(val);
        }
        item.quantity = val;
        saveCart(cart);
        updateHeaderCounter();
    });

    $(document).on('keydown', '.qty-input', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            $(this).blur();
        }
    });

    $(document).on('click', '.remove-item', function(e) {
        e.preventDefault();
        var id = $(this).closest('.cart-inner').attr('data-key');
        var cart = getCart().filter(function(i) { return C.key(i) !== id; });
        saveCart(cart);
        renderCart();
    });

    $(document).on('click', '#clear-cart-btn', function(e) {
        e.preventDefault();
        customConfirm('Are you sure?', 'This will clear all items from your enquiry list.', 'Yes, clear it!', function() {
            saveCart([]);
            renderCart();
            customAlert('Cleared!', 'Your enquiry list has been cleared.', 'success', 1500);
        });
    });

    function closePopup() {
        $('.enquiry-popup-wrapper').removeClass('active');
        $('body').css('overflow', '');
    }

    $(document).on('click', '.open-enquiry-popup, #cart-enquiry-btn', function(e) {
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

    $(document).on('click', '.close-enquiry-popup, .enquiry-overlay', function(e) {
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

    $(document).on('submit', '.enquiry-form', function(e) {
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
        C.resolveLines(submittedLines).then(function (resolved) {
            if (isCartEnquiry) payload.cartItems = resolved.map(function (item) {
                return { product: { id: item.id }, variant: item.variantId ? { id: item.variantId } : null, quantity: item.quantity };
            });
            return sendEnquiry(payload);
        }).then(function(apiResponse) {
            // If user checked "Check here for future products", subscribe them to newsletter
            if (isNewsletterChecked) {
                subscribeNewsletter({ email: email, source: "orbi-enquiry" }).catch(function () { customAlert("Newsletter", "Enquiry submitted. Newsletter subscription could not be completed.", "info", 3000); });
            }

            var successMessage = (apiResponse && apiResponse.message) ? apiResponse.message : 'Your enquiry has been submitted successfully.';
            if (isCartEnquiry) {
                var remaining = getCart().map(function (item) {
                    var sent = submittedLines.find(function (line) { return C.key(line) === C.key(item); });
                    return Object.assign({}, item, { quantity: item.quantity - (sent ? sent.quantity : 0) });
                }).filter(function (item) { return item.quantity > 0; });
                try { saveCart(remaining); }
                catch (error) { customAlert('Enquiry submitted', 'Could not update your saved list. Please clear the submitted items manually.', 'info', 4000); }
                if (remaining.length) renderCart(); else renderThankYouState(successMessage);
            }
            $form[0].reset();
            $form.removeAttr('data-product-id');
            closePopup();
            customAlert('Thank you!', successMessage, 'success', 2200);
        }).catch(function(error) {
            customAlert('Submission Failed', (error && error.message) ? error.message : 'Failed to submit enquiry.', 'error');
        }).finally(function() {
            $submitBtn.prop('disabled', false).removeAttr('aria-busy').text(originalBtnText);
        });

        return false;
    });

    /* ========================================================
       STANDALONE NEWSLETTER FORM HANDLER
       ======================================================== */
    $(document).on('submit', '#newsletter-form, .newsletter-form, [data-newsletter-form]', function(e) {
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

        subscribeNewsletter({ email: email, source: 'orbi-enquiry' }).then(function(res) {
            var msg = (res && (res.message || res.msg)) || 'Thank you for subscribing to our newsletter!';
            customAlert('Subscribed', msg, 'success', 2500);
            $form[0].reset();
        }).catch(function() {
            customAlert('Subscription Failed', 'Could not subscribe at this time. Please try again.', 'error');
        }).finally(function() {
            $submitBtn.prop('disabled', false).text(originalText);
        });
    });
});
