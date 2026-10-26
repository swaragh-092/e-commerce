document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const categorySlug = urlParams.get("category") || urlParams.get("cat");
    const productSlug = urlParams.get("slug");

    initBackButton();

    if (categorySlug) {
        updateCategoryUi(formatCategorySlug(categorySlug));
        updateCategoryBreadcrumbs(categorySlug, formatCategorySlug(categorySlug));
        fetchProducts(categorySlug, productSlug);
    } else if (productSlug) {
        OrbiCatalog.fetchProduct(productSlug).then(function (product) {
            renderProducts([product], document.querySelector(".products-content"), document.querySelector(".products-list"), productSlug, false);
            if (window.OrbiSEO) {
                window.OrbiSEO.setProductSEO(product);
            }

            const category = product.categories && product.categories[0];
            if (category) {
                updateCategoryUi(category.name);
                updateCategoryBreadcrumbs(category.slug, category.name);
            }
        }).catch(showProductError);
    }
});

let currentCategoryPath = null;

function updateBackButtonPath(path) {
    currentCategoryPath = path;
}

function handleGoBack(e) {
    if (e) e.preventDefault();

    // If user navigated from within the same domain (e.g. from product.html, wishlist.html)
    if (document.referrer && document.referrer.indexOf(window.location.host) !== -1 && window.history.length > 1) {
        window.history.back();
        return;
    }

    // Fallback: navigate to parent category in product.html
    if (currentCategoryPath && currentCategoryPath.length > 1) {
        const parent = currentCategoryPath[currentCategoryPath.length - 2];
        window.location.href = 'product.html?cat=' + encodeURIComponent(parent.slug);
    } else {
        window.location.href = 'product.html';
    }
}

function initBackButton() {
    const backBtnWrapper = document.getElementById('back-btn-wrapper');
    if (!backBtnWrapper) return;

    backBtnWrapper.style.display = 'block';
    backBtnWrapper.innerHTML =
        '<a href="javascript:void(0)" class="view-product-btn back-btn">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
        '<span>Go Back</span>' +
        '</a>';

    backBtnWrapper.onclick = handleGoBack;
}

const productsState = {
    categorySlug: null,
    page: 1,
    totalPages: 1,
    isLoading: false,
    sectionObserver: null,
    scrollObserver: null,
    eventsInitialized: false
};

function fetchProducts(categorySlug, requestedProductSlug, page) {
    page = page || 1;

    const productsContent = document.querySelector(".products-content");
    const productsList = document.querySelector(".products-list");

    if (!productsContent || !productsList) return;

    const isFirstPage = page === 1;

    productsState.categorySlug = categorySlug;
    productsState.isLoading = true;

    if (!isFirstPage) {
        toggleInfiniteLoader(productsContent, true);
    }

    fetch(API_URL + "products?category=" + encodeURIComponent(categorySlug) + "&include=attributes,variants&page=" + page)
        .then(OrbiCatalog.readResponse)
        .then(async function (result) {
            if (isFirstPage && requestedProductSlug && Array.isArray(result.data) && !result.data.some(function (p) { return p.slug === requestedProductSlug; })) {
                const linkedProduct = await OrbiCatalog.fetchProduct(requestedProductSlug);
                result.data.unshift(linkedProduct);
            }
            if (result.success && result.data && result.data.length > 0) {
                renderProducts(result.data, productsContent, productsList, isFirstPage ? requestedProductSlug : null, !isFirstPage);

                // Prefer the canonical API category name when it is available.
                if (isFirstPage && result.data[0].categories) {
                    const category = result.data[0].categories.find(c => c.slug === categorySlug);
                    if (category) {
                        updateCategoryUi(category.name);
                        updateCategoryBreadcrumbs(categorySlug, category.name);
                    }
                }

                const meta = result.meta || {};
                productsState.page = meta.page || page;
                productsState.totalPages = meta.totalPages || 1;
            } else if (isFirstPage) {
                renderEmptyState(productsContent, productsList);
                productsState.page = 1;
                productsState.totalPages = 1;
            }
        })
        .catch(function (error) {
            showProductError(error, function () { fetchProducts(categorySlug, requestedProductSlug, page); });
        })
        .finally(function () {
            productsState.isLoading = false;
            toggleInfiniteLoader(productsContent, false);
            setupInfiniteScroll(productsContent);
        });
}

