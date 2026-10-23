var categoriesData = [];
var navigationHistory = [];
var currentList = [];
var currentParentName = "Categories";

document.addEventListener("DOMContentLoaded", function () {
    fetchCategories();
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', function(event) {
        if (categoriesData.length > 0) {
            handleUrlParams();
        }
    });
});

function fetchCategories() {
    const container = document.querySelector(".products-inner-wrapper");
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading categories...</div>';

    fetch(API_URL + "categories")
        .then(function (response) {
            return response.json();
        })
        .then(function (result) {
            if (result.success && result.data && result.data.length > 0) {
                categoriesData = result.data;
                handleUrlParams();
            } else {
                container.innerHTML = '<div class="no-data">No categories found.</div>';
            }
        })
        .catch(function (error) {
            console.error("Error fetching categories:", error);
            container.innerHTML = '<div class="error">Error loading categories.</div>';
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
    currentList = list;
    currentParentName = parentName;

    // Update Heading (located above breadcrumb inside inner-banner)
    const heading = document.querySelector(".product-heading");
    if (heading) heading.textContent = parentName;

    // Update Banner Image from backend or default
    updateCategoryBanner(targetCategory, path);

    // Update Breadcrumbs
    updateBreadcrumbs(parentName);

    // Update Back Button
    const backBtnWrapper = document.getElementById('back-btn-wrapper');
    if (backBtnWrapper) {
        if (navigationHistory.length > 0) {
            backBtnWrapper.style.display = 'block';
            backBtnWrapper.style.marginBottom = '20px';
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

    // Render Cards
    if (list.length === 0) {
        container.innerHTML = '<div class="no-data">No sub-categories found.</div>';
        return;
    }

    list.forEach(function (category) {
        container.appendChild(createCategoryCard(category));
    });

    // Scroll to top
    const section = document.querySelector(".products-main-wrapper");
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function createCategoryCard(category) {
    var imageUrl = category.image ? APP_URL + category.image : "./images/products/default.jpg";
    const hasChildren = category.children && category.children.length > 0;
    
    const card = document.createElement('div');
    card.className = 'product-inner';
    card.style.cursor = 'pointer';
    
    var buttonText = hasChildren ? "View Sub-categories" : "View Products";
    var linkUrl = hasChildren ? "javascript:void(0)" : "products.html?category=" + category.slug;

    card.innerHTML = 
        '<div class="product-image"><img src="' + imageUrl + '" alt="' + category.name + '"></div>' +
        '<h3>' + category.name + '</h3>' +
        '<a href="' + linkUrl + '" class="view-product-btn">' + buttonText + '</a>';

    card.onclick = function(e) {
        if (hasChildren) {
            e.preventDefault();
            const url = new URL(window.location);
            url.searchParams.set('cat', category.slug);
            window.history.pushState({}, '', url);
            handleUrlParams();
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
            html += '<li><a href="javascript:void(0)" onclick="navigateToSlug(\'' + item.slug + '\')">' + item.name + '</a></li>';
        }

        if (currentName !== "Categories") {
            html += '<li>/</li>';
            html += '<li><span>' + currentName + '</span></li>';
        }
    }
    breadcrumb.innerHTML = html;
}

function navigateToSlug(slug) {
    const url = new URL(window.location);
    if (slug) url.searchParams.set('cat', slug);
    else url.searchParams.delete('cat');
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
