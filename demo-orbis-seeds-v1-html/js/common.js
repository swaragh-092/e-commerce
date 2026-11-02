document.getElementById("current-year").textContent = new Date().getFullYear();

function getAbsoluteFile() {
    var page = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);
    page = page.replace(/\.shtml$/, '').replace(/\.html$/, '').trim();
    return page;
}

function setActiveLinks() {
    $('.act-link').removeClass('act-link');

    var currentLoc = window.location;
    var pathOnly = currentLoc.pathname.replace(/\.shtml$/, '').replace(/\.html$/, '');
    var isHome = pathOnly === '/' || pathOnly.endsWith('/index') || pathOnly.endsWith('/');

    // Home page
    if (isHome) {
        $('.home-link, .resp-home, .footer-home').addClass("act-link");
        return;
    }

    var currentPath = pathOnly.toLowerCase();
    var currentParams = new URLSearchParams(currentLoc.search);
    var currentCat = (currentParams.get('category') || currentParams.get('cat') || '').toLowerCase();

    // Select all links in header navigation, dropdowns, megamenu, mobile menu, and footer
    var $navLinks = $('.nav-links a, .mobile-menu-content a, .footer-active-links ul li a, footer .columns-sec li a');

    var $activeNavLinks = $navLinks.filter(function () {
        // Catalog previews use hover/focus states; the top-level link marks the current section.
        if ($(this).closest('.mega-menu-catalog, .mobile-catalog-menu .submenu').length) return false;
        var linkHrefAttr = $(this).attr('href');
        if (!linkHrefAttr || linkHrefAttr === '#' || linkHrefAttr === 'javascript:;') return false;

        var linkLoc;
        try {
            linkLoc = new URL(this.href);
        } catch (e) {
            return false;
        }

        var linkPath = linkLoc.pathname.replace(/\.shtml$/, '').replace(/\.html$/, '').toLowerCase();
        var linkParams = new URLSearchParams(linkLoc.search);
        var linkCat = (linkParams.get('category') || linkParams.get('cat') || '').toLowerCase();

        // 1. Exact match (pathname and entire query string)
        if (linkPath === currentPath && linkLoc.search === currentLoc.search) {
            return true;
        }

        // 2. Category match (e.g. ?category=tomato-1 or ?cat=vegetables)
        if (currentCat && linkCat && currentCat === linkCat) {
            if (currentPath.indexOf('/product') !== -1 && linkPath.indexOf('/product') !== -1) {
                return true;
            }
            if (linkPath === currentPath) {
                return true;
            }
        }

        // 3. Path match when neither link nor current page has search params
        if (!linkLoc.search && !currentLoc.search && linkPath === currentPath) {
            return true;
        }

        return false;
    });

    $activeNavLinks.each(function () {
        var $this = $(this);
        $this.addClass('act-link');

        // For desktop
        $this.closest('li').addClass('act-link');

        // If inside a mega-menu column
        var $col = $this.closest('.mega-menu-column');
        if ($col.length) {
            $col.addClass('act-link');
            $col.find('.mega-menu-column-title').addClass('act-link');
        }

        // Highlight parent dropdown / megamenu <li> and its top-level <a>
        $this.parents('li.dropdown-wrapper-li, li.megamenu-wrapper-li').each(function () {
            $(this).addClass('act-link');
            $(this).children('a').addClass('act-link');
        });

        // For mobile
        if ($this.closest('.mobile-menu-container').length > 0) {
            $this.closest('li').addClass('act-link');
            $this.parents('li.has-submenu').each(function () {
                $(this).children('.menu-item-row').find('a').addClass('act-link');
                $(this).addClass('act-link');
            });
        }
    });

    // Fallback: If on products page and top-level link isn't already active, highlight "Our Products"
    if (currentPath.indexOf('/product') !== -1 || currentCat) {
        var $ourProducts = $('.nav-links > li > a, .mobile-menu-content > ul > li > a, .mobile-menu-content > ul > li > .menu-item-row > a').filter(function () {
            var text = $(this).text().trim().toLowerCase();
            return text === 'our products' || text === 'products';
        });

        $ourProducts.addClass('act-link');
        $ourProducts.closest('li').addClass('act-link');
        $ourProducts.parents('li.has-submenu').addClass('act-link');
    }
}
window.setActiveLinks = setActiveLinks;

