(function () {
    var BLOGS_API_URL = API_URL + "blogs/posts";
    var BLOG_LIMIT = 9;

    function getQueryParam(name) {
        var params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    function toAbsoluteMediaUrl(url) {
        if (!url) return "images/about-us.jpg";
        if (/^https?:\/\//i.test(url)) return url;
        return (APP_URL || "").replace(/\/$/, "") + url;
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

    function buildPagination(currentPage, totalPages) {
        var $pagination = $("#blog-pagination");
        $pagination.empty();
        if (!totalPages || totalPages <= 1) return;
        var prevPage = currentPage - 1;
        var nextPage = currentPage + 1;
        var html = "";
        html += '<a href="?page=' + prevPage + '" style="margin:0 6px;' + (currentPage <= 1 ? "pointer-events:none;opacity:0.5;" : "") + '">Prev</a>';
        for (var i = 1; i <= totalPages; i++) {
            html += '<a href="?page=' + i + '" style="margin:0 6px;' + (i === currentPage ? "font-weight:700;text-decoration:underline;" : "") + '">' + i + "</a>";
        }
        html += '<a href="?page=' + nextPage + '" style="margin:0 6px;' + (currentPage >= totalPages ? "pointer-events:none;opacity:0.5;" : "") + '">Next</a>';
        $pagination.html(html);
    }

    function renderPosts(posts) {
        var $container = $("#blog-list-container");
        $container.empty();
        if (!posts || !posts.length) {
            $("#blog-list-message").text("No blog posts found.");
            return;
        }
        $("#blog-list-message").text("");
        posts.forEach(function (post) {
            var imageUrl = toAbsoluteMediaUrl(post.featuredImage && post.featuredImage.url);
            var dateText = formatDate(post.displayDate || post.publishedAt || post.createdAt);
            var summaryText = post.summary || stripHtml(post.content || "").slice(0, 180);
            var blogLink = "resource.html?slug=" + encodeURIComponent(post.slug || "");
            var cardHtml = "" +
                '<a href="' + blogLink + '" class="blog-inner">' +
                '  <div class="blog-image"><img src="' + imageUrl + '" alt="' + (post.title || "Blog Image") + '"></div>' +
                '  <div class="blog-content">' +
                '    <span class="date">' + dateText + "</span>" +
                "    <h2>" + (post.title || "") + "</h2>" +
                "    <p>" + summaryText + "</p>" +
                '    <span class="read-btn">Read Article</span>' +
                "  </div>" +
                "</a>";
            $container.append(cardHtml);
        });
    }

    function fetchPosts(page) {
        $("#blog-list-message").text("Loading blogs...");
        var url = BLOGS_API_URL + "?page=" + page + "&limit=" + BLOG_LIMIT + "&categorySlug=";
        fetch(url).then(function (response) {
            if (!response.ok) throw new Error("Failed to load blog posts");
            return response.json();
        }).then(function (result) {
            var posts = (result && result.data) ? result.data : [];
            var meta = (result && result.meta) ? result.meta : {};
            var currentPage = Number(meta.page || page || 1);
            var totalPages = Number(meta.totalPages || 1);
            renderPosts(posts);
            buildPagination(currentPage, totalPages);
        }).catch(function () {
            $("#blog-list-container").empty();
            $("#blog-pagination").empty();
            $("#blog-list-message").text("Unable to load blogs right now.");
        });
    }

    var currentPage = parseInt(getQueryParam("page"), 10) || 1;
    if (currentPage < 1) currentPage = 1;
    fetchPosts(currentPage);
})();
