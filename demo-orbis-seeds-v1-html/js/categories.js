var categoriesData = [];
var navigationHistory = [];
var categoriesLoaded = false;
var categoriesLoading = false;
var categoryBrowser = null;

document.addEventListener("DOMContentLoaded", function () {
    categoryBrowser = window.OrbiBrowser && OrbiBrowser.create({
        label: 'Subcategories', search: false, sizes: [12, 24, 48],
        sorts: [{ value: 'name_asc', label: 'Name: A–Z' }, { value: 'name_desc', label: 'Name: Z–A' }],
        onChange: function () { if (categoriesLoaded) handleUrlParams(); }
    });
    fetchCategories();

    // Handle browser back/forward buttons
    if (!categoryBrowser) window.addEventListener('popstate', function () {
        if (categoriesLoaded) {
            handleUrlParams();
        }
    });
});

function compareCategories(a, b) {
    return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }) || String(a.slug).localeCompare(String(b.slug));
}

function fetchCategories() {
    const container = document.querySelector(".products-inner-wrapper");
    if (!container || categoriesLoading) return;
    categoriesLoading = true;

    container.innerHTML = '<div class="loading">Loading categories...</div>';
    container.setAttribute('aria-busy', 'true');

    fetch(API_URL + "categories?hideEmpty=true")
        .then(function (response) {
            if (!response.ok) throw new Error('Unable to load categories');
            return response.json();
        })
        .then(function (result) {
            if (result.success && Array.isArray(result.data)) {
                categoriesData = result.data;
                categoriesLoaded = true;
                handleUrlParams();
            } else {
                throw new Error('Unable to load categories');
            }
        })
        .catch(function (error) {
            console.error("Error fetching categories:", error);
            container.innerHTML = '<div class="error">Error loading categories.</div>';
            var retry = document.createElement('button');
            retry.type = 'button'; retry.className = 'view-product-btn'; retry.textContent = 'Try again';
            retry.onclick = fetchCategories;
            container.querySelector('.error').setAttribute('role', 'alert');
            container.querySelector('.error').appendChild(retry);
        }).finally(function () {
            categoriesLoading = false;
            container.setAttribute('aria-busy', 'false');
        });
}

function handleUrlParams() {
    var canonical = new URL(window.location.href);
    if (canonical.searchParams.has('q')) {
        canonical.searchParams.delete('q');
        window.history.replaceState({}, '', canonical);
    }
    const urlParams = new URLSearchParams(window.location.search);
    const categorySlug = urlParams.get("cat");

    navigationHistory = [];

    if (categorySlug) {
        const path = findCategoryPath(categoriesData, categorySlug);
        if (path && path.length > 0) {
            const targetCategory = path[path.length - 1];
            if (!targetCategory.children || targetCategory.children.length === 0) {
                window.location.replace('products.html?category=' + encodeURIComponent(targetCategory.slug));
                return;
            }
            // Reconstruct navigationHistory
            // The history should contain the states lead up to the current level
            // Root level
            navigationHistory.push({
                list: categoriesData.filter(c => c.parentId === null),
                name: "Our Products",
                slug: null
            });

            // Middle levels
            for (let i = 0; i < path.length - 1; i++) {
                navigationHistory.push({
                    list: path[i].children,
                    name: path[i].name,
                    slug: path[i].slug
                });
            }

            displayCategories(targetCategory.children, targetCategory.name, targetCategory, path);
        } else {
            const corrected = new URL(window.location.href);
            corrected.searchParams.delete('cat');
            window.history.replaceState({}, '', corrected);
            resetToRoot(false);
        }
    } else {
        resetToRoot(false);
    }
}

function findCategoryPath(categories, slug, currentPath = []) {
    for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const newPath = [...currentPath, cat];
        if (cat.slug === slug) return newPath;
        if (cat.children && cat.children.length > 0) {
            const foundPath = findCategoryPath(cat.children, slug, newPath);
            if (foundPath) return foundPath;
        }
    }
    return null;
}

