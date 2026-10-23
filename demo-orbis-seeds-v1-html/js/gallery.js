(function () {
    var DEFAULT_PAGE = 1;
    var limit = 20;
    var isLoading = false;
    var currentPage = DEFAULT_PAGE;
    var totalPages = 1;
    var currentAlbum = null;
    var requestId = 0;
    var galleryApiUrl = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
        ? window.location.origin + '/api/' : API_URL;

    var wrapper = document.querySelector('.gallery-inner-wrapper');
    var albumsEl = document.getElementById('gallery-albums');
    var messageEl = document.getElementById('gallery-message');
    var paginationEl = document.getElementById('gallery-pagination');

    if (!wrapper || !paginationEl) return;

    function getQueryPage() {
        var params = new URLSearchParams(window.location.search);
        var value = parseInt(params.get('page'), 10);
        return !isNaN(value) && value > 0 ? value : DEFAULT_PAGE;
    }

    function setQueryPage(page) {
        var url = new URL(window.location.href);
        if (page <= 1) {
            url.searchParams.delete('page');
        } else {
            url.searchParams.set('page', String(page));
        }
        window.history.replaceState({}, '', url.toString());
    }

    function setQueryAlbum(slug) {
        var url = new URL(window.location.href);
        url.searchParams.set('album', slug);
        url.searchParams.delete('page');
        window.history.replaceState({}, '', url.toString());
    }

    function renderAlbums(albums) {
        albumsEl.innerHTML = '';
        albums.forEach(function (album) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'gallery-album-button' + (currentAlbum.slug === album.slug ? ' active' : '');
            button.textContent = album.title;
            button.setAttribute('aria-pressed', currentAlbum.slug === album.slug ? 'true' : 'false');
            button.addEventListener('click', function () {
                if (currentAlbum.slug === album.slug) return;
                currentAlbum = album;
                totalPages = 1;
                setQueryAlbum(album.slug);
                renderAlbums(albums);
                fetchGallery(1);
            });
            albumsEl.appendChild(button);
        });
    }

    function safeText(value, fallback) {
        return (typeof value === 'string' && value.trim()) ? value.trim() : fallback;
    }

    function normalizeImageUrl(url) {
        var imageUrl = safeText(url, '');
        if (!imageUrl) return '';
        if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
        if (imageUrl.charAt(0) === '/') return APP_URL + imageUrl;
        return imageUrl;
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

    function readTotalPages(result, itemsLength) {
        if (!result || typeof result !== 'object') return null;
        var data = result.data && typeof result.data === 'object' ? result.data : null;

        var candidates = [
            result.meta && result.meta.totalPages,
            data && data.totalPages,
            result.totalPages,
            data && data.total_pages,
            result.total_pages,
            data && data.lastPage,
            result.lastPage,
            data && data.last_page,
            result.last_page
        ];

        for (var i = 0; i < candidates.length; i++) {
            var value = parseInt(candidates[i], 10);
            if (!isNaN(value) && value > 0) return value;
        }

        var total = parseInt((result.meta && result.meta.total) || (data && data.total) || result.total, 10);
        if (!isNaN(total) && total >= 0) {
            return Math.max(1, Math.ceil(total / limit));
        }

        if (itemsLength < limit) return currentPage;
        return null;
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

    function renderItems(items) {
        wrapper.innerHTML = '';

        if (!items.length) {
            setMessage('No gallery items found.');
            return;
        }

        var fragment = document.createDocumentFragment();

        items.forEach(function (item) {
            var imageUrl = readImage(item);
            if (!imageUrl) return;

            var title = safeText(item.title || item.name || item.caption || item.alt, 'Gallery Image');

            var anchor = document.createElement('a');
            anchor.href = imageUrl;
            anchor.setAttribute('data-fancybox', 'gallery');

            var img = document.createElement('img');
            img.src = imageUrl;
            img.alt = title;
            img.loading = 'lazy';

            anchor.appendChild(img);
            fragment.appendChild(anchor);
        });

        if (fragment.childNodes.length === 0) {
            setMessage('No gallery items found.');
            return;
        }

        hideMessage();
        wrapper.appendChild(fragment);
    }

    function refreshLightbox() {
        if (!window.jQuery || !jQuery.fn.fancybox) return;
        jQuery('[data-fancybox="gallery"]').fancybox({
            wheel: false,
            transitionEffect: 'slide',
            loop: true,
            toolbar: true,
            clickContent: false,
            thumbs: false,
            zoom: true,
            close: true
        });
    }

    function setMessage(text) {
        messageEl.textContent = text;
        messageEl.style.display = 'block';
    }

    function hideMessage() {
        messageEl.style.display = 'none';
    }

    function createPageButton(label, page, disabled, isActive) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.disabled = disabled;
        btn.style.cursor = disabled ? 'default' : 'pointer';
        btn.style.background = isActive ? '#71c5dd' : '#fff';
        btn.style.color = isActive ? '#fff' : '#71c5dd';

        if (!disabled) {
            btn.addEventListener('click', function () {
                if (page === currentPage) return;
                fetchGallery(page);
            });
        }

        return btn;
    }

    function renderPagination() {
        paginationEl.innerHTML = '';

        if (totalPages <= 1) return;

        paginationEl.appendChild(createPageButton('Prev', currentPage - 1, currentPage <= 1, false));

        var start = Math.max(1, currentPage - 2);
        var end = Math.min(totalPages, currentPage + 2);

        for (var i = start; i <= end; i++) {
            paginationEl.appendChild(createPageButton(String(i), i, false, i === currentPage));
        }

        paginationEl.appendChild(createPageButton('Next', currentPage + 1, currentPage >= totalPages, false));
    }

    function fetchGallery(page) {
        if (!currentAlbum) return;
        var activeRequest = ++requestId;
        isLoading = true;
        currentPage = page;
        setMessage('Loading gallery...');
        paginationEl.innerHTML = '';

        fetch(galleryApiUrl + 'galleries/public/' + encodeURIComponent(currentAlbum.slug) + '?page=' + page + '&limit=' + limit)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Request failed with status ' + response.status);
                }
                return response.json();
            })
            .then(function (result) {
                if (activeRequest !== requestId) return;
                var items = readItems(result);
                renderItems(items);

                var detectedTotalPages = readTotalPages(result, items.length);
                if (detectedTotalPages !== null) {
                    totalPages = detectedTotalPages;
                } else {
                    totalPages = Math.max(currentPage, currentPage + (items.length === limit ? 1 : 0));
                }

                if (currentPage > totalPages) {
                    currentPage = totalPages;
                }

                setQueryPage(currentPage);
                renderPagination();
                refreshLightbox();
            })
            .catch(function (error) {
                if (activeRequest !== requestId) return;
                console.error('Error fetching gallery:', error);
                wrapper.innerHTML = '';
                setMessage('Unable to load gallery. Please try again later.');
                paginationEl.innerHTML = '';
            })
            .finally(function () {
                if (activeRequest === requestId) isLoading = false;
            });
    }

    fetch(galleryApiUrl + 'galleries/public')
        .then(function (response) {
            if (!response.ok) throw new Error('Request failed with status ' + response.status);
            return response.json();
        })
        .then(function (result) {
            var albums = Array.isArray(result.data) ? result.data : [];
            if (!albums.length) { setMessage('No gallery albums are available yet.'); return; }
            var requestedSlug = new URLSearchParams(window.location.search).get('album');
            currentAlbum = albums.find(function (album) { return album.slug === requestedSlug; })
                || albums.find(function (album) { return album.slug === 'gallery'; }) || albums[0];
            if (requestedSlug !== currentAlbum.slug) setQueryAlbum(currentAlbum.slug);
            renderAlbums(albums);
            fetchGallery(requestedSlug === currentAlbum.slug ? getQueryPage() : 1);
        })
        .catch(function (error) {
            console.error('Error fetching gallery albums:', error);
            setMessage('Unable to load gallery albums. Please try again later.');
        });
})();
