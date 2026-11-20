'use strict';

// Album identity lives in the query string on the legacy gallery storefront.
const isGalleryPath = (pathname) => /^\/(?:demo-orbis-seeds-v1-html\/)?gallery(?:-detail)?\.html$/.test(pathname);
const normalizeSeoPath = (value) => {
  const url = new URL(String(value || '/'), 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const album = isGalleryPath(pathname) && url.searchParams.get('album');
  return album ? `${pathname.replace(/gallery\.html$/, 'gallery-detail.html')}?album=${encodeURIComponent(album)}` : pathname;
};
module.exports = { isGalleryPath, normalizeSeoPath };