function updateCategoryBanner(category, path) {
    const bannerElem = document.getElementById("bg") || document.querySelector(".inner-page-banner-wrapper");
    if (!bannerElem) return;

    const defaultBanner = "images/inr-bnr.avif";
    let bannerRaw = null;

    if (category && (category.bannerImage || category.banner)) {
        bannerRaw = category.bannerImage || category.banner;
    } else if (path && path.length > 0) {
        for (let i = path.length - 1; i >= 0; i--) {
            if (path[i] && (path[i].bannerImage || path[i].banner)) {
                bannerRaw = path[i].bannerImage || path[i].banner;
                break;
            }
        }
    }

    if (bannerRaw && typeof bannerRaw === "string" && bannerRaw.trim()) {
        bannerRaw = bannerRaw.trim();
        let bannerUrl = bannerRaw;
        if (/^https?:\/\//i.test(bannerRaw)) {
            bannerUrl = bannerRaw;
        } else if (bannerRaw.startsWith("/")) {
            bannerUrl = APP_URL + bannerRaw;
        } else {
            bannerUrl = APP_URL + "/" + bannerRaw;
        }
        bannerElem.style.background = "url('" + bannerUrl + "') no-repeat center center/cover";
    } else {
        bannerElem.style.background = "url('" + defaultBanner + "') no-repeat center center/cover";
    }
}

function displayCategories(list, parentName, targetCategory, path) {
    const container = document.querySelector(".products-inner-wrapper");
    if (!container) return;

    container.innerHTML = "";
    var isSubcategory = !!targetCategory;
    var section = document.querySelector('.catalog-category-page');
    if (section) section.classList.toggle('has-subcategories', isSubcategory);
    var content = document.querySelector('.category-content');
    if (content) content.classList.toggle('catalog-subcategories-page', isSubcategory);
    ['catalog-controls', 'catalog-pagination'].forEach(function (id) {
        var element = document.getElementById(id);
        if (element) element.hidden = !isSubcategory;
    });

    // Update Heading (located above breadcrumb inside inner-banner)
    const heading = document.querySelector(".product-heading");
    if (heading) heading.textContent = parentName;

    // Update Banner Image from backend or default
    updateCategoryBanner(targetCategory, path);

    // Update Breadcrumbs
    updateBreadcrumbs(parentName);

    // Update Dynamic SEO
    if (window.OrbiSEO) {
        if (targetCategory) {
            window.OrbiSEO.setCategorySEO(targetCategory, path);
        } else {
            window.OrbiSEO.setMeta({
                title: 'Our Products',
                description: 'Explore high-yield vegetable, fruit, and flower seed categories from Orbi Seeds International.',
                keywords: 'seed categories, vegetable seeds, fruit seeds, flower seeds, hybrid seeds, Orbi Seeds'
            });
        }
    }

    // Update Back Button
    const backBtnWrapper = document.getElementById('back-btn-wrapper');
    if (backBtnWrapper) {
        if (navigationHistory.length > 0) {
            backBtnWrapper.style.display = 'block';
            backBtnWrapper.innerHTML =
                '<a href="javascript:void(0)" class="view-product-btn back-btn">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
                '<span>Go Back</span>' +
                '</a>';
            backBtnWrapper.onclick = goBack;
        } else {
            backBtnWrapper.style.display = 'none';
        }
    }

    // Only subcategory pages use browsing controls; the root lists every main category.
    var categories = (list || []).slice();
    var state = isSubcategory && categoryBrowser ? categoryBrowser.sync() : null;
    categories.sort(function (a, b) { return compareCategories(a, b) * (state && state.sort === 'name_desc' ? -1 : 1); });
    if (state) {
        var total = categories.length;
        var pages = Math.max(1, Math.ceil(total / state.limit));
        if (state.page > pages) { categoryBrowser.write({ page: pages }, true); return; }
        categories = categories.slice((state.page - 1) * state.limit, state.page * state.limit);
        categoryBrowser.results({ total: total, page: state.page, totalPages: pages, limit: state.limit });
    }
    if (!categories.length) {
        var empty = document.createElement('div');
        empty.className = 'no-data'; empty.setAttribute('role', 'status');
        empty.textContent = 'No subcategories found.';
        container.appendChild(empty);
    }
    categories.forEach(function (category) {
        container.appendChild(createCategoryCard(category));
    });
    container.setAttribute('aria-busy', 'false');
}

