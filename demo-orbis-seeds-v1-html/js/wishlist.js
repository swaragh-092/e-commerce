(function($){
  if (!$) return;

  var SETTINGS_API_URL = API_URL + "settings";
  var WISHLIST_API_URL = API_URL + "wishlist";
  var WISHLIST_SESSION_KEY = "wishlistSessionId";
  var WISHLIST_FEATURE_KEY = "wishlist_feature_enabled";

  function isWishlistEnabled() {
    return localStorage.getItem(WISHLIST_FEATURE_KEY) !== 'false';
  }

  function applyWishlistVisibility(enabled) {
    var styleId = 'wishlist-disabled-style';
    var existingStyle = document.getElementById(styleId);

    if (!enabled) {
      if (!existingStyle) {
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = '.wishlist, .wishlist-heart-btn, a[href*="wishlist.html"] { display: none !important; }';
        (document.head || document.documentElement).appendChild(style);
      }
      $('.wishlist, .wishlist-heart-btn, a[href*="wishlist.html"]').hide();

      var currentPath = window.location.pathname.toLowerCase();
      if (currentPath.indexOf('wishlist.html') !== -1 || currentPath.endsWith('/wishlist')) {
        window.location.replace('index.html');
      }
    } else {
      if (existingStyle) {
        existingStyle.remove();
      }
      $('.wishlist, .wishlist-heart-btn, a[href*="wishlist.html"]').show();
    }
  }

  function checkWishlistFeature() {
    return fetch(SETTINGS_API_URL)
      .then(function(r) { return r.json(); })
      .then(function(res) {
        var enabled = true;
        if (res && res.data && res.data.features && typeof res.data.features.wishlist !== 'undefined') {
          enabled = Boolean(res.data.features.wishlist);
        }
        localStorage.setItem(WISHLIST_FEATURE_KEY, enabled ? 'true' : 'false');
        applyWishlistVisibility(enabled);
        return enabled;
      })
      .catch(function() {
        return isWishlistEnabled();
      });
  }

  function notify(title, text, type){
    if (window.customAlert) return window.customAlert(title, text, type || 'info', 1800);
    console.log((title || '') + ' ' + (text || ''));
  }

  function getWishlistSessionId() {
    var existing = localStorage.getItem(WISHLIST_SESSION_KEY);
    var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (existing && uuidRegex.test(existing)) return existing;
    var generated = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ var r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8); return v.toString(16); });
    localStorage.setItem(WISHLIST_SESSION_KEY, generated);
    return generated;
  }

  function wishlistFetch(url, options) {
    var requestOptions = options || {};
    var headers = Object.assign({}, requestOptions.headers || {}, { 'X-Session-Id': getWishlistSessionId() });
    return fetch(url, Object.assign({}, requestOptions, { headers: headers }));
  }

  function normalizeWishlistItems(data) {
    if (!data) return [];
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && Array.isArray(data.data.items)) return data.data.items;
    return [];
  }

  function getWishlist() {
    return wishlistFetch(WISHLIST_API_URL, { method: 'GET' })
      .then(function(r){ return r.json(); })
      .then(normalizeWishlistItems)
      .catch(function(){ return []; });
  }

  function toAbsoluteImage(url) {
    if (!url) return 'images/default-image.png';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.charAt(0) === '/') return APP_URL + url;
    return url;
  }

  function getWishlistItemProduct(item) {
    return item && (item.product || item.Product || item) ? (item.product || item.Product || item) : {};
  }

  function getCategorySlug(product) {
    if (!product) return '';
    if (product.category && product.category.slug) return product.category.slug;
    if (product.categories && product.categories[0] && product.categories[0].slug) return product.categories[0].slug;
    return '';
  }

  function getProductPageUrl(product) {
    var categorySlug = product && product.categorySlug ? product.categorySlug : '';
    var slug = product && product.slug ? product.slug : '';
    if (!categorySlug || !slug) return 'javascript:;';
    return 'products.html?category=' + encodeURIComponent(categorySlug) + '&slug=' + encodeURIComponent(slug);
  }

  function getProductUnit(product) {
    if (!product || !product.attributes || !product.attributes.length) return '';
    var matchedAttribute = product.attributes.find(function(attr) {
      var name = (attr.customName || (attr.attribute ? attr.attribute.name : '') || '').trim().toLowerCase();
      return name === 'unit' || name === 'uom';
    });
    if (!matchedAttribute) return '';
    return matchedAttribute.customValue || (matchedAttribute.value ? matchedAttribute.value.value : '') || '';
  }

  function extractWishlistProduct(item) {
    var product = getWishlistItemProduct(item);
    var id = String(product.id || item.productId || item.id || '');
    var name = product.name || item.name || '';
    var image = '';
    var slug = product.slug || item.slug || '';
    var categorySlug = getCategorySlug(product) || item.categorySlug || '';
    var unit = getProductUnit(product) || item.unit || '';

    if (product.images && product.images[0] && product.images[0].url) image = product.images[0].url;
    else if (item.image) image = item.image;

    return {
      id: id,
      name: name,
      image: toAbsoluteImage(image),
      slug: slug,
      categorySlug: categorySlug,
      unit: unit
    };
  }

  function fetchProductBySlug(productSlug) {
    if (!productSlug) return Promise.resolve(null);
    return fetch(API_URL + 'products/' + encodeURIComponent(productSlug) + '?include=categories,attributes')
      .then(function(r){ return r.json(); })
      .then(function(data){
        var p = data && data.data ? data.data : null;
        if (!p) return null;
        return {
          id: String(p.id || ''),
          name: p.name || '',
          image: toAbsoluteImage((p.images && p.images[0] && p.images[0].url) || ''),
          slug: p.slug || '',
          categorySlug: getCategorySlug(p),
          unit: getProductUnit(p)
        };
      })
      .catch(function(){ return null; });
  }

  function addWishlistItem(productId) {
    return wishlistFetch(WISHLIST_API_URL + '/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: productId, product: { id: productId } })
    });
  }

  function removeWishlistItem(productId) {
    return wishlistFetch(WISHLIST_API_URL + '/items/' + encodeURIComponent(productId), { method: 'DELETE' });
  }

  function clearWishlist() {
    return wishlistFetch(WISHLIST_API_URL + '/items', { method: 'DELETE' });
  }

  function getCart() { return JSON.parse(localStorage.getItem('enquiryCart')) || []; }
  function saveCart(cart) {
    localStorage.setItem('enquiryCart', JSON.stringify(cart));
    var total = cart.reduce(function(a, i){ return a + (parseInt(i.quantity, 10) || 1); }, 0);
    $('#header-enquiry-count').text(total);
  }

  function updateWishlistCounter() {
    if (!isWishlistEnabled()) return;
    getWishlist().then(function(items){ $('#header-wishlist-count').text(items.length || 0); });
  }

  function setHeartStateByIds(ids) {
    var map = {};
    ids.forEach(function(id){ map[String(id)] = true; });
    $('.wishlist-heart-btn').each(function(){
      var id = String($(this).attr('data-id') || '');
      var active = !!map[id];
      $(this).toggleClass('active', active).attr('aria-pressed', active ? 'true' : 'false').html(active ? '&#10084;' : '&#9825;');
    });
  }

  function syncWishlistHearts() {
    if (!isWishlistEnabled()) return;
    getWishlist().then(function(items){
      var ids = items.map(function(item){ var p=getWishlistItemProduct(item); return String(p.id || item.productId || ''); }).filter(Boolean);
      setHeartStateByIds(ids);
    });
  }

  function renderWishlist() {
    if (!isWishlistEnabled()) return;
    var $container = $('#dynamic-wishlist-container');
    var $actions = $container.siblings('.cart-buttons');
    if (!$container.length) return;
    getWishlist().then(function(items){
      $container.empty();
      if (!items.length) {
        $container.html('<p style="text-align:center; padding: 20px;">No items in wishlist.</p>');
        $actions.hide();
        return;
      }
      $actions.show();
      var baseProducts = items.map(extractWishlistProduct);
      var needHydration = baseProducts.some(function(p){ return !p.name || p.name === 'Product' || !p.slug || !p.categorySlug || !p.unit; });
      var hydratePromise = needHydration
        ? Promise.all(baseProducts.map(function(p){
            if (p.name && p.slug && p.categorySlug && p.unit) return Promise.resolve(p);
            if (!p.slug) return Promise.resolve(p);
            return fetchProductBySlug(p.slug).then(function(full){ return full ? Object.assign({}, p, full) : p; });
          }))
        : Promise.resolve(baseProducts);

      hydratePromise.then(function(products){
        products.forEach(function(p){
          var name = p.name || 'Product';
          var image = p.image || 'images/default-image.png';
          var productUrl = getProductPageUrl(p);
          $container.append('<div class="cart-inner" data-id="'+p.id+'" data-name="'+name+'" data-image="'+image+'" data-slug="'+(p.slug||'')+'" data-category="'+(p.categorySlug||'')+'" data-unit="'+(p.unit||'')+'">'+
            '<button class="close-btn remove-wishlist-item">&times;</button>'+
            '<div class="cart-image"><a href="'+productUrl+'"><img src="'+image+'" alt="'+name+'" onerror="this.onerror=null;this.src=\'images/default-image.png\';"></a></div>'+
            '<div class="cart-content"><h2><a href="'+productUrl+'">'+name+'</a></h2><div class="cart-bottom"><a href="javascript:;" class="view-product-btn move-to-cart-btn">Move to Enquiry List</a></div></div></div>');
        });
      });
    });
  }

  window.syncWishlistHearts = syncWishlistHearts;

  $(document).on('click', '.wishlist-heart-btn', function(e){
    e.preventDefault();
    if (!isWishlistEnabled()) return;
    var $btn=$(this), id=String($btn.attr('data-id')||''), name=$btn.attr('data-name')||'Item';
    if (!id) return;
    var isActive=$btn.hasClass('active');
    $btn.toggleClass('active', !isActive).attr('aria-pressed', !isActive ? 'true' : 'false').html(!isActive ? '&#10084;' : '&#9825;');
    (isActive ? removeWishlistItem(id) : addWishlistItem(id)).then(function(r){ if (r && r.ok===false) throw new Error();
      updateWishlistCounter(); syncWishlistHearts(); renderWishlist(); notify(isActive ? 'Removed!' : 'Added!', name + (isActive ? ' removed from wishlist.' : ' added to wishlist.'), 'success');
    }).catch(function(){
      $btn.toggleClass('active', isActive).attr('aria-pressed', isActive ? 'true' : 'false').html(isActive ? '&#10084;' : '&#9825;');
      notify('Error', 'Unable to update wishlist.', 'error');
    });
  });

  $(document).on('click', '.remove-wishlist-item', function(e){
    e.preventDefault();
    var id = $(this).closest('.cart-inner').attr('data-id');
    if (!id) return;
    removeWishlistItem(id).finally(function(){ updateWishlistCounter(); syncWishlistHearts(); renderWishlist(); });
  });

  $(document).on('click', '#clear-wishlist-btn', function(e){
    e.preventDefault();
    clearWishlist().finally(function(){ updateWishlistCounter(); syncWishlistHearts(); renderWishlist(); });
  });

  $(document).on('click', '#move-all-to-cart-btn', function(e){
    e.preventDefault();
      getWishlist().then(function(items){
      if (!items.length) return;
      var cart=getCart();
      items.forEach(function(item){
        var p=getWishlistItemProduct(item); var id=String(p.id||item.productId||''); var name=p.name||item.name; var image=toAbsoluteImage((p.images&&p.images[0]&&p.images[0].url)||item.image||'images/default-image.png'); var slug=p.slug||item.slug||''; var categorySlug=getCategorySlug(p)||item.categorySlug||''; var unit=getProductUnit(p)||item.unit||'';
        if (!id || !name) return;
        var ex=cart.find(function(i){ return i.id===id; });
        if (ex) ex.quantity += 1; else cart.push({id:id,name:name,image:image,quantity:1,slug:slug,categorySlug:categorySlug,unit:unit});
      });
      saveCart(cart);
      clearWishlist().finally(function(){ updateWishlistCounter(); syncWishlistHearts(); renderWishlist(); });
    });
  });

  $(document).on('click', '.move-to-cart-btn', function(e){
    e.preventDefault();
    var $item=$(this).closest('.cart-inner');
    var id=String($item.attr('data-id')||''), name=$item.attr('data-name'), image=$item.attr('data-image'), slug=$item.attr('data-slug')||'', categorySlug=$item.attr('data-category')||'', unit=$item.attr('data-unit')||'';
    if (!id || !name) return;
    var cart=getCart(); var ex=cart.find(function(i){ return i.id===id; });
    if (ex) ex.quantity += 1; else cart.push({id:id,name:name,image:toAbsoluteImage(image),quantity:1,slug:slug,categorySlug:categorySlug,unit:unit});
    saveCart(cart);
    removeWishlistItem(id).finally(function(){ updateWishlistCounter(); syncWishlistHearts(); renderWishlist(); });
  });

  $(function(){
    var cached = localStorage.getItem(WISHLIST_FEATURE_KEY);
    if (cached === 'false') {
      applyWishlistVisibility(false);
    }

    checkWishlistFeature().then(function(enabled){
      if (enabled) {
        updateWishlistCounter();
        syncWishlistHearts();
        renderWishlist();
      }
    });
  });
})(window.jQuery);
