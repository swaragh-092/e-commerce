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

    var $activeNavLinks = $navLinks.filter(function() {
        var linkHrefAttr = $(this).attr('href');
        if (!linkHrefAttr || linkHrefAttr === '#' || linkHrefAttr === 'javascript:;') return false;

        var linkLoc;
        try {
            linkLoc = new URL(this.href);
        } catch(e) {
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

    $activeNavLinks.each(function() {
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
        $this.parents('li.dropdown-wrapper-li, li.megamenu-wrapper-li').each(function() {
            $(this).addClass('act-link');
            $(this).children('a').addClass('act-link');
        });

        // For mobile
        if ($this.closest('.mobile-menu-container').length > 0) {
            $this.closest('li').addClass('act-link');
            $this.parents('li.has-submenu').each(function() {
                $(this).children('.menu-item-row').find('a').addClass('act-link');
                $(this).addClass('act-link');
            });
        }
    });

    // Fallback: If on products page and top-level link isn't already active, highlight "Our Products"
    if (currentPath.indexOf('/product') !== -1 || currentCat) {
        var $ourProducts = $('.nav-links > li > a, .mobile-menu-content > ul > li > a, .mobile-menu-content > ul > li > .menu-item-row > a').filter(function() {
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
    } catch(e) { }

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
function buildDesktopMegaMenu(item) {
    var html = '<div class="mega-menu-wrapper"><div class="mega-menu-container"><div class="mega-menu-columns">';
    
    var sortedChildren = item.children.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
    
    sortedChildren.forEach(function(child) {
        if (!child.isVisible) return;
        var childUrl = formatMenuUrl(child.url);
        var targetAttr = child.openInNewTab ? ' target="_blank"' : '';
        
        html += '<div class="mega-menu-column">';
        html += '<a href="' + childUrl + '" class="mega-menu-column-title"' + targetAttr + '>' + child.label + '</a>';
        
        if (child.children && child.children.length > 0) {
            html += '<ul class="mega-menu-list">';
            var sortedSubChildren = child.children.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
            sortedSubChildren.forEach(function(subChild) {
                if (!subChild.isVisible) return;
                var subUrl = formatMenuUrl(subChild.url);
                var subTargetAttr = subChild.openInNewTab ? ' target="_blank"' : '';
                html += '<li><a href="' + subUrl + '"' + subTargetAttr + '>' + subChild.label + '</a></li>';
            });
            html += '</ul>';
        }
        html += '</div>';
    });
    
    html += '</div></div></div>';
    return html;
}

function buildDesktopMenuSub(items) {
    var html = "";
    if (!items || !items.length) return html;

    items.forEach(function(item) {
        if (!item.isVisible) return;
        var hasChildren = item.children && item.children.length > 0;
        var itemUrl = formatMenuUrl(item.url);
        var targetAttr = item.openInNewTab ? ' target="_blank"' : '';
        
        if (hasChildren) {
            html += '<li class="dropdown-wrapper-li"><a href="' + itemUrl + '"' + targetAttr + '>' + item.label + '</a>';
            html += '<div class="dropdown-wrapper"><ul>';
            var sortedChildren = item.children.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
            html += buildDesktopMenuSub(sortedChildren);
            html += '</ul></div></li>';
        } else {
            html += '<li><a href="' + itemUrl + '"' + targetAttr + '>' + item.label + '</a></li>';
        }
    });
    return html;
}

function buildMobileMenuSub(items, parentLabel) {
    var html = "";
    if (!items || !items.length) return html;

    html += '<li class="back-item"><a href="javascript:;" class="back-button"><span class="back-icon"><img src="images/icons/back.png" alt="Back"></span> ' + (parentLabel || 'Back') + '</a></li>';

    items.forEach(function(item) {
        if (!item.isVisible) return;
        var hasChildren = item.children && item.children.length > 0;
        var itemUrl = formatMenuUrl(item.url);
        var targetAttr = item.openInNewTab ? ' target="_blank"' : '';
        
        var liClass = hasChildren ? 'class="has-submenu"' : '';
        html += '<li ' + liClass + '>';
        
        if (hasChildren) {
            html += '<div class="menu-item-row">';
            html += '<a href="' + itemUrl + '"' + targetAttr + '>' + item.label + '</a>';
            html += '<span class="submenu-toggle"><img src="images/icons/next.png" alt=">"></span>';
            html += '</div>';
            html += '<ul class="submenu">';
            var sortedChildren = item.children.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
            html += buildMobileMenuSub(sortedChildren, item.label);
            html += '</ul>';
        } else {
            html += '<a href="' + itemUrl + '"' + targetAttr + '>' + item.label + '</a>';
        }
        html += '</li>';
    });
    return html;
}

function fetchAndRenderMenu() {
    var apiUrl = API_URL;
    
    Promise.all([
        fetch(apiUrl + "menus/slug/public/orbis-menu").then(function(r) { return r.json(); }),
        fetch(apiUrl + "categories").then(function(r) { return r.json(); })
    ])
    .then(function(results) {
        var menuResult = results[0];
        var categoriesResult = results[1];
        
        if (menuResult && menuResult.success && menuResult.data && menuResult.data.items) {
            var desktopHtml = "";
            var mobileHtml = '<ul>';
            
            // Initial mobile items
            mobileHtml += '<li><a href="index.html" class="resp-home">Home</a></li>';

            var items = menuResult.data.items.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });

            items.forEach(function(item) {
                if (!item.isVisible) return;
                
                var hasChildren = item.children && item.children.length > 0;
                var itemUrl = formatMenuUrl(item.url);
                var targetAttr = item.openInNewTab ? ' target="_blank"' : '';

                // Identify "Our Products" for dynamic category injection
                var isProducts = item.label.toLowerCase().indexOf("product") !== -1;

                if (isProducts && (!hasChildren)) {
                    if (categoriesResult && categoriesResult.success && categoriesResult.data) {
                        item.children = categoriesResult.data.map(function(cat) {
                            return {
                                label: cat.name,
                                url: "products.html?category=" + cat.slug,
                                isVisible: true,
                                children: cat.children ? cat.children.map(function(sub) {
                                    return {
                                        label: sub.name,
                                        url: "products.html?category=" + sub.slug,
                                        isVisible: true
                                    };
                                }) : []
                            };
                        });
                        hasChildren = item.children.length > 0;
                    }
                }

                // Desktop Builder
                if (hasChildren) {
                    // Check if it should be a mega menu (e.g. if children have children)
                    var isMegaMenu = item.children.some(function(c) { return c.children && c.children.length > 0; });
                    
                    if (isMegaMenu) {
                        desktopHtml += '<li class="megamenu-wrapper-li"><a href="' + itemUrl + '"' + targetAttr + '>' + item.label + '</a>';
                        desktopHtml += buildDesktopMegaMenu(item);
                        desktopHtml += '</li>';
                    } else {
                        desktopHtml += '<li class="dropdown-wrapper-li"><a href="' + itemUrl + '"' + targetAttr + '>' + item.label + '</a>';
                        desktopHtml += '<div class="dropdown-wrapper last"><ul>';
                        var sortedChildren = item.children.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
                        desktopHtml += buildDesktopMenuSub(sortedChildren);
                        desktopHtml += '</ul></div></li>';
                    }
                } else {
                    desktopHtml += '<li class="dropdown-wrapper-li"><a href="' + itemUrl + '"' + targetAttr + '>' + item.label + '</a></li>';
                }

                // Mobile Builder
                var liClass = hasChildren ? 'class="has-submenu"' : '';
                mobileHtml += '<li ' + liClass + '>';
                if (hasChildren) {
                    mobileHtml += '<div class="menu-item-row">';
                    mobileHtml += '<a href="' + itemUrl + '"' + targetAttr + '>' + item.label + '</a>';
                    mobileHtml += '<span class="submenu-toggle"><img src="images/icons/next.png" alt=">"></span>';
                    mobileHtml += '</div>';
                    mobileHtml += '<ul class="submenu">';
                    var sortedChildren = item.children.sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
                    mobileHtml += buildMobileMenuSub(sortedChildren, item.label);
                    mobileHtml += '</ul>';
                } else {
                    mobileHtml += '<a href="' + itemUrl + '"' + targetAttr + '>' + item.label + '</a>';
                }
                mobileHtml += '</li>';
            });

            mobileHtml += '</ul>';

            // Cache in localStorage to render with zero delay/flicker on subsequent loads
            try {
                localStorage.setItem('orbis_desktop_menu_html', desktopHtml);
                localStorage.setItem('orbis_mobile_menu_html', mobileHtml);
            } catch(e) {}

            // Update DOM only if changed to avoid unnecessary flicker/repaint
            if ($('.nav-links').html() !== desktopHtml) {
                $('.nav-links').html(desktopHtml);
            }
            
            // Build the custom mobile menu container if it doesn't exist
            if ($('.mobile-menu-container').length === 0) {
                $('body').append(
                    '<div class="mobile-menu-overlay"></div>' +
                    '<div class="mobile-menu-container">' +
                        '<div class="mobile-menu-header">' +
                            '<img src="images/orbi-seeds-logo.jpg" alt="Logo">' +
                            '<div class="mobile-menu-close">&times;</div>' +
                        '</div>' +
                        '<div class="mobile-menu-content"></div>' +
                    '</div>'
                );
            }
            if ($('.mobile-menu-content').html() !== mobileHtml) {
                $('.mobile-menu-content').html(mobileHtml);
            }
        }
    })
    .catch(function(error) {
        console.error("Error fetching menu or categories:", error);
    })
    .finally(function() {
        setActiveLinks();
        if (typeof window.initMobileMenu === 'function') {
            window.initMobileMenu();
        }
    });
}

function applyCachedMenu() {
    try {
        var cachedDesktop = localStorage.getItem('orbis_desktop_menu_html');
        var cachedMobile = localStorage.getItem('orbis_mobile_menu_html');
        if (cachedDesktop && $('.nav-links').length) {
            $('.nav-links').html(cachedDesktop);
        }
        if (cachedMobile) {
            if ($('.mobile-menu-container').length === 0) {
                $('body').append(
                    '<div class="mobile-menu-overlay"></div>' +
                    '<div class="mobile-menu-container">' +
                        '<div class="mobile-menu-header">' +
                            '<img src="images/orbi-seeds-logo.jpg" alt="Logo">' +
                            '<div class="mobile-menu-close">&times;</div>' +
                        '</div>' +
                        '<div class="mobile-menu-content"></div>' +
                    '</div>'
                );
            }
            $('.mobile-menu-content').html(cachedMobile);
        }
        if (cachedDesktop) {
            setActiveLinks();
        }
    } catch(e) {}
}

// Immediately apply cached header to eliminate delay and flickering
if (typeof $ !== 'undefined' && $('.nav-links').length > 0) {
    applyCachedMenu();
}

$(document).ready(function () {
    applyCachedMenu();
    fetchAndRenderMenu();
});
  // active links code

  

// Mobile Menu Toggle logic
$(document).on('click', '.hc-nav-trigger, .toggle', function(e) {
    e.preventDefault();
    $('.mobile-menu-container').addClass('open');
    $('.mobile-menu-overlay').fadeIn();
    $('body').addClass('menu-open');
});

$(document).on('click', '.mobile-menu-close, .mobile-menu-overlay', function() {
    $('.mobile-menu-container').removeClass('open');
    $('.mobile-menu-overlay').fadeOut();
    $('body').removeClass('menu-open');
});

$(document).on('click', '.submenu-toggle', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var $submenu = $(this).closest('li').children('.submenu');
    $submenu.addClass('active');
    // Ensure parent is not hidden if we use scroll
    $('.mobile-menu-content').scrollTop(0);
});

$(document).on('click', '.back-button', function(e) {
    e.preventDefault();
    e.stopPropagation();
    $(this).closest('.submenu').removeClass('active');
});

$(document).on('click', '.mobile-menu-content a:not([href="javascript:;"]):not(.back-button)', function() {
    $('.mobile-menu-close').click();
    // Reset all submenus when closing
    $('.submenu').removeClass('active');
});


// Form
function validationCont()
{
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
            var absImage = OrbiSEO.toAbsoluteUrl(primaryImg || 'images/default-image.png');
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

