(function () {
    'use strict';

    var form = document.getElementById('contact-form');
    if (!form) return;
    var button = form.querySelector('button[type="submit"]');
    var status = document.getElementById('contact-form-status');
    var pending = false;

    function showStatus(message, error) {
        status.className = 'contact-form-status ' + (error ? 'is-error' : 'is-success');
        status.setAttribute('role', error ? 'alert' : 'status');
        status.textContent = message;
    }

    form.addEventListener('input', function (event) {
        if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    });

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (pending || !form.reportValidity()) return;

        var values = {};
        ['name', 'email', 'phone', 'message'].forEach(function (name) {
            values[name] = form.elements.namedItem(name).value.trim();
        });
        var controller = new AbortController();
        var timeout = setTimeout(function () { controller.abort(); }, 20000);
        var originalLabel = button.textContent;
        pending = true;
        button.disabled = true;
        button.textContent = 'Sending…';
        form.setAttribute('aria-busy', 'true');
        status.textContent = '';

        try {
            var response = await fetch(API_URL.replace(/\/?$/, '/') + 'contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
                signal: controller.signal,
            });
            var result = await response.json().catch(function () { return null; });
            if (!response.ok || !result || result.success !== true) {
                var details = result && result.error && result.error.details;
                if (response.status === 400 && Array.isArray(details) && details.length) {
                    var field = form.elements.namedItem(details[0].field);
                    if (field && typeof field.setCustomValidity === 'function') {
                        field.setCustomValidity(details[0].message);
                        field.reportValidity();
                    }
                }
                throw new Error((result && result.error && result.error.message) || 'We could not send your message. Please try again.');
            }
            form.reset();
            showStatus(result.message || 'Thank you. Your message has been received. Our team will get back to you.', false);
        } catch (error) {
            showStatus(error.name === 'AbortError'
                ? 'The request timed out. Please try again or contact us by email or phone.'
                : error instanceof TypeError ? 'Unable to connect. Please check your connection and try again.' : error.message, true);
        } finally {
            clearTimeout(timeout);
            pending = false;
            button.disabled = false;
            button.textContent = originalLabel;
            form.setAttribute('aria-busy', 'false');
        }
    });
}());