function formatMenuUrl(url) {
    if (!url || url === "#") return "javascript:;";

    var formattedUrl = url;

    try {
        if (url.indexOf('http') === 0) {
            var urlObj = new URL(url);
            var path = urlObj.pathname;
            var parts = path.split('/');
            var lastPart = parts[parts.length - 1];
            if (lastPart) {
                formattedUrl = lastPart + urlObj.search + urlObj.hash;
            }
        } else if (url.indexOf('/') === 0) {
            var parts = url.split('?');
            var pathParts = parts[0].split('/');
            var lastPart = pathParts[pathParts.length - 1] || '';
            if (parts.length > 1) {
                formattedUrl = lastPart + '?' + parts[1];
            } else {
                formattedUrl = lastPart;
            }
        }
    } catch (e) { }

    if (formattedUrl && formattedUrl !== "javascript:;" && formattedUrl !== "#" && formattedUrl !== "/") {
        var queryParts = formattedUrl.split('?');
        var basePart = queryParts[0];
        var suffix = queryParts.length > 1 ? '?' + queryParts[1] : '';

        var hashParts = basePart.split('#');
        basePart = hashParts[0];
        var hashSuffix = hashParts.length > 1 ? '#' + hashParts[1] : '';

        if (basePart && basePart.indexOf('.') === -1) {
            basePart += ".html";
        } else if (basePart.endsWith('.shtml')) {
            basePart = basePart.replace(/\.shtml$/, '.html');
        }

        formattedUrl = basePart + hashSuffix + suffix;
    }

    return formattedUrl;
}
function isCatalogMenu(item) {
    return item.targetType === 'category_tree' || String(item.label || '').toLowerCase().indexOf('product') !== -1;
}

function getMenuItemUrl(item) {
    if (item.targetType === 'category_tree') return 'product.html';
    var url = formatMenuUrl(item.url);
    // Parent categories open the category browser; leaves keep their product listing.
    if (hasMenuChildren(item) && /^products?\.html\?/.test(url)) {
        var params = new URL(url, window.location.href).searchParams;
        var slug = params.get('category') || params.get('cat');
        if (slug) return 'product.html?cat=' + encodeURIComponent(slug);
    }
    return url;
}

function escapeMenuText(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
}

var menuDataCacheKey = 'orbis_menu_data_v1';

// The public menu API already applies each parent's configured childDisplayLimit.
// Keep its order and batch intact, including when Menu Builder selects Show all.
function visibleMenuItems(items) {
    return (items || []).filter(function (item) { return item.isVisible !== false; });
}

function hasMenuChildren(item) {
    return visibleMenuItems(item.children).length > 0 || !!(item.childrenPagination && item.childrenPagination.hasMore);
}

function menuChildrenAttributes(item, view, catalogDepth) {
    return ' data-menu-children="' + escapeMenuText(item.id) + '" data-menu-view="' + view + '"' +
        (catalogDepth == null ? '' : ' data-menu-catalog-depth="' + catalogDepth + '"');
}