function showProductError(error, retry) {
    const content = document.querySelector('.products-content');
    if (!content) return;
    let message = content.querySelector('.products-load-error');
    if (!message) { message = document.createElement('div'); message.className = 'products-load-error'; content.appendChild(message); }
    message.setAttribute('role', 'alert');
    message.textContent = 'Unable to load products. Please try again. ';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'view-product-btn'; button.textContent = 'Try again';
    button.onclick = function () { message.remove(); if (retry) retry(); else window.location.reload(); };
    message.appendChild(button);
}

function formatCategorySlug(slug) {
    return slug
        .split("-")
        .filter(Boolean)
        .map(function (word) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
}

function updateCategoryUi(categoryName) {
    const categoryTitle = document.querySelector(".ip-products-list p");
    const breadcrumbSpan = document.querySelector(".breadcrumb li span");
    const heading = document.querySelector(".inner-banner .product-heading");

    if (categoryTitle) categoryTitle.textContent = categoryName;
    if (breadcrumbSpan) breadcrumbSpan.textContent = categoryName;
    if (heading) heading.textContent = categoryName;
}

function updateCategoryBanner(path) {
    const bannerElem = document.getElementById("bg") || document.querySelector(".inner-page-banner-wrapper");
    if (!bannerElem) return;

    const defaultBanner = "images/inr-bnr.avif";
    let bannerRaw = null;

    if (path && path.length > 0) {
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

function findCategoryPath(categories, slug, currentPath) {
    currentPath = currentPath || [];
    if (!categories || !categories.length) return null;
    for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const newPath = currentPath.concat([cat]);
        if (cat.slug === slug) return newPath;
        if (cat.children && cat.children.length > 0) {
            const foundPath = findCategoryPath(cat.children, slug, newPath);
            if (foundPath) return foundPath;
        }
    }
    return null;
}

function renderBreadcrumbWithHierarchy(path, defaultName) {
    const breadcrumb = document.querySelector(".breadcrumb");
    if (!breadcrumb) return;

    let html = '<li><a href="index.html">Home</a></li><li>/</li><li><a href="product.html">Our Products</a></li>';

    const bannerHeading = document.querySelector(".inner-banner .product-heading");

    if (path && path.length > 0) {
        for (let i = 0; i < path.length - 1; i++) {
            html += '<li>/</li><li><a href="product.html?cat=' + encodeURIComponent(path[i].slug) + '">' + OrbiCatalog.escape(path[i].name) + '</a></li>';
        }
        const currentCategory = path[path.length - 1];
        html += '<li>/</li><li><span>' + OrbiCatalog.escape(currentCategory.name) + '</span></li>';

        const categoryTitle = document.querySelector(".ip-products-list p");
        if (categoryTitle) categoryTitle.textContent = currentCategory.name;
        if (bannerHeading) bannerHeading.textContent = currentCategory.name;
    } else {
        html += '<li>/</li><li><span>' + (defaultName || 'Products') + '</span></li>';
        const categoryTitle = document.querySelector(".ip-products-list p");
        if (categoryTitle) categoryTitle.textContent = defaultName || 'Products';
        if (bannerHeading) bannerHeading.textContent = defaultName || 'Our Products';
    }

    breadcrumb.innerHTML = html;
}

function updateCategoryBreadcrumbs(categorySlug, fallbackName) {
    if (!categorySlug) {
        renderBreadcrumbWithHierarchy(null, fallbackName);
        updateCategoryBanner(null);
        return;
    }

    let cached = null;
    try {
        const raw = sessionStorage.getItem('orbis_categories_data');
        if (raw) cached = JSON.parse(raw);
    } catch (e) {}

    if (cached && Array.isArray(cached)) {
        const path = findCategoryPath(cached, categorySlug);
        if (path) {
            renderBreadcrumbWithHierarchy(path, fallbackName);
            updateCategoryBanner(path);
            updateBackButtonPath(path);
            const currentCat = path[path.length - 1];
            if (window.OrbiSEO && currentCat && !new URLSearchParams(window.location.search).get("slug")) {
                window.OrbiSEO.setCategorySEO(currentCat, path);
            }
        }
    }

    fetch(API_URL + "categories")
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (res && res.success && res.data) {
                try {
                    sessionStorage.setItem('orbis_categories_data', JSON.stringify(res.data));
                } catch (e) {}
                const path = findCategoryPath(res.data, categorySlug);
                renderBreadcrumbWithHierarchy(path, fallbackName);
                updateCategoryBanner(path);
                updateBackButtonPath(path);
                const currentCat = path && path[path.length - 1];
                if (window.OrbiSEO && currentCat && !new URLSearchParams(window.location.search).get("slug")) {
                    window.OrbiSEO.setCategorySEO(currentCat, path);
                }
            }
        })
        .catch(function (err) {
            console.error("Error fetching categories for breadcrumb:", err);
            if (!cached) {
                renderBreadcrumbWithHierarchy(null, fallbackName);
                updateCategoryBanner(null);
            }
        });
}

