$(document).ready(function() {
    var ENQUIRY_API_URL = API_URL + "enquiries";

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
        }).then(function(res) {
            return res.json().catch(function() { return {}; });
        }).then(function(result) {
            console.log("Newsletter subscription response:", result);
            return result;
        }).catch(function(err) {
            console.error("Newsletter API error:", err);
            return { error: err };
        });
    }

    window.subscribeNewsletter = subscribeNewsletter;

    function customAlert(title, text, type, timer) {
        var icon = type === 'success' ? 'OK' : (type === 'error' ? '!' : 'i');
        var color = type === 'success' ? '#58AE68' : (type === 'error' ? '#dc3545' : '#71C5DD');
        var toastKey = [type || '', title || '', text || ''].join('|');
        var safeToastKey = toastKey.replace(/"/g, '&quot;');
        var html = `
        <div class="custom-toast" data-toast-key="${safeToastKey}" style="border-left: 4px solid ${color};">
            <div class="custom-toast-icon" style="background:${color};">${icon}</div>
            <div class="custom-toast-content"><strong>${title}</strong> ${text}</div>
            ${!timer ? `<button class="custom-toast-btn" style="color:${color};">OK</button>` : ''}
        </div>`;

        var $container = $('.custom-toast-container');
        if ($container.length === 0) {
            $('body').append('<div class="custom-toast-container"></div>');
            $container = $('.custom-toast-container');
        }

        if (type === 'error') {
            $container.find('.custom-toast').remove();
        } else if ($container.find('.custom-toast[data-toast-key="' + safeToastKey + '"]').length > 0) {
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
                <h3>${title}</h3>
                <p>${text}</p>
                <div class="custom-confirm-actions">
                    <button class="custom-confirm-cancel">Cancel</button>
                    <button class="custom-confirm-ok">${confirmText}</button>
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

    function getCart() { return JSON.parse(localStorage.getItem('enquiryCart')) || []; }
    function saveCart(cart) { localStorage.setItem('enquiryCart', JSON.stringify(cart)); updateHeaderCounter(); }
    function toAbsoluteImage(url) {
        if (!url) return 'images/default-image.png';
        if (/^https?:\/\//i.test(url)) return url;
        if (url.charAt(0) === '/') return APP_URL + url;
        return url;
    }
    function getProductUnit(product) {
        if (!product || !product.attributes || !product.attributes.length) return '';
        var matchedAttribute = product.attributes.find(function(attr) {
            var name = (attr.customName || (attr.attribute ? attr.attribute.name : '') || '').trim().toLowerCase();
            return name === 'unit' || name === 'uom';
        });
        if (!matchedAttribute) return '';
        return matchedAttribute.customValue || (matchedAttribute.value ? matchedAttribute.value.value : '') || '';
    }
    function getCategorySlug(product) {
        if (!product) return '';
        if (product.category && product.category.slug) return product.category.slug;
        if (product.categories && product.categories[0] && product.categories[0].slug) return product.categories[0].slug;
        return '';
    }
    function getProductPageUrl(item) {
        if (!item || !item.categorySlug || !item.slug) return 'javascript:;';
        return 'products.html?category=' + encodeURIComponent(item.categorySlug) + '&slug=' + encodeURIComponent(item.slug);
    }
    function fetchProductMetaBySlug(productSlug) {
        if (!productSlug) return Promise.resolve(null);
        return fetch(API_URL + 'products/' + encodeURIComponent(productSlug) + '?include=categories,attributes')
            .then(function(response) { return response.json(); })
            .then(function(result) {
                var product = result && result.data ? result.data : null;
                if (!product) return null;
                return {
                    slug: product.slug || '',
                    categorySlug: getCategorySlug(product),
                    unit: getProductUnit(product)
                };
            })
            .catch(function() { return null; });
    }

    function updateHeaderCounter() {
        var cart = getCart();
        $('#header-enquiry-count').text(cart.length || 0);
    }

    $(document).on('click', '.add-enquiry-list', function(e) {
        e.preventDefault();
        var id = $(this).attr('data-id');
        var name = $(this).attr('data-name');
        var image = $(this).attr('data-image');
        var slug = $(this).attr('data-slug') || '';
        var categorySlug = $(this).attr('data-category') || '';
        var unit = $(this).attr('data-unit') || '';
        if (!id || !name) return;

        var cart = getCart();
        var existingItem = cart.find(function(item) { return item.id === id; });
        if (existingItem) existingItem.quantity += 1;
        else cart.push({ id: id, name: name, image: toAbsoluteImage(image), quantity: 1, slug: slug, categorySlug: categorySlug, unit: unit });

        saveCart(cart);
        customAlert('Added!', name + ' has been added to your enquiry list.', 'success', 2000);
    });

    function renderCart() {
        var $container = $('#dynamic-cart-container');
        if ($container.length === 0) return;
        $('.cart-wrapper h1').show();
        var cart = getCart();
        $container.empty();

        if (!cart.length) {
            $container.html('<p style="text-align:center; padding: 20px;">Your enquiry list is currently empty.</p>');
            $container.siblings('.cart-buttons').hide();
            return;
        }

        $container.siblings('.cart-buttons').show();
        var needsMeta = cart.some(function(item) { return !item.slug || !item.categorySlug || !item.unit; });
        var renderItems = function(items) {
            $container.empty();
            items.forEach(function(item) {
            var productUrl = getProductPageUrl(item);
            var image = toAbsoluteImage(item.image);
            var unitHtml = item.unit ? '<p class="cart-unit">Unit: ' + item.unit + '</p>' : '';
            $container.append(`
            <div class="cart-inner" data-id="${item.id}">
                <button class="close-btn remove-item">&times;</button>
                <div class="cart-image"><a href="${productUrl}"><img src="${image}" alt="${item.name}" onerror="this.onerror=null;this.src='images/default-image.png';"></a></div>
                <div class="cart-content">
                    <h2><a href="${productUrl}">${item.name}</a></h2>
                    ${unitHtml}
                    <div class="cart-bottom">
                        <div class="quantity">
                            <button type="button" class="qty-btn minus" title="Decrease quantity">-</button>
                            <input type="number" class="qty-input" min="1" max="99999" value="${item.quantity}" title="Click to edit quantity">
                            <button type="button" class="qty-btn plus" title="Increase quantity">+</button>
                        </div>
                    </div>
                </div>
            </div>`);
            });
        };
        if (!needsMeta) {
            renderItems(cart);
            return;
        }
        Promise.all(cart.map(function(item) {
            if (item.slug && item.categorySlug && item.unit) return Promise.resolve(item);
            if (!item.slug) return Promise.resolve(item);
            return fetchProductMetaBySlug(item.slug).then(function(meta) {
                return meta ? Object.assign({}, item, meta) : item;
            });
        })).then(function(items) {
            saveCart(items);
            renderItems(items);
        }).catch(function() {
            renderItems(cart);
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
                <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 25px; text-align: center;">${msg}<br>Our team will contact you shortly.</p>
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
        var id = $btn.closest('.cart-inner').attr('data-id');
        var cart = getCart();
        var item = cart.find(function(i) { return i.id === id; });
        if (!item) return;

        var currentVal = parseInt($input.val(), 10) || item.quantity || 1;
        if ($btn.hasClass('plus')) currentVal += 1;
        else if ($btn.hasClass('minus') && currentVal > 1) currentVal -= 1;

        item.quantity = currentVal;
        $input.val(currentVal);
        saveCart(cart);
        updateHeaderCounter();
    });

    $(document).on('input', '.qty-input', function() {
        var $input = $(this);
        var id = $input.closest('.cart-inner').attr('data-id');
        var val = parseInt($input.val(), 10);
        var cart = getCart();
        var item = cart.find(function(i) { return i.id === id; });
        if (!item) return;

        if (!isNaN(val) && val >= 1) {
            item.quantity = val;
            saveCart(cart);
            updateHeaderCounter();
        }
    });

    $(document).on('change blur', '.qty-input', function() {
        var $input = $(this);
        var id = $input.closest('.cart-inner').attr('data-id');
        var val = parseInt($input.val(), 10);
        var cart = getCart();
        var item = cart.find(function(i) { return i.id === id; });
        if (!item) return;

        if (isNaN(val) || val < 1) {
            val = 1;
            $input.val(1);
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
        var id = $(this).closest('.cart-inner').attr('data-id');
        var cart = getCart().filter(function(i) { return i.id !== id; });
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
        var isCartBtn = $(this).attr('id') === 'cart-enquiry-btn';
        var productName = $(this).attr('data-name');
        var productId = $(this).attr('data-id') || '';

        var $popup = $('.enquiry-popup-wrapper');
        var $form = $popup.find('form');
        $form[0].reset();
        $form.removeAttr('data-product-id');
        $form.find('.form-group').show();
        $form.find('input[name="txtProduct"], input[name="txtQuantity"]').prop('required', true);
        var $productInput = $form.find('input[name="txtProduct"]');
        $productInput.val('');

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

    $(document).on('click', '.close-enquiry-popup, .enquiry-overlay', function(e) {
        e.preventDefault();
        closePopup();
    });

    function sendEnquiry(payload) {
        return fetch(ENQUIRY_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function(response) {
            return response.text().then(function(text) {
                var data;
                try { data = text ? JSON.parse(text) : {}; } catch (err) { data = {}; }
                if (!response.ok) {
                    var errorMessage = (data && data.error && data.error.message) ? data.error.message : 'Request failed';
                    throw new Error(errorMessage);
                }
                return data;
            });
        });
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
        var isCartEnquiry = !$form.find('input[name="txtProduct"]').prop('required');
        if (!message && isCartEnquiry) {
            message = 'Please share the final quote and delivery timeline.';
        }
        var quantity = $form.find('input[name="txtQuantity"]').val();
        var orbis = $form.find('input[name="orbis"]').val().trim();
        var selectedProductId = $form.attr('data-product-id') || '';
        var isNewsletterChecked = $form.find('input[name="chkNewsletter"]').is(':checked');

        var nameReg = /^[a-zA-Z\s]+$/;
        var emailReg = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        var phoneReg = /^\d{10,15}$/;
        function showError(msg) { customAlert('Validation', msg, 'error', 2200); }

        if (!name) return showError('Please enter your name.'), false;
        if (!nameReg.test(name)) return showError('Invalid name. Please enter alphabets only.'), false;
        if (!phone) return showError('Please enter your phone number.'), false;
        if (!phoneReg.test(phone)) return showError('Invalid contact number. Please enter 10 to 15 digits.'), false;
        if (!email) return showError('Please enter your email address.'), false;
        if (!emailReg.test(email)) return showError('Invalid email address format.'), false;
        if (orbis) return showError('Bot detected. Please try again.'), false;

        if (!isCartEnquiry) {
            if (!selectedProductId) return showError('Please open enquiry from a product so productId can be sent.'), false;
            if (!quantity || parseInt(quantity, 10) < 1) return showError('Please enter a valid quantity.'), false;
        }

        var payload = { name: name, email: email, phone: phone, message: message };
        if (isCartEnquiry) {
            var cart = getCart();
            if (!cart.length) return showError('Your enquiry list is empty. Add products first.'), false;
            payload.cartItems = cart.map(function(item) { return { product: { id: item.id }, variant: null, quantity: parseInt(item.quantity, 10) || 1 }; });
        } else {
            payload.productId = selectedProductId;
            payload.quantity = parseInt(quantity, 10);
        }

        var originalBtnText = $submitBtn.text();
        $submitBtn.prop('disabled', true).attr('aria-busy', 'true').text('Submitting...');

        sendEnquiry(payload).then(function(apiResponse) {
            // If user checked "Check here for future products", subscribe them to newsletter
            if (isNewsletterChecked) {
                subscribeNewsletter({ email: email, source: "orbi-enquiry" });
            }

            var successMessage = (apiResponse && apiResponse.message) ? apiResponse.message : 'Your enquiry has been submitted successfully.';
            if (isCartEnquiry) {
                saveCart([]);
                renderThankYouState(successMessage);
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
