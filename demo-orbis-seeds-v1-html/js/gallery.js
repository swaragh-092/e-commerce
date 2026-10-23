(function () {
    var limit = 20;
    // Use the site's configured backend, including when previewed on a static localhost server.
    var galleryApiUrl = API_URL.replace(/\/+$/, '') + '/';
    var mediaBaseUrl = APP_URL;
    var sectionsEl = document.getElementById('gallery-sections');
    var messageEl = document.getElementById('gallery-message');
    var retryEl = document.getElementById('gallery-retry');

    if (!sectionsEl || !messageEl || !retryEl) return;
    retryEl.addEventListener('click', fetchAlbums);

    function safeText(value, fallback) {
        return (typeof value === 'string' && value.trim()) ? value.trim() : fallback;
    }

    function normalizeImageUrl(url) {
        var imageUrl = safeText(url, '');
        if (!imageUrl) return '';
        try {
            var resolved = new URL(imageUrl, mediaBaseUrl);
            return /^https?:$/.test(resolved.protocol) ? resolved.href : '';
        } catch (error) {
            return '';
        }
    }

    function readItems(result) {
        if (!result || typeof result !== 'object') return [];
        if (Array.isArray(result.data)) return result.data;
        if (result.data && Array.isArray(result.data.items)) return result.data.items;
        if (result.data && Array.isArray(result.data.rows)) return result.data.rows;
        if (Array.isArray(result.items)) return result.items;
        if (Array.isArray(result.rows)) return result.rows;
        return [];
    }

    function readImage(galleryItem) {
        if (!galleryItem || typeof galleryItem !== 'object') return '';

        var candidates = [
            galleryItem.image,
            galleryItem.imageUrl,
            galleryItem.image_url,
            galleryItem.url,
            galleryItem.path,
            galleryItem.file,
            galleryItem.thumbnail,
            galleryItem.thumbnailUrl
        ];

        if (galleryItem.media && typeof galleryItem.media === 'object') {
            candidates.push(galleryItem.media.url, galleryItem.media.path, galleryItem.media.image);
        }

        if (Array.isArray(galleryItem.images) && galleryItem.images.length > 0) {
            var firstImage = galleryItem.images[0];
            if (typeof firstImage === 'string') {
                candidates.push(firstImage);
            } else if (firstImage && typeof firstImage === 'object') {
                candidates.push(firstImage.url, firstImage.path, firstImage.image);
            }
        }

        for (var i = 0; i < candidates.length; i++) {
            var normalized = normalizeImageUrl(candidates[i]);
            if (normalized) return normalized;
        }

        return '';
    }

    function setMessage(message, text, retry, canRetry) {
        message.textContent = text;
        message.hidden = !text;
        retry.hidden = !canRetry;
    }

    function createSection(album, index) {
        var element = document.createElement('section');
        element.className = 'gallery-album-section';
        element.id = 'gallery-album-' + index;
        var heading = document.createElement('h3');
        heading.id = element.id + '-title';
        heading.textContent = safeText(album.title, 'Gallery');
        element.setAttribute('aria-labelledby', heading.id);
        element.appendChild(heading);
        if (album.description) {
            var description = document.createElement('p');
            description.className = 'gallery-album-description';
            description.textContent = album.description;
            element.appendChild(description);
        }
        var message = document.createElement('p');
        message.className = 'gallery-album-message';
        message.setAttribute('role', 'status');
        var retry = document.createElement('button');
        retry.className = 'gallery-retry';
        retry.type = 'button';
        retry.textContent = 'Try again';
        retry.setAttribute('aria-label', 'Retry ' + heading.textContent + ' gallery');
        retry.hidden = true;
        var grid = document.createElement('div');
        grid.className = 'gallery-inner-wrapper';
        var pagination = document.createElement('nav');
        pagination.className = 'gallery-pagination';
        pagination.setAttribute('aria-label', heading.textContent + ' gallery pages');
        element.appendChild(message);
        element.appendChild(retry);
        element.appendChild(grid);
        element.appendChild(pagination);
        sectionsEl.appendChild(element);
        var section = { album: album, element: element, grid: grid, message: message,
            retry: retry, pagination: pagination, page: 1, totalPages: 1, requestId: 0 };
        retry.addEventListener('click', function () { fetchGallery(section, section.page, true); });
        return section;
    }

    function renderItems(section, items) {
        section.grid.innerHTML = '';
        items.forEach(function (item) {
            var imageUrl = readImage(item);
            if (!imageUrl) return;
            var title = safeText(item.title || item.name || item.caption || item.alt || (item.media && (item.media.alt || item.media.caption)), 'Gallery Image');
            var anchor = document.createElement('a');
            anchor.href = imageUrl;
            anchor.setAttribute('data-fancybox', section.element.id);
            anchor.setAttribute('aria-label', 'View image: ' + title);
            var img = document.createElement('img');
            img.src = imageUrl;
            img.alt = title;
            img.loading = 'lazy';
            anchor.appendChild(img);
            section.grid.appendChild(anchor);
        });
        setMessage(section.message, section.grid.childElementCount ? '' : 'No gallery items found.', section.retry, false);
        if (window.jQuery && window.jQuery.fn.fancybox) {
            window.jQuery(section.grid).find('[data-fancybox]').fancybox({
                wheel: false, transitionEffect: 'slide', loop: true,
                toolbar: true, clickContent: false, thumbs: false, zoom: true, close: true
            });
        }
    }

    function pageButton(section, label, page, disabled, active) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.className = 'gallery-page-button' + (active ? ' active' : '');
        button.setAttribute('aria-label', /^\d+$/.test(label) ? 'Page ' + label : label === 'Prev' ? 'Previous page' : 'Next page');
        if (active) button.setAttribute('aria-current', 'page');
        button.addEventListener('click', function () {
            if (page !== section.page) fetchGallery(section, page, true);
        });
        return button;
    }

    function renderPagination(section) {
        var nav = section.pagination;
        nav.innerHTML = '';
        if (section.totalPages <= 1) return;
        nav.appendChild(pageButton(section, 'Prev', section.page - 1, section.page <= 1, false));
        for (var page = Math.max(1, section.page - 2); page <= Math.min(section.totalPages, section.page + 2); page++) {
            nav.appendChild(pageButton(section, String(page), page, false, page === section.page));
        }
        nav.appendChild(pageButton(section, 'Next', section.page + 1, section.page >= section.totalPages, false));
    }

    function updateQuery(section) {
        var url = new URL(window.location.href);
        url.searchParams.set('album', section.album.slug);
        if (section.page > 1) url.searchParams.set('page', String(section.page));
        else url.searchParams.delete('page');
        window.history.replaceState({}, '', url.toString());
    }

    function scrollToSection(section) {
        if (section.element.scrollIntoView) section.element.scrollIntoView({ block: 'start' });
    }

    function fetchGallery(section, page, updateLocation, scrollWhenReady) {
        var activeRequest = ++section.requestId;
        section.page = page;
        section.grid.innerHTML = '';
        section.pagination.innerHTML = '';
        section.grid.setAttribute('aria-busy', 'true');
        setMessage(section.message, 'Loading gallery...', section.retry, false);
        return fetch(galleryApiUrl + 'galleries/public/' + encodeURIComponent(section.album.slug) + '?page=' + page + '&limit=' + limit)
            .then(function (response) {
                if (!response.ok) throw new Error('Request failed with status ' + response.status);
                return response.json();
            })
            .then(function (result) {
                if (activeRequest !== section.requestId) return;
                var items = readItems(result);
                var total = Number(result.meta && result.meta.totalPages);
                section.totalPages = Number.isInteger(total) && total >= 0
                    ? Math.max(1, total) : page + (items.length === limit ? 1 : 0);
                if (page > section.totalPages) {
                    return fetchGallery(section, section.totalPages, updateLocation || scrollWhenReady, scrollWhenReady);
                }
                renderItems(section, items);
                renderPagination(section);
                if (updateLocation) updateQuery(section);
                if (updateLocation) scrollToSection(section);
            })
            .catch(function (error) {
                if (activeRequest !== section.requestId) return;
                console.error('Error fetching gallery:', error);
                setMessage(section.message, 'Unable to load this gallery. Please try again.', section.retry, true);
            })
            .finally(function () {
                if (activeRequest === section.requestId) section.grid.setAttribute('aria-busy', 'false');
            });
    }

    function fetchAlbums() {
        sectionsEl.innerHTML = '';
        sectionsEl.setAttribute('aria-busy', 'true');
        setMessage(messageEl, 'Loading gallery albums...', retryEl, false);
        return fetch(galleryApiUrl + 'galleries/public')
            .then(function (response) {
                if (!response.ok) throw new Error('Request failed with status ' + response.status);
                return response.json();
            })
            .then(function (result) {
                var albums = Array.isArray(result.data) ? result.data : [];
                if (!albums.length) {
                    setMessage(messageEl, 'No gallery albums are available yet.', retryEl, false);
                    return;
                }
                setMessage(messageEl, '', retryEl, false);
                var params = new URLSearchParams(window.location.search);
                var slug = params.get('album');
                var requestedPage = parseInt(params.get('page'), 10);
                if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) requestedPage = 1;
                var sections = albums.map(createSection);
                var linkedSection = null;
                return Promise.all(sections.map(function (section, index) {
                    var targeted = slug ? section.album.slug === slug : index === 0;
                    if (slug && targeted) linkedSection = section;
                    return fetchGallery(section, targeted ? requestedPage : 1, false, targeted);
                })).then(function () {
                    if (linkedSection) scrollToSection(linkedSection);
                });
            })
            .catch(function (error) {
                console.error('Error fetching gallery albums:', error);
                setMessage(messageEl, 'Unable to load gallery albums. Please try again.', retryEl, true);
            })
            .finally(function () { sectionsEl.setAttribute('aria-busy', 'false'); });
    }

    fetchAlbums();
})();
