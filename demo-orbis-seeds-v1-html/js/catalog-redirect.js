/* Existing bookmarks and saved product/variant links share one catalogue. */
(function () {
    var destination = new URL('product.html', window.location.href);
    destination.search = window.location.search;
    destination.hash = window.location.hash;
    window.location.replace(destination.href);
})();
