import { getMediaUrl } from '../media';
import { getVariantOptionEntries } from '../variantOptions';
import { getVariantUnitPrice } from '../variantPricing';

const SCHEMA_CONTEXT = 'https://schema.org';
const PRODUCT_URL_PATH = '/products/';
const VARIANT_PROPERTIES = new Map([
  ['color', 'https://schema.org/color'],
  ['colour', 'https://schema.org/color'],
  ['size', 'https://schema.org/size'],
  ['material', 'https://schema.org/material'],
  ['pattern', 'https://schema.org/pattern'],
  ['gender', 'https://schema.org/suggestedGender'],
  ['age', 'https://schema.org/suggestedAge'],
]);

const cleanText = (value) => String(value || '').trim();
const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(cleanText(value));
const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const resolveBaseUrl = (canonicalBaseUrl) => {
  const configured = cleanText(canonicalBaseUrl);
  if (isAbsoluteHttpUrl(configured)) return configured;
  return typeof window !== 'undefined' ? window.location.origin : '';
};

const toAbsoluteUrl = (value, baseUrl) => {
  const raw = cleanText(value);
  if (!raw) return '';
  if (isAbsoluteHttpUrl(raw)) return raw;
  if (!baseUrl) return '';
  try {
    return new URL(raw, baseUrl).toString();
  } catch (_) {
    return '';
  }
};

const getImages = (product, variant, baseUrl) => unique([
  ...(Array.isArray(variant?.images) ? variant.images : []),
  ...(Array.isArray(product?.images) ? product.images : []),
].map((entry) => {
  const path = typeof entry === 'string' ? entry : entry?.url;
  return toAbsoluteUrl(getMediaUrl(path), baseUrl);
}).filter(isAbsoluteHttpUrl));

const getBrand = (product) => {
  const name = cleanText(product?.brand?.name || product?.brandName);
  return name ? { '@type': 'Brand', name } : null;
};

const getAvailability = (product, variant, selectedVariant) => {
  const stockEntity = variant || selectedVariant;
  const stock = stockEntity
    ? Number(stockEntity.stockQty || 0) - Number(stockEntity.reservedQty || 0)
    : Number(product?.quantity || 0) - Number(product?.reservedQty || 0);
  return stock > 0 ? `${SCHEMA_CONTEXT}/InStock` : `${SCHEMA_CONTEXT}/OutOfStock`;
};

const getPriceValidUntil = (product) => {
  const saleEndAt = product?.saleEndAt ? new Date(product.saleEndAt) : null;
  if (!saleEndAt || Number.isNaN(saleEndAt.getTime()) || saleEndAt <= new Date()) return '';

  const salePrice = Number(product?.salePrice);
  const regularPrice = Number(product?.price);
  const saleStartsAt = product?.saleStartAt ? new Date(product.saleStartAt) : null;
  const saleIsActive = product?.isSaleActive === true
    || (product?.isSaleActive === undefined
      && Number.isFinite(salePrice)
      && Number.isFinite(regularPrice)
      && salePrice > 0
      && salePrice < regularPrice
      && (!saleStartsAt || Number.isNaN(saleStartsAt.getTime()) || saleStartsAt <= new Date()));

  return saleIsActive ? saleEndAt.toISOString().slice(0, 10) : '';
};

const getOffer = ({ product, variant, selectedVariant, currency, url, price }) => {
  const numericPrice = Number(price);
  if (!isAbsoluteHttpUrl(url) || !cleanText(currency) || !Number.isFinite(numericPrice) || numericPrice < 0) return null;
  const priceValidUntil = getPriceValidUntil(product);
  return {
    '@type': 'Offer',
    url,
    priceCurrency: cleanText(currency),
    price: numericPrice.toFixed(2),
    availability: getAvailability(product, variant, selectedVariant),
    itemCondition: `${SCHEMA_CONTEXT}/NewCondition`,
    ...(priceValidUntil ? { priceValidUntil } : {}),
  };
};

const getReviews = (visibleReviews) => (Array.isArray(visibleReviews) ? visibleReviews : [])
  .map((review) => {
    const rating = Number(review?.rating);
    const body = cleanText(review?.body);
    const title = cleanText(review?.title);
    const firstName = cleanText(review?.User?.firstName || review?.user?.firstName);
    const lastName = cleanText(review?.User?.lastName || review?.user?.lastName);
    const authorName = [firstName, lastName].filter(Boolean).join(' ');
    if (!authorName || rating < 1 || rating > 5 || (!body && !title)) return null;
    const createdAt = review?.createdAt ? new Date(review.createdAt) : null;
    return {
      '@type': 'Review',
      author: { '@type': 'Person', name: authorName },
      reviewRating: { '@type': 'Rating', ratingValue: rating, bestRating: 5, worstRating: 1 },
      ...(title ? { name: title } : {}),
      ...(body ? { reviewBody: body } : {}),
      ...(createdAt && !Number.isNaN(createdAt.getTime()) ? { datePublished: createdAt.toISOString() } : {}),
    };
  })
  .filter(Boolean);

const getAggregateRating = (reviews) => {
  if (!reviews.length) return null;
  const total = reviews.reduce((sum, review) => sum + Number(review.reviewRating.ratingValue), 0);
  return {
    '@type': 'AggregateRating',
    ratingValue: Number((total / reviews.length).toFixed(2)),
    reviewCount: reviews.length,
  };
};