function menuLink(item, className) {
    return '<a href="' + escapeMenuText(getMenuItemUrl(item)) + '" data-menu-link="' + escapeMenuText(item.id) + '"' +
        (className ? ' class="' + className + '"' : '') +
        (item.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + escapeMenuText(item.label) + '</a>';
}

function buildMenuMoreLink(item) {
    if (!item.childrenPagination || !item.childrenPagination.hasMore) return '';
    var url = getMenuItemUrl(item);
    if (url === 'javascript:;') return '';
    return '<a href="' + escapeMenuText(url) + '" class="menu-children-more" aria-label="More ' + escapeMenuText(item.label) + '"' +
        (item.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '') + '>More &rarr;</a>';
}

function buildDesktopMegaMenuContent(item) {
    var compact = isCatalogMenu(item);
    var html = '<div class="mega-menu-columns">';
    visibleMenuItems(item.children).forEach(function (child) {
        html += '<div class="mega-menu-column">';
        html += menuLink(child, 'mega-menu-column-title');
        if (hasMenuChildren(child)) {
            html += '<ul class="mega-menu-list"' + menuChildrenAttributes(child, compact ? 'catalog' : 'desktop') + '>';
            html += (compact ? buildDesktopCatalogItems(child.children, child) : buildDesktopMenuSub(child.children, child)) + '</ul>';
        }
        html += '</div>';
    });
    html += '</div>';
    if (item.childrenPagination && item.childrenPagination.hasMore) {
        html += '<div class="mega-menu-footer">' + buildMenuMoreLink(item) + '</div>';
    }
    return html;
}

function buildDesktopMegaMenu(item) {
    return '<div class="mega-menu-wrapper' + (isCatalogMenu(item) ? ' mega-menu-catalog' : '') + '"><div class="mega-menu-container"' +
        menuChildrenAttributes(item, 'mega') + '>' + buildDesktopMegaMenuContent(item) + '</div></div>';
}

// Catalog navigation stops at the category links; deeper levels open on the category page.
function buildDesktopCatalogItems(items, parent) {
    var html = visibleMenuItems(items).map(function (item) { return '<li>' + menuLink(item) + '</li>'; }).join('');
    if (parent.childrenPagination && parent.childrenPagination.hasMore) {
        html += '<li class="mega-menu-more">' + buildMenuMoreLink(parent) + '</li>';
    }
    return html;
}

function buildDesktopMenuSub(items, parent) {
    var html = '';
    visibleMenuItems(items).forEach(function (item) {
        if (hasMenuChildren(item)) {
            html += '<li class="dropdown-wrapper-li">' + menuLink(item);
            html += '<div class="dropdown-wrapper"><ul' + menuChildrenAttributes(item, 'desktop') + '>';
            html += buildDesktopMenuSub(item.children, item) + '</ul></div></li>';
        } else {
            html += '<li>' + menuLink(item) + '</li>';
        }
    });
    if (parent && parent.childrenPagination && parent.childrenPagination.hasMore) {
        html += '<li class="mega-menu-more">' + buildMenuMoreLink(parent) + '</li>';
    }
    return html;
}

function buildMobileMenuSub(items, parentLabel, parent, catalogDepth) {
    if (catalogDepth == null && parent && isCatalogMenu(parent)) catalogDepth = 1;
    var html = '<li class="back-item"><a href="javascript:;" class="back-button"><span class="back-icon"><img src="images/icons/back.png" alt="Back"></span> ' + escapeMenuText(parentLabel || 'Back') + '</a></li>';
    visibleMenuItems(items).forEach(function (item) { html += buildMobileMenuItem(item, catalogDepth); });
    if (parent && parent.childrenPagination && parent.childrenPagination.hasMore) {
        html += '<li class="menu-more-row">' + buildMenuMoreLink(parent) + '</li>';
    }
    return html;
}

function buildMobileMenuItem(item, catalogDepth) {
    if (catalogDepth == null && isCatalogMenu(item)) catalogDepth = 0;
    var hasChildren = hasMenuChildren(item) && (catalogDepth == null || catalogDepth < 2);
    var html = '<li' + (hasChildren ? ' class="has-submenu' + (isCatalogMenu(item) ? ' mobile-catalog-menu' : '') + '"' : '') + '>';
    if (hasChildren) {
        html += '<div class="menu-item-row">' + menuLink(item);
        html += '<span class="submenu-toggle"><img src="images/icons/next.png" alt=">"></span></div>';
        var childDepth = catalogDepth == null ? null : catalogDepth + 1;
        html += '<ul class="submenu"' + menuChildrenAttributes(item, 'mobile', childDepth) + '>';
        html += buildMobileMenuSub(item.children, item.label, item, childDepth) + '</ul>';
    } else {
        html += menuLink(item);
    }
    return html + '</li>';
}

function ensureMobileMenu() {
    if ($('.mobile-menu-container').length === 0) {
        $('body').append(
            '<div class="mobile-menu-overlay"></div>' +
            '<div class="mobile-menu-container">' +
            '<div class="mobile-menu-header">' +
            '<img src="images/orbi-seeds-logo.jpg" alt="Logo">' +
            '<div class="mobile-menu-close">&times;</div></div>' +
            '<div class="mobile-menu-content"></div></div>'
        );
    }
}

function renderMenu(menu) {
    var desktopHtml = '';
    var mobileHtml = '<ul><li><a href="index.html" class="resp-home">Home</a></li>';
    visibleMenuItems(menu.items).forEach(function (item) {
        if (hasMenuChildren(item)) {
            var isMega = isCatalogMenu(item) || visibleMenuItems(item.children).some(hasMenuChildren);
            if (isMega) {
                desktopHtml += '<li class="megamenu-wrapper-li">' + menuLink(item) + buildDesktopMegaMenu(item) + '</li>';
            } else {
                desktopHtml += '<li class="dropdown-wrapper-li">' + menuLink(item);
                desktopHtml += '<div class="dropdown-wrapper last"><ul' + menuChildrenAttributes(item, 'desktop') + '>';
                desktopHtml += buildDesktopMenuSub(item.children, item) + '</ul></div></li>';
            }
        } else {
            desktopHtml += '<li class="dropdown-wrapper-li">' + menuLink(item) + '</li>';
        }
        mobileHtml += buildMobileMenuItem(item);
    });
    mobileHtml += '</ul>';
    if ($('.nav-links').html() !== desktopHtml) $('.nav-links').html(desktopHtml);
    ensureMobileMenu();
    if ($('.mobile-menu-content').html() !== mobileHtml) $('.mobile-menu-content').html(mobileHtml);
}

function readMenuResponse(response) {
    if (!response.ok) throw new Error('Menu request failed (' + response.status + ')');
    return response.json().then(function (result) {
        if (!result.success) throw new Error(result.message || 'Menu request failed');
        return result;
    });
}

function fetchAndRenderMenu() {
    return fetch(API_URL + 'menus/slug/public/orbis-menu')
        .then(readMenuResponse)
        .then(function (result) {
            var menu = result.data || { items: [] };
            if (!Array.isArray(menu.items)) throw new Error('Invalid public menu response');
            // Cache the initial API batch, never the old frontend-truncated HTML or expanded pages.
            try { localStorage.setItem(menuDataCacheKey, JSON.stringify(menu)); } catch (e) { }
            renderMenu(menu);
        })
        .catch(function (error) { console.error('Error fetching menu:', error); })
        .finally(function () {
            setActiveLinks();
            if (typeof window.initMobileMenu === 'function') window.initMobileMenu();
        });
}

function applyCachedMenu() {
    try {
        var cached = JSON.parse(localStorage.getItem(menuDataCacheKey));
        if (cached && Array.isArray(cached.items)) {
            renderMenu(cached);
            setActiveLinks();
        }
    } catch (e) { }
}

// Immediately apply cached header to eliminate delay and flickering.
if (typeof $ !== 'undefined' && $('.nav-links').length > 0) applyCachedMenu();

$(document).ready(function () {
    applyCachedMenu();
    fetchAndRenderMenu();
});
// active links code



// Mobile Menu Toggle logic
function positionMobileSubmenus() {
    $('.mobile-menu-content .submenu.active').each(function () {
        var $submenu = $(this);
        var $parent = $submenu.parent().closest('.submenu, .mobile-menu-content');
        $submenu.css('top', ($parent.scrollTop() || 0) + 'px');
    });
}

$(document).on('click', '.hc-nav-trigger, .toggle', function (e) {
    e.preventDefault();
    $('.mobile-menu-container').addClass('open');
    $('.mobile-menu-overlay').fadeIn();
    $('body').addClass('menu-open');
});

$(document).on('click', '.mobile-menu-close, .mobile-menu-overlay', function () {
    $('.mobile-menu-container').removeClass('open');
    $('.mobile-menu-overlay').fadeOut();
    $('body').removeClass('menu-open');
    $('.mobile-menu-content .submenu').removeClass('active').scrollTop(0).css('top', '');
    $('.mobile-menu-content').scrollTop(0);
});

$(document).on('click', '.submenu-toggle', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var $submenu = $(this).closest('li').children('.submenu');
    $submenu.scrollTop(0).addClass('active');
    positionMobileSubmenus();
});

