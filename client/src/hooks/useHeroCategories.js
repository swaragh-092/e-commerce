import { useEffect, useState } from 'react';
import PageService from '../services/pageService';
import { galleryService } from '../services/galleryService';
import BlogService from '../services/blogService';
import { getProducts } from '../services/productService';
import { getPublicTags } from '../services/tagService';
import { getBrands } from '../services/brandService';
import { getCategories } from '../services/categoryService';

const flatten = (categories, parent = '') => categories.flatMap((category) => {
  const label = parent ? `${parent} / ${category.name}` : category.name;
  return [{ ...category, label }, ...flatten(category.children || [], label)];
});

const getRecords = {
  category: getCategories,
  brand: () => getBrands({ isActive: true, withPublishedProducts: true, limit: 1000 }).then(({ data }) => data?.data || []),
  tag: () => getPublicTags().then((tags) => tags.map((tag) => ({ ...tag, image: tag.image?.url }))),
  page: () => PageService.getPublicPages().then((response) => {
    const pages = response?.data?.data || response?.data || [];
    return Array.isArray(pages) ? pages.map((page) => ({ ...page, label: page.title })) : [];
  }),
  gallery: () => galleryService.listPublic().then(({ data: albums }) =>
    Array.isArray(albums) ? albums.map((album) => ({ ...album, label: album.name, image: album.coverImage?.url || album.items?.[0]?.media?.url || '' })) : []
  ),
  blog: () => BlogService.getPublicPosts({ limit: 100 }).then((response) => {
    const posts = response?.data?.data || response?.data || [];
    return Array.isArray(posts) ? posts.map((post) => ({
      ...post,
      label: post.title,
      image: post.featuredImage || post.image?.url || post.image || '',
    })) : [];
  }),
  product: () => getProducts({ status: 'published', isEnabled: true, limit: 200 }).then((response) => {
    const products = response?.data?.data || response?.data || [];
    return Array.isArray(products) ? products.map((product) => ({
      ...product,
      label: product.name,
      image: product.image || product.images?.[0]?.url || product.images?.[0]?.imageUrl || '',
    })) : [];
  }),
};

export default function useHeroCategories(enabled, source = 'category') {
  const [result, setResult] = useState({ categories: [], status: 'loading' });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    getRecords[source]().then((categories) => {
      if (!cancelled) setResult({ categories: flatten(categories), status: 'ready' });
    }).catch(() => {
      if (!cancelled) setResult({ categories: [], status: 'error' });
    });
    return () => { cancelled = true; };
  }, [enabled, source]);

  return result;
}
