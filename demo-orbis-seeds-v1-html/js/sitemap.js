document.addEventListener('DOMContentLoaded', function () {
    var container = document.getElementById('sitemap-categories');
    if (!container) return;
    container.setAttribute('aria-busy', 'true');

    function appendCategories(categories, list) {
        categories.forEach(function (category) {
            var item = document.createElement('li');
            var link = document.createElement('a');
            var children = category.children || [];
            link.textContent = category.name;
            link.href = (children.length ? 'product.html?cat=' : 'products.html?category=') + encodeURIComponent(category.slug);
            item.appendChild(link);
            if (children.length) {
                var nested = document.createElement('ul');
                appendCategories(children, nested);
                item.appendChild(nested);
            }
            list.appendChild(item);
        });
    }

    fetch(API_URL + 'categories?hideEmpty=true').then(OrbiCatalog.readResponse).then(function (result) {
        if (!Array.isArray(result.data)) throw new Error('Unable to load categories');
        appendCategories(result.data, container);
    }).catch(function () {
        var message = document.createElement('li');
        message.textContent = 'Categories are currently unavailable.';
        container.appendChild(message);
    }).finally(function () {
        container.setAttribute('aria-busy', 'false');
    });
});