function getProductUnit(product) {
    if (product && product.unit) return product.unit;
    if (!product || !product.attributes || !product.attributes.length) return '';
    var matchedAttribute = product.attributes.find(function(attr) {
        var name = (attr.customName || (attr.attribute ? attr.attribute.name : '') || '').trim().toLowerCase();
        return name === 'unit' || name === 'uom';
    });
    if (!matchedAttribute) return '';
    return matchedAttribute.customValue || (matchedAttribute.value ? matchedAttribute.value.value : '') || '';
}

function escapeAttributeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
}

function renderProductAttributes(attributes) {
    if (!Array.isArray(attributes) || !attributes.length) return '';

    const groups = new Map();
    attributes.map(function (attribute, index) {
        return { attribute: attribute, index: index };
    }).sort(function (first, second) {
        const firstOrder = Number(first.attribute.sortOrder) || 0;
        const secondOrder = Number(second.attribute.sortOrder) || 0;
        return firstOrder - secondOrder || first.index - second.index;
    }).forEach(function (entry) {
        const row = entry.attribute;
        const name = String(row.customName || (row.attribute && row.attribute.name) || '').trim();
        const value = row.customValue || (row.value && (row.value.displayLabel || row.value.value));
        let label = String(value || '').trim();
        if (!name || !label) return;

        const unit = String((row.value && row.value.unitLabel) || (row.attribute && row.attribute.unit) || '').trim();
        if (unit) {
            const unitStart = label.length - unit.length;
            const alreadyHasUnit = unitStart >= 0 && label.slice(unitStart).toLowerCase() === unit.toLowerCase()
                && (unitStart === 0 || /[\d\s]/.test(label.charAt(unitStart - 1)));
            if (!alreadyHasUnit) {
                label += (/^(g|kg|mg|mm|cm|m|in|ft|gb|tb|mb|kb|ml|l)$/i.test(unit) ? '' : ' ') + unit;
            }
        }

        const key = name.replace(/\s+/g, ' ').toLowerCase();
        if (!groups.has(key)) groups.set(key, { name: name, values: [], seen: new Set() });
        const group = groups.get(key);
        const valueKey = label.toLowerCase();
        if (!group.seen.has(valueKey)) {
            group.values.push(label);
            group.seen.add(valueKey);
        }
    });

    if (!groups.size) return '';
    return '<ul>' + Array.from(groups.values(), function (group) {
        return '<li><b>' + escapeAttributeHtml(group.name) + ':</b> '
            + escapeAttributeHtml(group.values.join(', ')) + '</li>';
    }).join('') + '</ul>';
}

