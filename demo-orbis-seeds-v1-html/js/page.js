(function () {
    'use strict';

    const header = document.querySelector('.cms-page-banner > header');
    const backToTop = document.getElementById('to-top');
    function updateScroll() {
        header.classList.toggle('scrolled-header', window.scrollY >= 100);
        backToTop.hidden = window.scrollY < 100;
    }

    window.addEventListener('scroll', updateScroll, { passive: true });
    backToTop.addEventListener('click', (event) => {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    updateScroll();

    const banner = document.querySelector('.cms-page-banner');
    function hideBrokenBanner(image) {
        image.addEventListener('error', () => { image.hidden = true; });
        if (image.complete && !image.naturalWidth) image.hidden = true;
    }

    const body = document.getElementById('cms-page-content');
    if (body.querySelector('[data-orbi-cms-rendered]')) {
        const image = banner.querySelector('.cms-banner-image');
        if (image) hideBrokenBanner(image);
        return;
    }

    const title = document.getElementById('cms-page-title');
    const breadcrumb = document.getElementById('cms-page-breadcrumb');
    const status = document.getElementById('cms-page-status');
    const slug = new URLSearchParams(window.location.search).get('slug');

    function mediaUrl(source) {
        if (!source) return '';
        try {
            const url = new URL(source, APP_URL);
            return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    }

    function renderContent(html) {
        const content = DOMPurify.sanitize(html || '', {
            ALLOWED_TAGS: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'b', 'i', 'u', 'em', 'strong', 's', 'strike', 'sub', 'sup',
                'p', 'br', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'table', 'thead', 'tbody',
                'tfoot', 'tr', 'th', 'td', 'caption', 'div', 'span', 'section', 'article', 'aside',
                'header', 'footer', 'nav', 'main', 'figure', 'figcaption', 'img', 'a', 'hr',
            ],
            ALLOWED_ATTR: ['class', 'id', 'style', 'href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan'],
            ALLOW_DATA_ATTR: false,
            RETURN_DOM_FRAGMENT: true,
        });
        const allowedStyles = new Set([
            'color', 'background-color', 'text-align', 'font-size', 'font-weight', 'font-style',
            'text-decoration', 'margin', 'padding', 'width', 'height', 'display',
        ]);
        content.querySelectorAll('[style]').forEach((node) => {
            for (const property of Array.from(node.style)) {
                if (!allowedStyles.has(property)) node.style.removeProperty(property);
            }
        });
        content.querySelectorAll('h1').forEach((node) => {
            const heading = document.createElement('h2');
            for (const attr of node.attributes) heading.setAttribute(attr.name, attr.value);
            heading.append(...node.childNodes);
            node.replaceWith(heading);
        });
        content.querySelectorAll('img').forEach((image) => {
            const url = mediaUrl(image.getAttribute('src'));
            if (url) image.src = url;
            else image.removeAttribute('src');
            if (!image.hasAttribute('alt')) image.alt = '';
        });
        content.querySelectorAll('a[target="_blank"]').forEach((link) => {
            link.relList.add('noopener', 'noreferrer');
        });
        body.replaceChildren(content);
    }

    function renderPage(page) {
        renderContent(page.content);
        title.textContent = breadcrumb.textContent = page.title;
        const source = mediaUrl(page.bannerUrl);
        if (source) {
            const image = document.createElement('img');
            image.className = 'cms-banner-image';
            image.alt = '';
            image.src = source;
            hideBrokenBanner(image);
            banner.prepend(image);
        }
        window.OrbiSEO?.refresh(page);
    }

    function showUnavailable() {
        title.textContent = breadcrumb.textContent = 'Page unavailable';
        status.textContent = 'This page could not be found.';
        window.OrbiSEO?.unavailable();
    }

    if (!slug) {
        showUnavailable();
        return;
    }

    fetch(API_URL + 'pages/public/' + encodeURIComponent(slug))
        .then(OrbiCatalog.readResponse)
        .then((result) => renderPage(result.data))
        .catch((error) => {
            if (error.status === 404 || error.status === 403) showUnavailable();
            else status.textContent = 'Unable to load this page. Please refresh and try again.';
        });
})();