function createCategoryCard(category) {
    var imageUrl = OrbiCatalog.imageUrl(category.image);
    const hasChildren = category.children && category.children.length > 0;

    const card = document.createElement('div');
    card.className = 'product-inner';
    card.style.cursor = 'pointer';

    var buttonText = hasChildren ? "View Sub-Categories" : "View Products";
    var linkUrl = (hasChildren ? 'product.html?cat=' : 'products.html?category=') + encodeURIComponent(category.slug);

    card.innerHTML =
        '<div class="product-image"><img src="' + OrbiCatalog.escape(imageUrl) + '" alt="' + OrbiCatalog.escape(category.name) + '" loading="lazy"></div>' +
        '<h3>' + OrbiCatalog.escape(category.name) + '</h3>' +
        '<a href="' + OrbiCatalog.escape(linkUrl) + '" class="view-product-btn">' + buttonText + '</a>';
    card.querySelector('img').addEventListener('error', function () {
        if (this.getAttribute('src') !== 'images/orbi-seeds-logo.png') this.src = 'images/orbi-seeds-logo.png';
    });

    card.onclick = function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button > 0) return;
        if (hasChildren) {
            e.preventDefault();
            navigateToSlug(category.slug);
        } else if (e.target.tagName !== 'A') {
            window.location.href = linkUrl;
        }
    };
    return card;
}

function updateBreadcrumbs(currentName) {
    const breadcrumb = document.querySelector(".breadcrumb");
    if (!breadcrumb) return;

    let html = '<li><a href="index.html">Home</a></li><li>/</li>';

    if (navigationHistory.length === 0) {
        html += '<li><span>Our Products</span></li>';
    } else {
        html += '<li><a href="javascript:void(0)" onclick="navigateToSlug(null)">Our Products</a></li>';

        // Skip index 0 as it's already added as "Our Products"
        for (let i = 1; i < navigationHistory.length; i++) {
            const item = navigationHistory[i];
            html += '<li>/</li>';
            html += '<li><a href="product.html?cat=' + encodeURIComponent(item.slug) + '">' + OrbiCatalog.escape(item.name) + '</a></li>';
        }

        if (currentName !== "Categories" && currentName !== "Our Products") {
            html += '<li>/</li>';
            html += '<li><span>' + OrbiCatalog.escape(currentName) + '</span></li>';
        }
    }
    breadcrumb.innerHTML = html;
}

function navigateToSlug(slug) {
    const url = new URL(window.location);
    if (slug) url.searchParams.set('cat', slug);
    else url.searchParams.delete('cat');
    ['q', 'browse', 'page'].forEach(function (key) { url.searchParams.delete(key); });
    window.history.pushState({}, '', url);
    handleUrlParams();
}

function resetToRoot(updateUrl = true) {
    if (updateUrl) {
        const url = new URL(window.location);
        url.searchParams.delete('cat');
        window.history.pushState({}, '', url);
    }
    navigationHistory = [];
    const rootCats = categoriesData.filter(c => c.parentId === null);
    displayCategories(rootCats, "Our Products", null, null);
}

function goBack() {
    if (navigationHistory.length > 0) {
        const previous = navigationHistory[navigationHistory.length - 1];
        navigateToSlug(previous.slug);
    }
}
