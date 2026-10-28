/* Search, filters and page navigation shared by the static catalog pages. */
(function (window) {
    'use strict';
    var B = {};
    B.create = function (config) {
        var controls = document.getElementById('catalog-controls');
        var pagination = document.getElementById('catalog-pagination');
        if (!controls || !pagination) return null;
        var timer;
        var busy = false;
        var focusResults = false;
        var fields = {};
        var sizes = config.sizes;
        var form = document.createElement('form');
        form.className = 'catalog-toolbar';
        form.setAttribute('role', 'search');
        form.setAttribute('aria-label', config.label + ' search and filters');

        function field(name, label, input) {
            var wrapper = document.createElement('div');
            wrapper.className = 'catalog-field catalog-field-' + name;
            var caption = document.createElement('label');
            input.id = 'catalog-' + name;
            input.name = name;
            caption.htmlFor = input.id;
            caption.textContent = label;
            wrapper.append(caption, input);
            form.appendChild(wrapper);
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
        var search = document.createElement('input');
        search.type = 'search';
        search.maxLength = 100;
        search.placeholder = config.placeholder;
        search.setAttribute('aria-describedby', 'catalog-search-help');
        var searchField = field('q', 'Search ' + config.label.toLowerCase(), search);
        var submit = document.createElement('button');
        submit.type = 'submit';
        submit.className = 'catalog-search-button';
        submit.textContent = 'Search';
        searchField.appendChild(submit);
        (config.filters || []).concat([
            { name: 'sort', label: 'Sort by', options: config.sorts },
            { name: 'limit', label: 'Per page', options: sizes.map(function (size) { return { value: String(size), label: String(size) }; }) }
        ]).forEach(function (filter) {
            var select = document.createElement('select');
            options(select, filter.options);
            field(filter.name, filter.label, select);
            select.addEventListener('change', function () {
                clearTimeout(timer);
                var patch = { page: 1, q: filter.resetSearch ? '' : search.value.trim() };
                patch[filter.name] = select.value;
                write(patch);
            });
        });
        var clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'catalog-clear';
        clear.textContent = 'Clear filters';
        clear.addEventListener('click', function () {
            clearTimeout(timer);
            var patch = { q: '', page: 1, sort: config.sorts[0].value };
            (config.filters || []).forEach(function (filter) { patch[filter.name] = ''; });
            write(patch);
        });
        form.appendChild(clear);
        var help = document.createElement('p');
        help.id = 'catalog-search-help';
        help.className = 'catalog-search-help';
        var status = document.createElement('p');
        status.id = 'catalog-results-status';
        status.className = 'catalog-results-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        controls.append(form, help, status);

        function read() {
            var params = new URLSearchParams(window.location.search);
            var state = { q: (params.get('q') || '').trim().slice(0, 100), page: 1 };
            var page = Number(params.get('page'));
            if (Number.isSafeInteger(page) && page > 0) state.page = page;
            Object.keys(fields).filter(function (key) { return key !== 'q'; }).forEach(function (key) {
                var allowed = Array.from(fields[key].options, function (option) { return option.value; });
                var value = params.get(key);
                state[key] = allowed.indexOf(value) !== -1 ? value : allowed[0];
            });
            state.limit = Number(state.limit);
            return state;
        }
        function sync() {
            var state = read();
            Object.keys(fields).forEach(function (key) { fields[key].value = String(state[key]); });
            help.textContent = config.minSearch && state.q && Array.from(state.q).length < config.minSearch
                ? 'Enter at least ' + config.minSearch + ' characters to search products.' : '';
            return state;
        }
        function write(patch, replace) {
            clearTimeout(timer);
            var url = new URL(window.location.href);
            Object.keys(patch).forEach(function (key) {
                if (patch[key] === '' || patch[key] == null || (key === 'page' && Number(patch[key]) === 1)) url.searchParams.delete(key);
                else url.searchParams.set(key, patch[key]);
            });
            url.searchParams.delete('slug');
            url.searchParams.delete('variant');
            url.hash = '';
            window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
            var state = sync();
            config.onChange(state);
        }
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            clearTimeout(timer);
            write({ q: search.value.trim(), page: 1 });
        });
        search.addEventListener('input', function () {
            clearTimeout(timer);
            timer = setTimeout(function () { write({ q: search.value.trim(), page: 1 }, true); }, 350);
        });
        window.addEventListener('popstate', function () {
            clearTimeout(timer);
            config.onChange(sync());
        });
        function results(meta) {
            pagination.replaceChildren();
            var total = Math.max(0, Number(meta.total) || 0);
            var pages = Math.max(1, Number(meta.totalPages) || 1);
            var page = Math.min(pages, Number(meta.page) || 1);
            var limit = Number(meta.limit) || read().limit;
            var start = total ? (page - 1) * limit + 1 : 0;
            var end = Math.min(page * limit, total);
            status.textContent = 'Showing ' + start + '–' + end + ' of ' + total + ' ' + config.label.toLowerCase() + (meta.note ? '. ' + meta.note : '');
            if (focusResults) {
                focusResults = false;
                window.setTimeout(function () {
                    var target = document.getElementById('catalog-results');
                    if (!target) return;
                    target.setAttribute('tabindex', '-1');
                    target.focus({ preventScroll: true });
                    if (target.scrollIntoView) target.scrollIntoView({ block: 'start', behavior: 'auto' });
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
                if (busy) { pagination.replaceChildren(); status.textContent = 'Loading ' + config.label.toLowerCase() + '…'; }
            },
            setStatus: function (message) { status.textContent = message; pagination.replaceChildren(); },
            setOptions: function (name, values) {
                var selected = new URLSearchParams(window.location.search).get(name) || '';
                if (selected && !values.some(function (value) { return value.value === selected; })) values.push({ value: selected, label: selected.replace(/-/g, ' ') });
                options(fields[name], values);
                fields[name].value = selected;
            }
        };
    };
    window.OrbiBrowser = B;
})(window);