$(window).on('resize', function () {
    if (window.innerWidth > 1200 && $('.mobile-menu-container').hasClass('open')) $('.mobile-menu-close').click();
    else positionMobileSubmenus();
});

$(document).on('click', '.back-button', function (e) {
    e.preventDefault();
    e.stopPropagation();
    $(this).closest('.submenu').removeClass('active').css('top', '');
});

$(document).on('click', '.mobile-menu-content a:not([href="javascript:;"]):not(.back-button)', function () {
    $('.mobile-menu-close').click();
});


// Form
function validationCont() {
    //1. Name
    var x = document.forms['valid_cont']['textName'];
    var y = x.value;
    if (y == "") {
        alert('Please Enter Your Name....');
        x.focus();
        return false;
    }
    var reg = /^[ a-zA-Z]*$/;
    /* var reg=/^[ a-zA-Z. ]*$/; */
    if (reg.test(y) == false) {
        alert('Invalid Name! Please Enter only Alphabets....');
        x.focus();
        return false;
    }
    //1.  Name

    //  mail
    var x = document.forms['valid_cont']['textEmail'];
    var y = x.value;
    if (y == "") {
        alert('Invalid Email Address.....');
        x.focus();
        return false;
    } else {
        var reg = /^[A-Za-z]+[A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (reg.test(y) == false) {
            alert('Invalid Email Address....');
            x.focus();
            return false;
        }
    }
    // mail

    //  phone number
    var x = document.forms['valid_cont']['textPhone'];
    var y = x.value;
    if (y == "") {
        alert("Please Enter Your Phone Number...");
        x.focus();
        return false;
    } else if (y.match(/[^\d+]/)) {
        alert('Please Enter Only Numbers/Correct Contact Number....');
        x.focus();
        return false;
    }
    if (y.length < 10) {
        alert("Please Enter atleast 10-15 digit Contact Number....");
        return false;
    } else if (y < 1 || y.match(/\s/) || y.match(/\+/)) {
        alert('Invalid Contact Number !  Please Enter Your Correct Contact Number.... !');
        x.focus();
        return false
    }

    // message
    var x = document.forms['valid_cont']['message'];
    var y = x.value;
    if (y == "") {
        alert('Please Enter Your Requirement...');
        x.focus();
        return false;
    }

    alert("Thank you for Submission. Will get back to You..!");
    return true;
}

// Form

/**
 * Dynamic SEO & Metadata Manager for Orbi Seeds
 */
(function (window) {
    'use strict';
    if (window.OrbiSEO) return;

    var OrbiSEO = {
        toAbsoluteUrl: function (url) {
            if (!url || typeof url !== 'string' || !url.trim()) return '';
            url = url.trim();
            if (/^https?:\/\//i.test(url)) return url;
            var base = (typeof APP_URL !== 'undefined' ? APP_URL : 'https://eshopadmin.swaragh.org.in/').replace(/\/+$/, '');
            if (url.charAt(0) === '/') return base + url;
            return base + '/' + url;
        },

        stripHtml: function (html) {
            if (!html) return '';
            var tmp = document.createElement('div');
            tmp.innerHTML = html;
            return (tmp.textContent || tmp.innerText || '').trim();
        },

        getOrCreateMeta: function (attrName, attrValue) {
            var selector = 'meta[' + attrName + '="' + attrValue + '"]';
            var el = document.querySelector(selector);
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute(attrName, attrValue);
                document.head.appendChild(el);
            }
            return el;
        },

        setMeta: function (options) {
            options = options || {};
            var title = options.title || options.metaTitle || 'Orbi Seeds International';
            var description = options.description || options.metaDescription || '';
            var keywords = options.keywords || options.metaKeywords || '';
            var image = options.image || options.ogImage || '';
            var url = options.url || window.location.href;
            var type = options.type || 'website';
            var schema = options.schema || null;

            // 1. Title Tag
            if (title) {
                var cleanTitle = title.trim();
                if (!/\|\s*Orbi Seeds/i.test(cleanTitle)) {
                    document.title = cleanTitle + ' | Orbi Seeds';
                } else {
                    document.title = cleanTitle;
                }
            }

            // 2. Standard Meta Description & Keywords
            if (description) {
                OrbiSEO.getOrCreateMeta('name', 'description').setAttribute('content', description.trim());
            }
            if (keywords) {
                OrbiSEO.getOrCreateMeta('name', 'keywords').setAttribute('content', keywords.trim());
            }

            // 3. Open Graph Tags
            OrbiSEO.getOrCreateMeta('property', 'og:title').setAttribute('content', document.title);
            if (description) {
                OrbiSEO.getOrCreateMeta('property', 'og:description').setAttribute('content', description.trim());
            }
            OrbiSEO.getOrCreateMeta('property', 'og:url').setAttribute('content', url.split('#')[0]);
            OrbiSEO.getOrCreateMeta('property', 'og:type').setAttribute('content', type);
            OrbiSEO.getOrCreateMeta('property', 'og:site_name').setAttribute('content', 'Orbi Seeds International');

            var absImage = OrbiSEO.toAbsoluteUrl(image);
            if (absImage) {
                OrbiSEO.getOrCreateMeta('property', 'og:image').setAttribute('content', absImage);
            }

            // 4. Twitter Card Tags
            OrbiSEO.getOrCreateMeta('name', 'twitter:card').setAttribute('content', 'summary_large_image');
            OrbiSEO.getOrCreateMeta('name', 'twitter:title').setAttribute('content', document.title);
            if (description) {
                OrbiSEO.getOrCreateMeta('name', 'twitter:description').setAttribute('content', description.trim());
            }
            if (absImage) {
                OrbiSEO.getOrCreateMeta('name', 'twitter:image').setAttribute('content', absImage);
            }

            // 5. Canonical Link
            var canonical = document.querySelector('link[rel="canonical"]');
            if (!canonical) {
                canonical = document.createElement('link');
                canonical.setAttribute('rel', 'canonical');
                document.head.appendChild(canonical);
            }
            canonical.setAttribute('href', url.split('#')[0]);

            // 6. Schema.org JSON-LD Structured Data
            if (schema) {
                var script = document.getElementById('orbi-dynamic-schema');
                if (!script) {
                    script = document.createElement('script');
                    script.id = 'orbi-dynamic-schema';
                    script.type = 'application/ld+json';
                    document.head.appendChild(script);
                }
                script.textContent = JSON.stringify(schema);
            }
        },

        // --- Category SEO ---
        setCategorySEO: function (category, path) {
            if (!category) return;
            var name = category.name || 'Category';
            var title = category.metaTitle || name;
            var cleanDesc = category.description ? OrbiSEO.stripHtml(category.description) : '';
            var desc = category.metaDescription || cleanDesc || ('Explore premium ' + name + ' seeds cultivated for superior performance, high yield, and disease resistance by Orbi Seeds.');
            var keywords = category.metaKeywords || (name + ', ' + name.toLowerCase() + ' seeds, hybrid seeds, vegetable seeds, Orbi Seeds');
            var image = category.ogImage || category.bannerImage || category.image || 'images/inr-bnr.avif';
            var pageUrl = window.location.href;

            var schema = {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                'name': title,
                'description': desc,
                'url': pageUrl,
                'isPartOf': {
                    '@type': 'WebSite',
                    'name': 'Orbi Seeds',
                    'url': window.location.origin
                }
            };

            OrbiSEO.setMeta({
                title: title,
                description: desc,
                keywords: keywords,
                image: image,
                type: 'website',
                schema: schema
            });
        },

        // --- Product SEO ---
        setProductSEO: function (product) {
            if (!product) return;
            var name = product.name || 'Product';
            var title = product.metaTitle || name;
            var cleanDesc = product.shortDescription || (product.description ? OrbiSEO.stripHtml(product.description) : '');
            var desc = product.metaDescription || cleanDesc || ('Buy high-yielding ' + name + ' hybrid seeds from Orbi Seeds. High germination rate and excellent disease tolerance.');
            var keywords = product.metaKeywords || (name + ', ' + name.toLowerCase() + ' seeds, hybrid seed varieties, Orbi Seeds International');

            var primaryImg = '';
            if (product.ogImage) {
                primaryImg = product.ogImage;
            } else if (product.images && product.images.length > 0) {
                var pImg = product.images.find(function (i) { return i.isPrimary; }) || product.images[0];
                primaryImg = pImg.url || pImg.image || (pImg.media && pImg.media.url) || '';
            }
            var absImage = OrbiSEO.toAbsoluteUrl(primaryImg || 'images/orbi-seeds-logo.png');
            var pageUrl = window.location.href;

            var schema = {
                '@context': 'https://schema.org',
                '@type': 'Product',
                'name': name,
                'image': absImage ? [absImage] : undefined,
                'description': desc,
                'sku': product.sku || undefined,
                'brand': {
                    '@type': 'Brand',
                    'name': 'Orbi Seeds'
                },
                'offers': {
                    '@type': 'Offer',
                    'availability': (product.quantity > 0 || product.isEnabled) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                    'url': pageUrl
                }
            };

            OrbiSEO.setMeta({
                title: title,
                description: desc,
                keywords: keywords,
                image: absImage,
                type: 'product',
                schema: schema
            });
        },

        // --- Blog / Single Resource SEO ---
        setBlogSEO: function (post) {
            if (!post) return;
            var title = post.metaTitle || post.title || 'Blog';
            var cleanDesc = post.summary || (post.content ? OrbiSEO.stripHtml(post.content).slice(0, 160) : '');
            var desc = post.metaDescription || cleanDesc || ('Read insights and farming tips on ' + (post.title || 'seeds and agriculture') + ' from Orbi Seeds.');
            var keywords = post.metaKeywords || ((post.title || '') + ', agricultural insights, farming guide, hybrid seeds, Orbi Seeds blog');

            var image = post.ogImage || (post.featuredImage && (post.featuredImage.url || post.featuredImage.path)) || 'images/about-us.jpg';
            var absImage = OrbiSEO.toAbsoluteUrl(image);
            var pageUrl = window.location.href;

            var schema = {
                '@context': 'https://schema.org',
                '@type': 'BlogPosting',
                'headline': post.title || title,
                'description': desc,
                'image': absImage ? [absImage] : undefined,
                'datePublished': post.publishedAt || post.createdAt,
                'dateModified': post.updatedAt || post.publishedAt || post.createdAt,
                'mainEntityOfPage': {
                    '@type': 'WebPage',
                    '@id': pageUrl
                },
                'author': {
                    '@type': 'Person',
                    'name': (post.author && (post.author.firstName + ' ' + (post.author.lastName || '')).trim()) || 'Orbi Seeds Team'
                },
                'publisher': {
                    '@type': 'Organization',
                    'name': 'Orbi Seeds International Pvt Ltd',
                    'logo': {
                        '@type': 'ImageObject',
                        'url': OrbiSEO.toAbsoluteUrl('images/orbi-seeds-logo.png')
                    }
                }
            };

            OrbiSEO.setMeta({
                title: title,
                description: desc,
                keywords: keywords,
                image: absImage,
                type: 'article',
                schema: schema
            });
        },

        // --- Blog / Resources List SEO ---
        setBlogListSEO: function () {
            OrbiSEO.setMeta({
                title: 'Resources & Agricultural Blog',
                description: 'Discover agricultural insights, seed cultivation tips, and industry updates from Orbi Seeds International.',
                keywords: 'agricultural blog, farming resources, hybrid seeds, crop management, Orbi Seeds',
                type: 'website'
            });
        }
    };

    window.OrbiSEO = OrbiSEO;
})(window);

