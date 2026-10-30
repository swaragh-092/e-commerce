/* One product catalogue: search first, filters beside results, display options last. */
(function (window) {
    'use strict';
    function normalize(value) {
        return String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
            .replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
    }
    function matchesCategory(entry, query, includePath) {
        var text = normalize(entry.name + ' ' + entry.slug + (includePath ? ' ' + entry.pathLabel : '')).toLowerCase();
        return normalize(query).toLowerCase().split(' ').every(function (word) { return text.indexOf(word) !== -1; });
    }
    function icon(path) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        var shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shape.setAttribute('d', path);
        svg.appendChild(shape);
        return svg;
    }
    function createCategoryPicker(host, onSelect) {
        var entries = [], selected = '', visible = [], activeIndex = -1;
        var wrapper = document.createElement('div');
        wrapper.className = 'catalog-field catalog-field-category catalog-category-picker';
        var label = document.createElement('label');
        label.id = 'catalog-category-label';
        label.htmlFor = 'catalog-category';
        label.textContent = 'Category';
        var trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.id = 'catalog-category';
        trigger.className = 'catalog-category-trigger';
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', 'catalog-category-popover');
        trigger.setAttribute('aria-describedby', 'catalog-category-selection');
        var selection = document.createElement('p');
        selection.id = 'catalog-category-selection';
        selection.className = 'catalog-category-selection';
        var popup = document.createElement('div');
        popup.id = 'catalog-category-popover';
        popup.className = 'catalog-category-popover';
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-labelledby', label.id);
        popup.hidden = true;
        var searchLabel = document.createElement('label');
        searchLabel.htmlFor = 'catalog-category-search';
        searchLabel.textContent = 'Search categories';
        var popupHeader = document.createElement('div');
        popupHeader.className = 'catalog-category-popover-header';
        var dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'catalog-category-dismiss';
        dismiss.setAttribute('aria-label', 'Close category search');
        dismiss.appendChild(icon('m6 6 12 12M6 18 18 6'));
        dismiss.addEventListener('click', function () { close(true); });
        popupHeader.append(searchLabel, dismiss);
        var input = document.createElement('input');
        input.id = 'catalog-category-search';
        input.type = 'search';
        input.placeholder = 'Search any category…';
        input.maxLength = 100;
        input.autocomplete = 'off';
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', 'catalog-category-options');
        var list = document.createElement('div');
        list.id = 'catalog-category-options';
        list.className = 'catalog-category-options';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', 'Categories');
        var message = document.createElement('p');
        message.className = 'catalog-category-message';
        message.setAttribute('role', 'status');
        popup.append(popupHeader, input, message, list);
        wrapper.append(label, trigger, selection, popup);
        host.appendChild(wrapper);

        function close(restoreFocus) {
            popup.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            if (restoreFocus) trigger.focus({ preventScroll: true });
        }
        function activate(index, scroll) {
            activeIndex = index;
            Array.from(list.children).forEach(function (option, i) { option.classList.toggle('is-active', i === index); });
            var option = list.children[index];
            if (option) {
                input.setAttribute('aria-activedescendant', option.id);
                if (scroll) option.scrollIntoView({ block: 'nearest' });
            } else input.removeAttribute('aria-activedescendant');
        }
        function render() {
            var query = normalize(input.value);
            visible = entries.filter(function (entry) { return !query || (entry.slug && matchesCategory(entry, query, true)); });
            list.replaceChildren();
            visible.forEach(function (entry, index) {
                var option = document.createElement('div');
                option.id = 'catalog-category-option-' + index;
                option.className = 'catalog-category-option';
                option.setAttribute('role', 'option');
                option.setAttribute('aria-selected', String(entry.slug === selected));
                option.dataset.category = entry.slug;
                var name = document.createElement('span');
                name.className = 'catalog-category-name';
                name.textContent = entry.name;
                option.appendChild(name);
                if (entry.path && entry.path.length > 1) {
                    var path = document.createElement('span');
                    path.className = 'catalog-category-path';
                    path.textContent = entry.pathLabel;
                    option.appendChild(path);
                }
                option.addEventListener('click', function () { choose(entry); });
                list.appendChild(option);
            });
            var count = visible.filter(function (entry) { return !!entry.slug; }).length;
            message.textContent = visible.length ? count + (count === 1 ? ' category' : ' categories') + (query ? ' found' : '') : 'No categories match your search.';
            activate(Math.max(0, visible.findIndex(function (entry) { return entry.slug === selected; })), false);
        }
        function choose(entry) {
            close(true);
            onSelect(entry.slug);
        }
        function open(query) {
            input.value = query || '';
            popup.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            input.setAttribute('aria-expanded', 'true');
            render();
            var rect = wrapper.getBoundingClientRect();
            if (rect.top < 16 || rect.bottom > window.innerHeight - 16) {
                wrapper.scrollIntoView({ block: 'center', behavior: 'auto' });
                rect = wrapper.getBoundingClientRect();
            }
            var below = window.innerHeight - rect.bottom - 16;
            var above = rect.top - 16;
            var upward = below < 280 && above > below;
            wrapper.classList.toggle('opens-upward', upward);
            popup.style.maxHeight = Math.max(160, Math.min(380, upward ? above : below)) + 'px';
            input.focus({ preventScroll: true });
        }
        trigger.addEventListener('click', function () { if (popup.hidden) open(); else close(false); });
        trigger.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(); }
        });
        input.addEventListener('input', render);
        input.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                activate(Math.max(0, Math.min(visible.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1))), true);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                if (visible[activeIndex]) choose(visible[activeIndex]);
            }
        });
        wrapper.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !popup.hidden) { event.preventDefault(); event.stopPropagation(); close(true); }
        });
        document.addEventListener('pointerdown', function (event) { if (!wrapper.contains(event.target)) close(false); });
        document.addEventListener('focusin', function (event) { if (!wrapper.contains(event.target)) close(false); });
        return {
            open: open,
            close: close,
            update: function (items, slug) {
                entries = [{ slug: '', name: 'All categories', pathLabel: '' }].concat(items);
                selected = slug;
                var entry = entries.find(function (item) { return item.slug === slug; });
                var name = entry ? entry.name : slug.replace(/-/g, ' ');
                trigger.textContent = name;
                trigger.setAttribute('aria-label', 'Category: ' + name);
                trigger.dataset.value = slug;
                trigger.title = entry ? entry.pathLabel || entry.name : name;
                selection.textContent = entry && entry.path && entry.path.length > 1 ? entry.pathLabel : '';
                if (!popup.hidden) render();
            }
        };
    }

    var B = {};
    B.create = function (config) {
        var controls = document.getElementById('catalog-controls');
        var pagination = document.getElementById('catalog-pagination');
        if (!controls || !pagination) return null;
        var appliedQuery, busy = false, focusResults = false, categories = [], categoryEntries = [];
        var fields = {};
        var form = document.createElement('form');
        form.className = 'catalog-search-form';
        form.setAttribute('role', 'search');
        form.setAttribute('aria-label', 'Search products and categories');
        document.getElementById('catalog-search').appendChild(form);

        function field(host, name, label, input) {
            var wrapper = document.createElement('div');
            wrapper.className = 'catalog-field catalog-field-' + name;
            var caption = document.createElement('label');
            input.id = 'catalog-' + name;
            input.name = name;
            caption.htmlFor = input.id;
            caption.textContent = label;
            wrapper.append(caption, input);
            host.appendChild(wrapper);
            fields[name] = input;
            return wrapper;
        }
        function options(select, values) {
            select.replaceChildren();
            values.forEach(function (value) {
                var option = document.createElement('option');
                option.value = value.value;
                option.textContent = value.label;
                select.appendChild(option);
            });
        }
        function select(host, name, label, values) {
            var input = document.createElement('select');
            options(input, values);
            field(host, name, label, input);
            return input;
        }
        var search = document.createElement('input');
        search.type = 'search';
        search.maxLength = 100;
        search.placeholder = config.placeholder;
        search.setAttribute('enterkeyhint', 'search');
        var searchField = field(form, 'q', 'Search products and categories', search);
        var submit = document.createElement('button');
        submit.type = 'submit';
        submit.className = 'catalog-search-button';
        submit.textContent = 'Search';
        submit.appendChild(icon('M5 12h14m-6-6 6 6-6 6'));
        var searchShell = document.createElement('div');
        searchShell.className = 'catalog-search-shell';
        // Browser autofill can erase an input's background image; keep the icon separate.
        var searchIcon = icon('M21 21l-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0');
        searchIcon.classList.add('catalog-search-icon');
        searchShell.append(searchIcon, search, submit);
        searchField.appendChild(searchShell);

        var filters = document.getElementById('catalog-filters');
        var categoryPicker = createCategoryPicker(filters, function (slug) {
            write({ category: slug, page: 1 });
        });
        var hint = document.createElement('p');
        hint.className = 'catalog-filter-hint';
        hint.textContent = 'Includes all nested categories.';
        filters.appendChild(hint);
        var filterStatus = document.createElement('p');
        filterStatus.className = 'catalog-filter-status';
        filterStatus.setAttribute('role', 'status');
        filters.appendChild(filterStatus);
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'catalog-filter-retry';
        retry.textContent = 'Reload categories';
        retry.hidden = true;
        retry.addEventListener('click', function () { window.location.reload(); });
        filters.appendChild(retry);
        var panel = document.getElementById('catalog-filter-panel');
        var mobile = window.matchMedia('(max-width: 767px)');
        panel.open = !mobile.matches;
        function resizeFilters() {
            categoryPicker.close(false);
            panel.open = !mobile.matches;
            renderCategoryBrowser(read());
        }
        if (mobile.addEventListener) mobile.addEventListener('change', resizeFilters);

        var sort = select(document.getElementById('catalog-results-toolbar'), 'sort', 'Sort by', config.sorts);
        var limit = select(document.getElementById('catalog-page-size'), 'limit', 'Products per page', config.sizes.map(function (size) {
            return { value: String(size), label: String(size) };
        }));
        [sort, limit].forEach(function (input) {
            input.addEventListener('change', function () {
                var patch = { page: 1 };
                patch[input.name] = input.value;
                write(patch);
            });
        });
        var status = document.createElement('p');
        status.id = 'catalog-results-status';
        status.className = 'catalog-results-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        document.querySelector('.catalog-results-summary').appendChild(status);

        // Visual browsing follows the same category state as the searchable picker.
        var explorer = document.getElementById('catalog-category-browser');
        var explorerKey = '', expandedBranch = null, browsedBranch = null;
        var explorerHeader = document.createElement('div');
        explorerHeader.className = 'catalog-browse-header';
        var explorerTitle = document.createElement('h2');
        explorerTitle.id = 'catalog-category-browser-title';
        explorerTitle.tabIndex = -1;
        var productJump = document.createElement('a');
        productJump.className = 'catalog-browse-products';
        productJump.href = '#catalog-list-title';
        productJump.textContent = 'View products ↓';
        productJump.addEventListener('click', function (event) {
            event.preventDefault();
            focusBrowseTarget(document.getElementById('catalog-list-title'));
        });
        explorerHeader.appendChild(explorerTitle);
        var explorerHint = document.createElement('p');
        explorerHint.className = 'catalog-browse-hint';
        var explorerList = document.createElement('ul');
        explorerList.id = 'catalog-category-cards';
        explorerList.className = 'catalog-category-cards';
        var showCategories = document.createElement('button');
        showCategories.type = 'button';
        showCategories.className = 'catalog-browse-more';
        showCategories.setAttribute('aria-controls', explorerList.id);
        showCategories.addEventListener('click', function () {
            var state = read();
            var scope = JSON.stringify([state.category, state.q]);
            expandedBranch = expandedBranch === scope ? null : scope;
            renderCategoryBrowser(state);
        });
        var explorerActions = document.createElement('div');
        explorerActions.className = 'catalog-browse-actions';
        explorerActions.append(showCategories, productJump);
        explorerHeader.appendChild(explorerActions);
        explorer.append(explorerHeader, explorerHint, explorerList);

        function focusBrowseTarget(target) {
            target.tabIndex = -1;
            target.focus({ preventScroll: true });
            target.scrollIntoView({ block: 'start', behavior: 'auto' });
        }
        function categoryLink(node, className) {
            var link = document.createElement('a');
            link.className = className;
            link.dataset.category = node.slug;
            var url = new URL(window.location.href);
            ['q', 'page', 'slug', 'variant', 'cat', 'type', 'browse'].forEach(function (key) { url.searchParams.delete(key); });
            if (node.slug) url.searchParams.set('category', node.slug);
            else url.searchParams.delete('category');
            url.hash = '';
            link.href = url.href;
            link.addEventListener('click', function (event) {
                if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                categoryPicker.close(false);
                write({ category: node.slug, q: '', page: 1 });
                focusBrowseTarget(node.slug && !(node.children || []).length
                    ? document.getElementById('catalog-list-title') : explorerTitle);
            });
            return link;
        }
        function categoryImage(node) {
            var candidates = [node.image, node.icon];
            for (var i = 0; i < candidates.length; i++) {
                if (typeof candidates[i] !== 'string' || !candidates[i].trim()) continue;
                var src = window.OrbiCatalog.imageUrl(candidates[i]);
                if (src === 'images/orbi-seeds-logo.png') continue;
                try { new URL(src, window.location.href); return { src: src, isIcon: i === 1 }; } catch (_) { /* Try the next image. */ }
            }
            return { src: 'images/orbi-seeds-logo.png', placeholder: true };
        }
        function renderCategoryBrowser(state) {
            var entry = categoryEntries.find(function (item) { return item.slug === state.category; });
            var searching = !!state.q;
            explorer.hidden = !categories.length || !!new URLSearchParams(window.location.search).get('slug')
                || !!(state.category && !entry);
            if (explorer.hidden) {
                explorerList.replaceChildren();
                explorerKey = '';
                return;
            }
            var scope = JSON.stringify([state.category, state.q]);
            if (browsedBranch !== scope) expandedBranch = null;
            browsedBranch = scope;
            var node = entry && entry.path[entry.path.length - 1];
            var choices = searching ? categoryEntries.filter(function (item) {
                return Array.from(state.q).length >= config.minSearch
                    && (!state.category || item.path.some(function (parent) { return parent.slug === state.category; }))
                    && matchesCategory(item, state.q, false);
            }).map(function (item) {
                return { node: item.path[item.path.length - 1],
                    parents: item.path.slice(0, -1).map(function (parent) { return parent.name; }).join(' › ') };
            }) : (node ? node.children || [] : categories).map(function (child) {
                return { node: child, parents: '' };
            });
            if (!choices.length) {
                explorer.hidden = true;
                explorerList.replaceChildren();
                explorerKey = '';
                return;
            }
            var previewCount = mobile.matches ? 2 : 4;
            var expanded = expandedBranch === scope;
            // Keep focus and loaded images when cached/API tree refreshes contain the same data.
            var key = JSON.stringify([scope, state.sort, state.limit, expanded, previewCount,
                entry && entry.path.map(function (item) { return [item.slug, item.name]; }),
                choices.map(function (choice) {
                    var item = choice.node;
                    return [item.slug, item.name, categoryImage(item), (item.children || []).length, choice.parents];
                })]);
            if (key === explorerKey) return;
            explorerKey = key;
            explorerTitle.textContent = searching ? 'Searched categories' : node ? 'Explore ' + node.name : 'Browse by category';
            explorerHint.hidden = searching || !!node;
            explorerHint.textContent = 'Discover our seed collections. Choose a category to get started.';
            explorerList.replaceChildren();
            explorerList.hidden = false;
            choices.slice(0, expanded ? choices.length : previewCount).forEach(function (choice) {
                var child = choice.node;
                var item = document.createElement('li');
                var card = categoryLink(child, 'catalog-category-card');
                var image = document.createElement('img');
                var asset = categoryImage(child);
                image.src = asset.src;
                image.alt = '';
                image.width = 180;
                image.height = 110;
                image.loading = 'lazy';
                image.decoding = 'async';
                image.classList.toggle('is-placeholder', !!asset.placeholder);
                image.classList.toggle('is-icon', !!asset.isIcon);
                image.addEventListener('error', function () {
                    image.classList.add('is-placeholder');
                    image.src = 'images/orbi-seeds-logo.png';
                }, { once: true });
                var name = document.createElement('span');
                name.className = 'catalog-category-card-name';
                name.textContent = child.name;
                var detail = document.createElement('span');
                detail.className = 'catalog-category-card-detail';
                var count = (child.children || []).length;
                detail.textContent = count ? count + (count === 1 ? ' category' : ' categories') + ' →' : 'View products →';
                card.append(image, name);
                if (choice.parents) {
                    var context = document.createElement('span');
                    context.className = 'catalog-category-card-context';
                    context.textContent = choice.parents;
                    card.appendChild(context);
                }
                card.appendChild(detail);
                item.appendChild(card);
                explorerList.appendChild(item);
            });
            showCategories.hidden = choices.length <= previewCount;
            showCategories.setAttribute('aria-expanded', String(expanded));
            showCategories.textContent = expanded ? 'Show fewer categories' : 'Show all ' + choices.length + ' categories';
        }

        function pathTo(items, slug, path) {
            for (var i = 0; i < items.length; i++) {
                var next = (path || []).concat(items[i]);
                if (items[i].slug === slug) return next;
                var found = pathTo(items[i].children || [], slug, next);
                if (found) return found;
            }
            return null;
        }
        function read() {
            var params = new URLSearchParams(window.location.search);
            var state = { q: Array.from(normalize(params.get('q'))).slice(0, 100).join(''), category: params.get('category') || '', page: 1 };
            var page = Number(params.get('page'));
            if (Number.isSafeInteger(page) && page > 0) state.page = page;
            ['sort', 'limit'].forEach(function (key) {
                var allowed = Array.from(fields[key].options, function (option) { return option.value; });
                state[key] = allowed.indexOf(params.get(key)) !== -1 ? params.get(key) : allowed[0];
            });
            state.limit = Number(state.limit);
            return state;
        }
        function sync(resetSearch) {
            var state = read();
            // Keep an unfinished draft when filters or category metadata refresh.
            if (resetSearch === true || appliedQuery !== state.q) search.value = state.q;
            appliedQuery = state.q;
            sort.value = state.sort;
            limit.value = String(state.limit);
            var path = pathTo(categories, state.category);
            categoryPicker.update(categoryEntries, state.category);
            var title = path ? path[path.length - 1].name : state.category.replace(/-/g, ' ');
            document.getElementById('catalog-list-title').textContent = title ? 'Products: ' + title : 'All seed products';
            renderCategoryBrowser(state);
            var filterCount = document.getElementById('catalog-filter-count');
            filterCount.textContent = state.category ? '1' : '';
            panel.querySelector('summary').setAttribute('aria-label', state.category ? 'Filters, 1 active category filter' : 'Filters');
            return state;
        }
        function write(patch, replace) {
            var url = new URL(window.location.href);
            Object.keys(patch).forEach(function (key) {
                if (patch[key] === '' || patch[key] == null || (key === 'page' && Number(patch[key]) === 1)) url.searchParams.delete(key);
                else url.searchParams.set(key, patch[key]);
            });
            ['slug', 'variant', 'cat', 'type', 'browse'].forEach(function (key) { url.searchParams.delete(key); });
            url.hash = '';
            window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
            config.onChange(sync(Object.prototype.hasOwnProperty.call(patch, 'q')));
        }
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            write({ q: normalize(search.value), page: 1 });
        });
        window.addEventListener('popstate', function () { config.onChange(sync(true)); });
        function results(meta) {
            pagination.replaceChildren();
            var total = Math.max(0, Number(meta.total) || 0);
            var pages = Math.max(1, Number(meta.totalPages) || 1);
            var page = Math.min(pages, Number(meta.page) || 1);
            var size = Number(meta.limit) || read().limit;
            status.textContent = total ? 'Showing ' + ((page - 1) * size + 1) + '–' + Math.min(page * size, total) + ' of ' + total + ' products' : 'No products found';
            if (meta.note) status.textContent += '. ' + meta.note;
            if (focusResults) {
                focusResults = false;
                window.setTimeout(function () {
                    var target = document.getElementById('catalog-results');
                    target.setAttribute('tabindex', '-1');
                    target.focus({ preventScroll: true });
                    target.scrollIntoView({ block: 'start', behavior: 'auto' });
                }, 0);
            }
            if (pages <= 1) return;
            function button(label, target, disabled, current) {
                var element = document.createElement('button');
                element.type = 'button';
                element.textContent = label;
                element.disabled = disabled || busy;
                if (current) element.setAttribute('aria-current', 'page');
                element.setAttribute('aria-label', /^\d+$/.test(label) ? 'Page ' + label : label + ' page');
                element.addEventListener('click', function () { focusResults = true; write({ page: target }); });
                pagination.appendChild(element);
            }
            button('Previous', page - 1, page === 1);
            var numbers = [1, page - 1, page, page + 1, pages].filter(function (value, i, all) { return value >= 1 && value <= pages && all.indexOf(value) === i; }).sort(function (a, b) { return a - b; });
            numbers.forEach(function (number, i) {
                if (i && number - numbers[i - 1] > 1) {
                    var gap = document.createElement('span'); gap.textContent = '…'; gap.setAttribute('aria-hidden', 'true'); pagination.appendChild(gap);
                }
                button(String(number), number, number === page, number === page);
            });
            button('Next', page + 1, page === pages);
        }
        sync();
        return {
            read: read, sync: sync, write: write, results: results,
            setBusy: function (value) {
                busy = value;
                if (busy) { pagination.replaceChildren(); status.textContent = 'Loading products…'; }
            },
            setStatus: function (message) { status.textContent = message; pagination.replaceChildren(); },
            setCategories: function (items) {
                categories = items;
                categoryEntries = [];
                function collect(nodes, path) {
                    nodes.forEach(function (node) {
                        if (path.some(function (parent) { return parent.slug === node.slug; })) return;
                        var next = path.concat(node);
                        categoryEntries.push({ slug: node.slug, name: node.name, path: next,
                            pathLabel: next.map(function (item) { return item.name; }).join(' › ') });
                        collect(node.children || [], next);
                    });
                }
                collect(items, []);
                filterStatus.textContent = '';
                retry.hidden = true;
                sync();
            },
            setCategoryError: function () {
                filterStatus.textContent = 'Categories could not be loaded. You can still search for products.';
                retry.hidden = false;
            }
        };
    };
    window.OrbiBrowser = B;
})(window);
