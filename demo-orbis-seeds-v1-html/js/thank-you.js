(function () {
    'use strict';
    var params = new URLSearchParams(window.location.search);
    var name = (params.get('name') || '').trim();
    var phone = (params.get('phone') || '').trim();
    var email = (params.get('email') || '').trim();
    if (!name || !phone || !email) return;

    // Query parameters are untrusted. Render all submitted values as plain text.
    document.getElementById('thank-you-title').textContent = 'Thank you, ' + name + '!';
    document.getElementById('thank-you-message').textContent = 'Your enquiry has been submitted successfully. Thank you for your interest in Orbi Seeds. Our team will contact you shortly using the details below.';
    document.getElementById('detail-name').textContent = name;
    document.getElementById('detail-phone').textContent = phone;
    document.getElementById('detail-email').textContent = email;
    document.getElementById('detail-message').textContent = params.get('message') || 'No message provided.';
    document.getElementById('thank-you-icon').hidden = false;
    document.getElementById('thank-you-details').hidden = false;

    // Older links may not include products; malformed item data must not break the page.
    var items = [];
    try {
        var parsed = JSON.parse(params.get('items') || '[]');
        if (Array.isArray(parsed)) items = parsed.slice(0, 100);
    } catch (error) { /* Keep the contact details visible when product data is invalid. */ }
    var productList = document.getElementById('enquiry-product-list');
    items.forEach(function (item) {
        if (!item || typeof item.name !== 'string' || !item.name.trim() ||
            !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99999) return;
        var row = document.createElement('li');
        var details = document.createElement('div');
        var title = document.createElement('h3');
        title.textContent = item.name;
        details.appendChild(title);
        ['variant', 'sku'].forEach(function (field) {
            if (typeof item[field] !== 'string' || !item[field].trim()) return;
            var detail = document.createElement('p');
            detail.textContent = (field === 'sku' ? 'SKU: ' : '') + item[field];
            details.appendChild(detail);
        });
        var quantity = document.createElement('p');
        quantity.className = 'thank-you-product-quantity';
        quantity.textContent = 'Quantity: ' + item.quantity + (typeof item.unit === 'string' && item.unit.trim() ? ' ' + item.unit : '');
        row.appendChild(details);
        row.appendChild(quantity);
        productList.appendChild(row);
    });
    document.getElementById('thank-you-products').hidden = !productList.children.length;

    var newsletter = params.get('newsletter');
    if (newsletter === 'subscribed' || newsletter === 'failed') {
        var notice = document.getElementById('newsletter-status');
        notice.textContent = newsletter === 'subscribed'
            ? 'You are subscribed to updates about future products.'
            : 'Your enquiry was received, but we could not subscribe you to future product updates. You can try subscribing again later.';
        notice.hidden = false;
    }
    if (params.get('listUpdate') === 'failed') {
        var listNotice = document.getElementById('list-update-status');
        listNotice.textContent = 'Your enquiry was received, but your saved enquiry list could not be updated. Please remove the submitted items from your list manually.';
        listNotice.hidden = false;
    }
})();
