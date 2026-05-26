import { getMediaUrl } from '../media';

const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const toAbsoluteUrl = (value, origin) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isAbsoluteHttpUrl(raw)) return raw;
  try {
    return new URL(raw, origin).toString();
  } catch (_) {
    return '';
  }
};

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const sanitizeText = (value) => String(value || '').trim();

export const buildProductJsonLd = ({
  product,
  selectedVariant,
  currentPrice,
  currency,
  stockAvailable,
  displaySku,
  storeName,
  pageUrl,
  canonicalBaseUrl,
  visibleReviews,
}) => {
  if (!product?.name || !pageUrl || !currency) return null;

  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const baseOrigin = isAbsoluteHttpUrl(canonicalBaseUrl) ? canonicalBaseUrl : browserOrigin;

  const imageCandidates = [
    ...(Array.isArray(selectedVariant?.images) ? selectedVariant.images : []),
    ...(Array.isArray(product.images) ? product.images : []),
  ];
  const images = unique(
    imageCandidates
      .map((entry) => {
        const candidate = typeof entry === 'string' ? entry : entry?.url;
        const relativeOrAbsolute = getMediaUrl(candidate);
        return toAbsoluteUrl(relativeOrAbsolute, baseOrigin);
      })
      .filter((url) => isAbsoluteHttpUrl(url))
  );

  const reviews = (Array.isArray(visibleReviews) ? visibleReviews : [])
    .filter((row) => Number(row?.rating) > 0)
    .map((row) => {
      const authorName = sanitizeText(row?.User?.firstName || row?.user?.firstName || 'Anonymous');
      const body = sanitizeText(row?.body);
      const title = sanitizeText(row?.title);
      const createdAt = row?.createdAt ? new Date(row.createdAt).toISOString() : null;
      return {
        '@type': 'Review',
        author: { '@type': 'Person', name: authorName },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: Number(row.rating),
          bestRating: 5,
          worstRating: 1,
        },
        ...(title ? { name: title } : {}),
        ...(body ? { reviewBody: body } : {}),
        ...(createdAt ? { datePublished: createdAt } : {}),
      };
    })
    .filter((entry) => entry.reviewBody || entry.name);

  const aggregateRating = reviews.length
    ? {
        '@type': 'AggregateRating',
        ratingValue: Number((reviews.reduce((sum, review) => sum + Number(review.reviewRating.ratingValue || 0), 0) / reviews.length).toFixed(2)),
        reviewCount: reviews.length,
      }
    : null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: sanitizeText(product.name),
    ...(images.length ? { image: images } : {}),
    ...(sanitizeText(product.shortDescription || product.description) ? { description: sanitizeText(product.shortDescription || product.description) } : {}),
    ...(sanitizeText(displaySku) ? { sku: sanitizeText(displaySku) } : {}),
    ...(sanitizeText(storeName) ? { brand: { '@type': 'Brand', name: sanitizeText(storeName) } } : {}),
    offers: {
      '@type': 'Offer',
      url: toAbsoluteUrl(pageUrl, baseOrigin),
      priceCurrency: sanitizeText(currency),
      price: Number(currentPrice).toFixed(2),
      availability: stockAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    ...(aggregateRating ? { aggregateRating } : {}),
    ...(reviews.length ? { review: reviews } : {}),
  };

  if (!isAbsoluteHttpUrl(schema.offers.url)) {
    return null;
  }

  return schema;
};
