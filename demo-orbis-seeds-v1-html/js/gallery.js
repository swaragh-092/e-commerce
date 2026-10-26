(function () {
    var limit = 20;
    var galleryApiUrl = API_URL.replace(/\/+$/, '') + '/';
    var mediaBaseUrl = APP_URL;
    var content = document.getElementById('gallery-content');
    var messageEl = document.getElementById('gallery-message');
    var retryEl = document.getElementById('gallery-retry');
    if (!content || !messageEl || !retryEl) return;

    var params = new URLSearchParams(window.location.search);
    var slug = params.get('album');
    // Keep previously shared gallery.html?album= links working as album views.
    var isDetail = content.dataset.galleryView === 'detail' || Boolean(slug);
    var currentPage = Math.max(1, parseInt(params.get('page'), 10) || 1);
    var totalPages = 1;
    var requestId = 0;
    var grid;
    var pagination;
    if (isDetail) {
        content.className = 'gallery-detail-content';
        var back = document.getElementById('gallery-back');
        if (!back) {
            back = document.createElement('a');
            back.id = 'gallery-back';
            back.href = 'gallery.html';
            back.className = 'view-product-btn back-btn gallery-back';
            back.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span>Back to galleries</span>';
            content.before(back);
        }
        grid = document.createElement('div');
        grid.className = 'gallery-inner-wrapper';
        pagination = document.createElement('nav');
        pagination.className = 'gallery-pagination';
        pagination.setAttribute('aria-label', 'Album image pages');
        content.appendChild(grid);
        content.appendChild(pagination);
    }
    retryEl.addEventListener('click', function () {
        if (isDetail) fetchDetail(currentPage);
        else fetchAlbums();
    });

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

    function setMessage(text, canRetry) {
        messageEl.textContent = text;
        messageEl.hidden = !text;
        retryEl.hidden = !canRetry;
    }

    function fetchJson(url) {
        return fetch(url).then(function (response) {
            if (!response.ok) {
                var error = new Error('Request failed with status ' + response.status);
                error.status = response.status;
                throw error;
            }
            return response.json();
        });
    }

    function renderCover(slot, imageUrl, title) {
        slot.innerHTML = '';
        if (!imageUrl) {
            slot.className = 'gallery-album-cover gallery-cover-empty';
            slot.textContent = 'No cover photo available';
            return;
        }
        slot.className = 'gallery-album-cover';
        var img = document.createElement('img');
        img.src = imageUrl;
        img.alt = title;
        img.loading = 'lazy';
        img.addEventListener('error', function () { renderCover(slot, '', title); }, { once: true });
        slot.appendChild(img);
    }

    function renderAlbum(album) {
        var card = document.createElement('a');
        card.className = 'gallery-album-card';
        card.href = 'gallery-detail.html?album=' + encodeURIComponent(album.slug);
        var title = safeText(album.title, 'Gallery');
        card.setAttribute('aria-label', 'View ' + title + ' gallery');
        var cover = document.createElement('div');
        renderCover(cover, readImage(album.coverImage), title);
        card.appendChild(cover);
        var heading = document.createElement('h3');
        heading.textContent = title;
        card.appendChild(heading);
        if (album.description) {
            var description = document.createElement('p');
            description.textContent = album.description;
            card.appendChild(description);
        }
        content.appendChild(card);

        // Older API deployments omit coverImage; obtain just their first image.
        if (!Object.prototype.hasOwnProperty.call(album, 'coverImage')) {
            return fetchJson(galleryApiUrl + 'galleries/public/' + encodeURIComponent(album.slug) + '?page=1&limit=1')
                .then(function (result) { renderCover(cover, readImage(readItems(result)[0]), title); })
                .catch(function () { renderCover(cover, '', title); });
        }
        return Promise.resolve();
    }

    function fetchAlbums() {
        content.innerHTML = '';
        content.setAttribute('aria-busy', 'true');
        setMessage('Loading galleries...', false);
        return fetchJson(galleryApiUrl + 'galleries/public')
            .then(function (result) {
                var albums = Array.isArray(result.data) ? result.data : [];
                setMessage(albums.length ? '' : 'No galleries are available yet.', false);
                return Promise.all(albums.map(renderAlbum));
            })
            .catch(function (error) {
                console.error('Error fetching galleries:', error);
                setMessage('Unable to load galleries. Please try again.', true);
            })
            .finally(function () { content.setAttribute('aria-busy', 'false'); });
    }

    function renderImages(items) {
        grid.innerHTML = '';
        items.forEach(function (item) {
            var imageUrl = readImage(item);
            if (!imageUrl) return;
            var title = safeText(item.title || item.alt || (item.media && (item.media.alt || item.media.caption)), 'Gallery image');
            var link = document.createElement('a');
            link.href = imageUrl;
            link.setAttribute('data-fancybox', 'album-images');
            link.setAttribute('aria-label', 'View image: ' + title);
            var img = document.createElement('img');
            img.src = imageUrl;
            img.alt = title;
            img.loading = 'lazy';
            link.appendChild(img);
            grid.appendChild(link);
        });
        setMessage(grid.childElementCount ? '' : 'This gallery has no images yet.', false);
        if (window.jQuery && window.jQuery.fn.fancybox) {
            window.jQuery(grid).find('[data-fancybox]').fancybox({
                wheel: false, transitionEffect: 'slide', loop: true,
                toolbar: true, clickContent: false, thumbs: false, zoom: true, close: true
            });
        }
    }

    function pageButton(label, page, disabled, active) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.className = 'gallery-page-button' + (active ? ' active' : '');
        button.setAttribute('aria-label', /^\d+$/.test(label) ? 'Page ' + label : label === 'Prev' ? 'Previous page' : 'Next page');
        if (active) button.setAttribute('aria-current', 'page');
        button.addEventListener('click', function () {
            if (page !== currentPage) fetchDetail(page, true);
        });
        return button;
    }

    function renderPagination() {
        pagination.innerHTML = '';
        if (totalPages <= 1) return;
        pagination.appendChild(pageButton('Prev', currentPage - 1, currentPage <= 1, false));
        for (var page = Math.max(1, currentPage - 2); page <= Math.min(totalPages, currentPage + 2); page++) {
            pagination.appendChild(pageButton(String(page), page, false, page === currentPage));
        }
        pagination.appendChild(pageButton('Next', currentPage + 1, currentPage >= totalPages, false));
    }

    function fetchDetail(page, updateLocation) {
        if (!slug) {
            setMessage('Choose a gallery to view its images.', false);
            content.setAttribute('aria-busy', 'false');
            return;
        }
        var activeRequest = ++requestId;
        currentPage = page;
        grid.innerHTML = '';
        pagination.innerHTML = '';
        content.setAttribute('aria-busy', 'true');
        setMessage('Loading gallery images...', false);
        return fetchJson(galleryApiUrl + 'galleries/public/' + encodeURIComponent(slug) + '?page=' + page + '&limit=' + limit)
            .then(function (result) {
                if (activeRequest !== requestId) return;
                var gallery = result.data && result.data.gallery;
                var title = safeText(gallery && gallery.title, 'Gallery');
                var heading = document.getElementById('gallery-title');
                if (heading) heading.textContent = title;
                document.title = title + ' | Orbi Seeds';
                var breadcrumb = document.getElementById('gallery-breadcrumb-title');
                if (breadcrumb) breadcrumb.textContent = title;
                var description = document.getElementById('gallery-description');
                if (description) {
                    description.textContent = safeText(gallery && gallery.description, '');
                    description.hidden = !description.textContent;
                }
                var items = readItems(result);
                var total = Number(result.meta && result.meta.totalPages);
                totalPages = Number.isInteger(total) && total >= 0 ? Math.max(1, total) : page + (items.length === limit ? 1 : 0);
                if (page > totalPages) return fetchDetail(totalPages, true);
                renderImages(items);
                renderPagination();
                if (updateLocation) {
                    var url = new URL(window.location.href);
                    if (page > 1) url.searchParams.set('page', String(page));
                    else url.searchParams.delete('page');
                    window.history.replaceState({}, '', url.toString());
                    if (content.scrollIntoView) content.scrollIntoView({ block: 'start' });
                }
            })
            .catch(function (error) {
                if (activeRequest !== requestId) return;
                console.error('Error fetching gallery:', error);
                setMessage(error.status === 404 ? 'This gallery is unavailable or no longer public.' : 'Unable to load gallery images. Please try again.', error.status !== 404);
            })
            .finally(function () {
                if (activeRequest === requestId) content.setAttribute('aria-busy', 'false');
            });
    }

    if (isDetail) fetchDetail(currentPage);
    else fetchAlbums();
})();