function renderEmptyState(contentContainer, listContainer) {
    listContainer.innerHTML = "";
    contentContainer.innerHTML = '<div class="no-products-message"><p>No products available.</p></div>';
}

function renderProducts(products, contentContainer, listContainer, requestedProductSlug, append) {
    if (!append) {
        contentContainer.innerHTML = "";
        listContainer.innerHTML = "";
    }

    const startIndex = append ? listContainer.children.length : 0;

    products.forEach(function (product, i) {
        if (Array.from(contentContainer.querySelectorAll(".product-sec")).some(function (section) { return section.orbiProduct && section.orbiProduct.id === product.id; })) return;
        const index = startIndex + i;
        const productSlug = product.slug || ("section" + (index + 1));
        const sectionId = "product-" + productSlug;
        const categorySlug = product.categories && product.categories.length > 0 && product.categories[0].slug
            ? product.categories[0].slug
            : '';
        const productUnit = getProductUnit(product);

        // Sidebar link
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#" + sectionId;
        a.className = "coe-top" + (index === 0 ? " act" : "");
        a.textContent = product.name;
        li.appendChild(a);
        listContainer.appendChild(li);

        // Content section
        const productDiv = document.createElement("div");
        productDiv.className = "ip-product-details product-sec";
        productDiv.id = sectionId;
        productDiv.setAttribute('data-product-slug', productSlug);

        const finalImageUrl = OrbiCatalog.line(product).image;

        const attributesHtml = renderProductAttributes(product.attributes);

        const esc = OrbiCatalog.escape;
        const metadata = ' data-id="' + esc(product.id) + '" data-name="' + esc(product.name) + '" data-image="' + esc(finalImageUrl) + '" data-slug="' + esc(productSlug) + '" data-category="' + esc(categorySlug) + '" data-unit="' + esc(productUnit) + '"';
        productDiv.innerHTML =
            '<div class="products">' +
                '<div class="products-left"><img src="' + esc(finalImageUrl) + '" alt="' + esc(product.name) + '" loading="lazy"></div>' +
                '<div class="products-right">' +
                    '<button type="button" class="wishlist-heart-btn"' + metadata + ' aria-label="Add to wishlist" aria-pressed="false" title="Add to wishlist">&#9825;</button>' +
                    '<h3>' + esc(product.name) + '</h3>' + attributesHtml +
                    (product.description ? '<div class="product-description">' + OrbiCatalog.description(product.description) + '</div>' : '') +
                    (product.shortDescription ? '<h4>Remarks</h4><p>' + esc(product.shortDescription) + '</p>' : '') +
                    '<div class="product-options"></div><p class="product-selection-status" role="status"></p><p class="product-selected-price"></p>' +
                    '<div class="product-enquiry-actions"><button type="button" class="view-product-btn open-enquiry-popup"' + metadata + '>Enquiry Now</button>' +
                    '<button type="button" class="view-product-btn add-enquiry-list"' + metadata + '>Add to Enquiry List</button></div>' +
                '</div>' +
            '</div>';
        productDiv.querySelector('img').addEventListener('error', function () {
            if (this.getAttribute('src') !== 'images/default-image.png') this.src = 'images/default-image.png';
        });
        const params = new URLSearchParams(window.location.search);
        OrbiCatalog.mountOptions(productDiv, product, params.get('slug') === product.slug ? params.get('variant') : null);

        $(productDiv).data('product', product);
        contentContainer.appendChild(productDiv);
    });

    if (!append && products && products.length > 0) {
        var activeProd = null;
        if (requestedProductSlug) {
            activeProd = products.find(function(p) { return (p.slug || String(p.id)) === requestedProductSlug; });
        }
        if (!activeProd && !productsState.categorySlug) {
            activeProd = products[0];
        }
        if (activeProd && window.OrbiSEO) {
            window.OrbiSEO.setProductSEO(activeProd);
        }
    }

    // Re-initialize smooth scroll and observer after dynamic content is added
    initDynamicEvents();
    if (window.syncWishlistHearts) {
        window.syncWishlistHearts();
    }
    if (!append) {
        scrollToProductSlug(requestedProductSlug);
    }
}

