var categoriesData = [];
var navigationHistory = [];
var currentList = [];
var currentParentName = "Categories";
var categoryBrowser = null;
var categoriesLoaded = false;
var categoriesLoading = false;

document.addEventListener("DOMContentLoaded", function () {
    categoryBrowser = window.OrbiBrowser && OrbiBrowser.create({
        label: 'Categories', placeholder: 'Search categories and sub-categories', sizes: [12, 24, 48],
        filters: [{ name: 'browse', label: 'Show', options: [
            { value: '', label: 'All categories' },
            { value: 'branches', label: 'Category groups' },
            { value: 'leaves', label: 'Product categories' }
        ] }],
        sorts: [{ value: 'name_asc', label: 'Name: A–Z' }, { value: 'name_desc', label: 'Name: Z–A' }],
        onChange: function () {
            if (categoriesLoaded) handleUrlParams();
            else fetchCategories();
        }
    });
    fetchCategories();
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', function(event) {
        if (!categoryBrowser && categoriesData.length > 0) {
            handleUrlParams();
        }
    });
});

function fetchCategories() {
    const container = document.querySelector(".products-inner-wrapper");
    if (!container || categoriesLoading) return;
    categoriesLoading = true;

    container.innerHTML = '<div class="loading">Loading categories...</div>';
    container.setAttribute('aria-busy', 'true');
    if (categoryBrowser) categoryBrowser.setBusy(true);

    fetch(API_URL + "categories")
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
            if (categoryBrowser) categoryBrowser.setStatus('Categories could not be loaded. Please try again.');
        }).finally(function () {
            categoriesLoading = false;
            container.setAttribute('aria-busy', 'false');
            if (categoryBrowser) categoryBrowser.setBusy(false);
        });
}

function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const categorySlug = urlParams.get("cat");
    
    navigationHistory = [];
    
    if (categorySlug) {
        const path = findCategoryPath(categoriesData, categorySlug);
        if (path && path.length > 0) {
            // Reconstruct navigationHistory
            // The history should contain the states lead up to the current level
            // Root level
            navigationHistory.push({
                list: categoriesData.filter(c => c.parentId === null),
                name: "Categories",
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
            
            const targetCategory = path[path.length - 1];
            displayCategories(targetCategory.children, targetCategory.name, targetCategory, path);
        } else {
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
    currentList = list || [];
    currentParentName = parentName;

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
                title: 'Categories',
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
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
                '<span>Go Back</span>' +
                '</a>';
            backBtnWrapper.onclick = goBack;
        } else {
            backBtnWrapper.style.display = 'none';
        }
    }

    // The category tree is returned in full, so filter before slicing the page.
    var state = categoryBrowser ? categoryBrowser.sync() : { q: '', browse: '', sort: 'name_asc', page: 1, limit: 12 };
    var candidates = [];
    function collect(items) {
        items.forEach(function (category) {
            candidates.push(category);
            if (state.q && category.children) collect(category.children);
        });
    }
    collect(currentList);
    var query = state.q.toLocaleLowerCase();
    var filtered = candidates.filter(function (category) {
        var matches = !query || (String(category.name || '') + ' ' + String(category.slug || '')).toLocaleLowerCase().includes(query);
        var hasChildren = category.children && category.children.length > 0;
        return matches && (!state.browse || (state.browse === 'branches' ? hasChildren : !hasChildren));
    }).sort(function (a, b) {
        var order = String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }) || String(a.slug).localeCompare(String(b.slug));
        return state.sort === 'name_desc' ? -order : order;
    });
    var totalPages = Math.max(1, Math.ceil(filtered.length / state.limit));
    var page = Math.min(state.page, totalPages);
    if (page !== state.page) {
        var corrected = new URL(window.location.href);
        if (page === 1) corrected.searchParams.delete('page'); else corrected.searchParams.set('page', page);
        window.history.replaceState({}, '', corrected);
        if (categoryBrowser) categoryBrowser.sync();
    }
    if (categoryBrowser) {
        categoryBrowser.setBusy(false);
        categoryBrowser.results({ total: filtered.length, page: page, totalPages: totalPages, limit: state.limit });
    }
    if (!filtered.length) {
        container.innerHTML = '<div class="no-data" role="status">' + (state.q || state.browse ? 'No categories match your search or filters. Try another search or clear the filters.' : 'No sub-categories found.') + '</div>';
    }
    filtered.slice((page - 1) * state.limit, page * state.limit).forEach(function (category) {
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
    
    var buttonText = hasChildren ? "View Sub-categories" : "View Products";
    var linkUrl = (hasChildren ? 'product.html?cat=' : 'products.html?category=') + encodeURIComponent(category.slug);

    card.innerHTML = 
        '<div class="product-image"><img src="' + OrbiCatalog.escape(imageUrl) + '" alt="' + OrbiCatalog.escape(category.name) + '" loading="lazy"></div>' +
        '<h3>' + OrbiCatalog.escape(category.name) + '</h3>' +
        '<a href="' + OrbiCatalog.escape(linkUrl) + '" class="view-product-btn">' + buttonText + '</a>';
    card.querySelector('img').addEventListener('error', function () {
        if (this.getAttribute('src') !== 'images/default-image.png') this.src = 'images/default-image.png';
    });

    card.onclick = function(e) {
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
        html += '<li><span>Categories</span></li>';
    } else {
        html += '<li><a href="javascript:void(0)" onclick="navigateToSlug(null)">Categories</a></li>';
        
        // Skip index 0 as it's already added as "Categories"
        for (let i = 1; i < navigationHistory.length; i++) {
            const item = navigationHistory[i];
            html += '<li>/</li>';
            html += '<li><a href="product.html?cat=' + encodeURIComponent(item.slug) + '">' + OrbiCatalog.escape(item.name) + '</a></li>';
        }

        if (currentName !== "Categories") {
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
    displayCategories(rootCats, "Categories", null, null);
}

function goBack() {
    if (navigationHistory.length > 0) {
        const previous = navigationHistory[navigationHistory.length - 1];
        navigateToSlug(previous.slug);
    }
}
