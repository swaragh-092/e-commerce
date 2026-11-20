(function () {
    var baseApiUrl = (typeof API_URL !== 'undefined' ? API_URL : "https://eshopadmin.swaragh.org.in/api/");
    var BLOGS_API_URL = baseApiUrl.replace(/\/$/, "") + "/blogs/posts";

    function getSlug() {
        var params = new URLSearchParams(window.location.search);
        return params.get("slug");
    }

    function toAbsoluteMediaUrl(url) {
        if (!url) return "images/about-us.jpg";
        try {
            var resolved = new URL(url, APP_URL);
            if (/^https?:$/.test(resolved.protocol)) return resolved.href;
        } catch (_) { /* Use the local fallback below. */ }
        return "images/about-us.jpg";
    }

    function formatDate(dateValue) {
        if (!dateValue) return "";
        var dateObj = new Date(dateValue);
        if (isNaN(dateObj.getTime())) return "";
        return dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }

    function stripHtml(html) {
        if (!html) return "";
        var temp = document.createElement("div");
        temp.innerHTML = html;
        return (temp.textContent || temp.innerText || "").trim();
    }

    function initFancybox() {
        if (!$.fn.fancybox) return;
        $('[data-fancybox]').fancybox({
            wheel: false,
            transitionEffect: "slide",
            loop: true,
            toolbar: true,
            clickContent: false,
            thumbs: false,
            zoom: true,
            close: true
        });
    }

    function renderBlog(post) {
        var title = post.title || "Blog";
        var dateText = formatDate(post.displayDate || post.publishedAt || post.createdAt);
        var summary = post.summary || "";
        var content = post.content || "";
        var imageUrl = toAbsoluteMediaUrl(post.featuredImage && post.featuredImage.url);
        var galleryItems = post.gallery && post.gallery.items ? post.gallery.items : [];

        if (window.OrbiSEO) window.OrbiSEO.refresh(post);
        $("#breadcrumb-blog-title").text(title);
        $("#single-blog-message").hide();
        $("#blog-date").text(dateText).show();
        $("#blog-title").text(title).show();

        if (summary) {
            $("#blog-summary").text(summary).show();
        } else {
            $("#blog-summary").hide();
        }

        $("#blog-main-image").attr("src", imageUrl).attr("alt", OrbiCatalog.imageAlt(post.featuredImage, title));
        $("#blog-main-image-wrapper").show();
        $("#blog-content").html(content).show();

        var $gallery = $("#blog-gallery");
        $gallery.empty();
        if (galleryItems.length) {
            galleryItems.forEach(function (item) {
                var mediaUrl = toAbsoluteMediaUrl(item.media && item.media.url);
                if (!item.media || !item.media.url) return;
                var alt = OrbiCatalog.imageAlt(item, item.title || item.media.caption || title);
                var image = $('<img>').attr({ src: mediaUrl, alt: alt, loading: 'lazy' });
                $gallery.append($('<a>').attr({ href: mediaUrl, 'data-fancybox': 'blog-gallery' }).append(image));
            });
            $("#blog-gallery-wrapper").show();
        } else {
            $("#blog-gallery-wrapper").hide();
        }
        initFancybox();
    }

    function renderPostNavigation(currentPost, allPosts) {
        if (!allPosts || !allPosts.length) {
            $("#blog-post-navigation").hide();
            return;
        }

        var currentIndex = -1;
        for (var i = 0; i < allPosts.length; i++) {
            var p = allPosts[i];
            if ((currentPost.id && p.id === currentPost.id) ||
                (currentPost.slug && p.slug && p.slug === currentPost.slug)) {
                currentIndex = i;
                break;
            }
        }

        var nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
        var prevPost = (currentIndex >= 0 && currentIndex < allPosts.length - 1) ? allPosts[currentIndex + 1] : null;

        if (currentIndex === -1 && allPosts.length > 0) {
            prevPost = allPosts[0];
        }

        var $prevItem = $("#post-nav-prev");
        var $nextItem = $("#post-nav-next");

        if (prevPost) {
            $("#post-nav-prev-link").attr("href", "resource.html?slug=" + encodeURIComponent(prevPost.slug || ""));
            $("#post-nav-prev-title").text(prevPost.title || "Previous Article");
            $prevItem.css("visibility", "visible").show();
        } else {
            $prevItem.css("visibility", "hidden");
        }

        if (nextPost) {
            $("#post-nav-next-link").attr("href", "resource.html?slug=" + encodeURIComponent(nextPost.slug || ""));
            $("#post-nav-next-title").text(nextPost.title || "Next Article");
            $nextItem.css("visibility", "visible").show();
        } else {
            $nextItem.css("visibility", "hidden");
        }

        if (prevPost || nextPost) {
            $("#blog-post-navigation").show();
        } else {
            $("#blog-post-navigation").hide();
        }
    }

    function renderSimilarPosts(currentPost, allPosts) {
        if (!allPosts || !allPosts.length) {
            $("#similar-blogs-section").hide();
            return;
        }

        var otherPosts = allPosts.filter(function (p) {
            if (currentPost.id && p.id === currentPost.id) return false;
            if (currentPost.slug && p.slug && p.slug === currentPost.slug) return false;
            return true;
        });

        if (!otherPosts.length) {
            $("#similar-blogs-section").hide();
            return;
        }

        var currentCatIds = (currentPost.categories || []).map(function (c) {
            return c.id || c.slug;
        });

        otherPosts.forEach(function (post) {
            var postCatIds = (post.categories || []).map(function (c) {
                return c.id || c.slug;
            });
            var matches = postCatIds.filter(function (id) {
                return currentCatIds.indexOf(id) !== -1;
            }).length;
            post._matchScore = matches;
        });

        otherPosts.sort(function (a, b) {
            if (b._matchScore !== a._matchScore) {
                return b._matchScore - a._matchScore;
            }
            var dateA = new Date(a.displayDate || a.publishedAt || a.createdAt || 0).getTime();
            var dateB = new Date(b.displayDate || b.publishedAt || b.createdAt || 0).getTime();
            return dateB - dateA;
        });

        var similar = otherPosts.slice(0, 3);
        var $container = $("#similar-blogs-container");
        $container.empty();

        similar.forEach(function (post) {
            var imageUrl = toAbsoluteMediaUrl(post.featuredImage && post.featuredImage.url);
            var dateText = formatDate(post.displayDate || post.publishedAt || post.createdAt);
            var summaryText = post.summary || stripHtml(post.content || "").slice(0, 160);
            var blogLink = "resource.html?slug=" + encodeURIComponent(post.slug || "");
            var categoryName = post.categories && post.categories.length ? post.categories[0].name : "";

            var cardHtml = "" +
                '<a href="' + blogLink + '" class="blog-inner">' +
                '  <div class="blog-image">' +
                '    <img src="' + OrbiCatalog.escape(imageUrl) + '" alt="' + OrbiCatalog.escape(OrbiCatalog.imageAlt(post.featuredImage, post.title || 'Article image')) + '" loading="lazy">' +
                '  </div>' +
                '  <div class="blog-content">' +
                (categoryName ? '    <span class="blog-category-badge">' + OrbiCatalog.escape(categoryName) + '</span>' : '') +
                '    <span class="date">' + dateText + '</span>' +
                '    <h2>' + OrbiCatalog.escape(post.title) + '</h2>' +
                '    <p>' + OrbiCatalog.escape(summaryText) + '</p>' +
                '    <span class="read-btn">Read Article &rarr;</span>' +
                '  </div>' +
                '</a>';
            $container.append(cardHtml);
        });

        $("#similar-blogs-section").show();
    }

    function showError(message) {
        $("#single-blog-message").text(message).show();
        $("#blog-date, #blog-title, #blog-summary, #blog-main-image-wrapper, #blog-content, #blog-gallery-wrapper, #blog-post-navigation, #similar-blogs-section").hide();
    }

    function loadAllPostsAndInitNavigation(currentPost) {
        fetch(BLOGS_API_URL + "?limit=50")
            .then(function (res) {
                if (!res.ok) throw new Error("Failed to load blog list");
                return res.json();
            })
            .then(function (listResult) {
                var posts = (listResult && listResult.data) ? listResult.data : [];
                renderPostNavigation(currentPost, posts);
                renderSimilarPosts(currentPost, posts);
            })
            .catch(function (err) {
                console.warn("Could not load related blogs:", err);
            });
    }

    var slug = getSlug();
    if (slug) {
        fetch(BLOGS_API_URL + "/" + encodeURIComponent(slug))
            .then(function (response) {
                if (response.status === 404 && window.OrbiSEO) window.OrbiSEO.unavailable();
                if (!response.ok) throw new Error("Failed to load blog");
                return response.json();
            })
            .then(function (result) {
                if (!result || !result.data) throw new Error("Blog not found");
                renderBlog(result.data);
                loadAllPostsAndInitNavigation(result.data);
            })
            .catch(function () {
                showError("Unable to load this blog right now.");
            });
    } else {
        // Fallback: If no slug is specified in URL, load the latest blog post!
        fetch(BLOGS_API_URL + "?limit=50")
            .then(function (response) {
                if (!response.ok) throw new Error("Failed to load blogs");
                return response.json();
            })
            .then(function (result) {
                var posts = (result && result.data) ? result.data : [];
                if (!posts.length) {
                    showError("No blog posts found.");
                    return;
                }
                var currentPost = posts[0];
                renderBlog(currentPost);
                renderPostNavigation(currentPost, posts);
                renderSimilarPosts(currentPost, posts);
            })
            .catch(function () {
                showError("Unable to load blogs right now.");
            });
    }
})();
