function fetchAndRenderHomeSections() {
    var homeSectionUrl = API_URL + "api-builder/public/orbis-home-section-1";
    var uploadUrl = APP_URL;

    fetch(homeSectionUrl)
    .then(function(r) { return r.json(); })
    .then(function(result) {
        var categories = result && result.success && result.data
            ? (result.data.categories || (result.data.data && result.data.data.categories))
            : null;

        if (categories && categories.length) {
            
            
            var html = "";
            categories.forEach(function(cat) {
                if (!cat.children || !cat.children.length) return;
                
                html += '<div class="vegetables">';
                html += '    <div class="category-label">' + cat.name + '</div>';

                cat.children.slice(0, 4).forEach(function(sub) {
                    var subUrl = "products.html?category=" + sub.slug;
                    var iconUrl = sub.icon ? (sub.icon.startsWith('http') ? sub.icon : uploadUrl + sub.icon) : 'images/variety-of-seeds/tomato.png';
                    
                    html += '<a href="' + subUrl + '" class="variety-of-seeds-1">';
                    html += '    <div class="variety-of-seeds-img-parent">';
                    html += '        <div class="variety-of-seeds-img">';
                    html += '            <img src="' + iconUrl + '" alt="' + sub.name + '">';
                    html += '        </div>';
                    html += '    </div>';
                    html += '    <div class="variety-of-text">';
                    html += '        <h3>' + sub.name + '</h3>';
                    html += '        <div class="arrow">';
                    html += '            <img src="images/icons/next.png" alt="Image">';
                    html += '        </div>';
                    html += '    </div>';
                    html += '</a>';
                });
                html += '</div>';
            });
            $('#orbis-home-section-categories').html(html);
        }
    })
    .catch(function(error) {
        console.error("Error fetching home sections:", error);
    });
}

$(document).ready(function () {
    fetchAndRenderHomeSections();
});