function scrollToProductSlug(productSlug) {
    if (!productSlug) return;
    var target = null;
    document.querySelectorAll('.ip-product-details').forEach(function(section) {
        if (!target && section.getAttribute('data-product-slug') === productSlug) target = section;
    });
    if (!target) return;
    var offset = 85;
    var elementPosition = target.getBoundingClientRect().top;
    var offsetPosition = elementPosition + window.pageYOffset - offset;
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    var link = document.querySelector('.products-list a[href="#' + target.id + '"]');
    if (link) {
        document.querySelectorAll('.products-list .coe-top').forEach(function(item) { item.classList.remove('act'); });
        link.classList.add('act');
    }
}

function toggleInfiniteLoader(contentContainer, show) {
    let loader = document.getElementById("products-infinite-loader");
    if (show) {
        if (!loader) {
            loader = document.createElement("div");
            loader.id = "products-infinite-loader";
            loader.className = "products-infinite-loader";
            loader.innerHTML = '<span class="products-loading-spinner"></span>';
            contentContainer.appendChild(loader);
        }
    } else if (loader) {
        loader.remove();
    }
}

function setupInfiniteScroll(contentContainer) {
    let sentinel = document.getElementById("products-infinite-sentinel");

    // No more pages left to load - clean up and stop observing.
    if (productsState.page >= productsState.totalPages) {
        if (sentinel) sentinel.remove();
        if (productsState.scrollObserver) {
            productsState.scrollObserver.disconnect();
        }
        return;
    }

    if (!sentinel) {
        sentinel = document.createElement("div");
        sentinel.id = "products-infinite-sentinel";
        contentContainer.appendChild(sentinel);
    } else {
        contentContainer.appendChild(sentinel); // keep it as the last element
    }

    if (!productsState.scrollObserver) {
        productsState.scrollObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !productsState.isLoading && productsState.page < productsState.totalPages) {
                    fetchProducts(productsState.categorySlug, null, productsState.page + 1);
                }
            });
        }, { rootMargin: "300px" });
    }

    productsState.scrollObserver.observe(sentinel);
}

function initDynamicEvents() {
    // Bind delegated handlers once so repeated renders (infinite scroll pages)
    // don't stack duplicate listeners on the same elements.
    if (!productsState.eventsInitialized) {
        productsState.eventsInitialized = true;

        $(document).on('click', '.products-list a[href^="#"]', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const offset = 85;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });

        $(document).on('click', '.coe-top', function () {
            $(".coe-top").removeClass('act');
            $(this).addClass('act');
        });
    }

    // Re-setup Intersection Observer so newly added sections are included
    if (productsState.sectionObserver) {
        productsState.sectionObserver.disconnect();
    }

    const sections = document.querySelectorAll('.ip-product-details');
    const links = document.querySelectorAll('.products-list .coe-top');

    productsState.sectionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                links.forEach(link => link.classList.remove('act'));
                const link = document.querySelector(`a[href="#${entry.target.id}"]`);
                if (link) {
                    link.classList.add('act');
                }
                const prod = $(entry.target).data('product');
                if (prod && window.OrbiSEO) {
                    window.OrbiSEO.setProductSEO(prod);
                }
            }
        });
    }, {
        threshold: 0.6
    });

    sections.forEach(section => {
        productsState.sectionObserver.observe(section);
    });

}