const getVariantUrl = (canonicalUrl, variant) => {
  const variantKey = cleanText(variant?.sku || variant?.id);
  if (!variantKey) return canonicalUrl;
  try {
    const url = new URL(canonicalUrl);
    url.searchParams.set('variant', variantKey);
    return url.toString();
  } catch (_) {
    return canonicalUrl;
  }
};

const getVariantName = (product, variant) => {
  const options = getVariantOptionEntries(variant)
    .map((entry) => `${entry.attributeName}: ${entry.valueLabel}`)
    .join(', ');
  return options ? `${cleanText(product?.name)} - ${options}` : cleanText(product?.name);
};

const getVariantProperties = (variants) => {
  const properties = [];
  const seen = new Set();
  variants.forEach((variant) => {
    getVariantOptionEntries(variant).forEach((entry) => {
      const property = VARIANT_PROPERTIES.get(cleanText(entry.attributeName).toLowerCase());
      if (property && !seen.has(property)) {
        seen.add(property);
        properties.push(property);
      }
    });
  });
  return properties;
};

const getProductSchema = ({ product, variant, selectedVariant, currency, url, baseUrl }) => {
  const price = variant ? getVariantUnitPrice(product, variant) : getVariantUnitPrice(product, selectedVariant);
  const offer = getOffer({ product, variant, selectedVariant, currency, url, price });
  if (!offer) return null;
  const images = getImages(product, variant || selectedVariant, baseUrl);
  const sku = cleanText(variant?.sku || (variant ? '' : selectedVariant?.sku || product?.sku));
  const brand = getBrand(product);
  return {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: getVariantName(product, variant || selectedVariant),
    ...(images.length ? { image: images } : {}),
    ...(cleanText(product?.shortDescription || product?.description) ? { description: cleanText(product.shortDescription || product.description) } : {}),
    ...(sku ? { sku } : {}),
    ...(brand ? { brand } : {}),
    offers: offer,
  };
};

export const buildProductJsonLd = ({
  product,
  selectedVariant,
  currency,
  stockAvailable,
  displaySku,
  pageUrl,
  canonicalBaseUrl,
  visibleReviews,
}) => {
  if (!product?.name || !pageUrl || !currency) return null;
  const baseUrl = resolveBaseUrl(canonicalBaseUrl);
  const canonicalUrl = toAbsoluteUrl(pageUrl, baseUrl);
  if (!isAbsoluteHttpUrl(canonicalUrl)) return null;

  const reviews = getReviews(visibleReviews);
  const aggregateRating = getAggregateRating(reviews);
  const activeVariants = Array.isArray(product.variants)
    ? product.variants.filter((variant) => variant?.isActive !== false)
    : [];
  const brand = getBrand(product);

  if (product.type === 'variable' && activeVariants.length > 0) {
    const productGroupId = cleanText(product.sku || product.id);
    const variants = activeVariants.map((variant) => {
      const variantUrl = getVariantUrl(canonicalUrl, variant);
      const schema = getProductSchema({
        product,
        variant,
        selectedVariant,
        currency,
        url: variantUrl,
        baseUrl,
      });
      if (!schema) return null;
      return {
        ...schema,
        '@id': `${variantUrl}#product`,
        ...(productGroupId ? { inProductGroupWithID: productGroupId } : {}),
      };
    }).filter(Boolean);
    if (!variants.length) return null;

    return {
      '@context': SCHEMA_CONTEXT,
      '@type': 'ProductGroup',
      '@id': `${canonicalUrl}#product-group`,
      name: cleanText(product.name),
      ...(brand ? { brand } : {}),
      ...(cleanText(product.description || product.shortDescription) ? { description: cleanText(product.description || product.shortDescription) } : {}),
      ...(productGroupId ? { productGroupID: productGroupId } : {}),
      variesBy: getVariantProperties(activeVariants),
      hasVariant: variants,
      ...(aggregateRating ? { aggregateRating } : {}),
      ...(reviews.length ? { review: reviews } : {}),
    };
  }

  const schema = getProductSchema({
    product,
    selectedVariant,
    currency,
    url: canonicalUrl,
    baseUrl,
  });
  if (!schema) return null;

  return {
    '@context': SCHEMA_CONTEXT,
    ...schema,
    ...(displaySku && !schema.sku ? { sku: cleanText(displaySku) } : {}),
    ...(stockAvailable !== undefined ? {
      offers: {
        ...schema.offers,
        availability: stockAvailable ? `${SCHEMA_CONTEXT}/InStock` : `${SCHEMA_CONTEXT}/OutOfStock`,
      },
    } : {}),
    ...(aggregateRating ? { aggregateRating } : {}),
    ...(reviews.length ? { review: reviews } : {}),
  };
};

export const buildBreadcrumbJsonLd = ({ items, canonicalBaseUrl, pageUrl }) => {
  if (!Array.isArray(items) || !items.length) return null;
  const baseUrl = resolveBaseUrl(canonicalBaseUrl);
  const itemListElement = items.map((item, index) => {
    const name = cleanText(item?.name || item?.label);
    const absoluteUrl = toAbsoluteUrl(item?.url || item?.to, baseUrl);
    return {
      '@type': 'ListItem',
      position: index + 1,
      name,
      ...(absoluteUrl ? { item: absoluteUrl } : {}),
    };
  }).filter((item) => item.name);
  if (!itemListElement.length) return null;
  const absolutePageUrl = toAbsoluteUrl(pageUrl, baseUrl);
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    ...(isAbsoluteHttpUrl(absolutePageUrl) ? { '@id': `${absolutePageUrl}#breadcrumb` } : {}),
    itemListElement,
  };
};
