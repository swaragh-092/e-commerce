import { getMediaUrl } from '../media';
import { DEFAULT_STORE_NAME } from '../store';

const SCHEMA_CONTEXT = 'https://schema.org';

const cleanText = (value) => String(value || '').trim();
const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(cleanText(value));

const toAbsoluteUrl = (value, baseUrl) => {
  const raw = cleanText(value);
  if (!raw) return '';
  if (isAbsoluteHttpUrl(raw)) return raw;
  try {
    return new URL(raw, baseUrl).toString();
  } catch (_) {
    return '';
  }
};

const getAddress = (address) => {
  if (!address) return null;
  if (typeof address === 'string') {
    return { '@type': 'PostalAddress', streetAddress: cleanText(address) };
  }
  if (typeof address !== 'object') return null;

  const fields = {
    streetAddress: address.streetAddress || address.line1 || address.addressLine1,
    addressLocality: address.addressLocality || address.city,
    addressRegion: address.addressRegion || address.state,
    postalCode: address.postalCode || address.zip || address.zipCode,
    addressCountry: address.addressCountry || address.country,
  };
  const normalized = Object.fromEntries(
    Object.entries(fields)
      .map(([key, value]) => [key, cleanText(value)])
      .filter(([, value]) => value)
  );
  return Object.keys(normalized).length
    ? { '@type': 'PostalAddress', ...normalized }
    : null;
};

export const buildOrganizationJsonLd = ({ settings, canonicalBaseUrl } = {}) => {
  const general = settings?.general || {};
  const footer = settings?.footer || {};
  const baseUrl = cleanText(canonicalBaseUrl || settings?.seo?.canonicalBaseUrl)
    || (typeof window !== 'undefined' ? window.location.origin : '');
  const storeUrl = toAbsoluteUrl('/', baseUrl);
  const name = cleanText(general.storeName) || DEFAULT_STORE_NAME;
  if (!isAbsoluteHttpUrl(storeUrl)) return null;

  const logo = toAbsoluteUrl(getMediaUrl(settings?.logo?.main), storeUrl);
  const email = cleanText(general.contactEmail || footer.email);
  const telephone = cleanText(footer.phone || general.phone);
  const sameAs = ['facebook', 'instagram', 'twitter', 'youtube', 'linkedin']
    .map((key) => toAbsoluteUrl(footer[key], storeUrl))
    .filter(isAbsoluteHttpUrl);
  const address = getAddress(footer.address);

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'OnlineStore',
    '@id': `${storeUrl}#organization`,
    name,
    url: storeUrl,
    ...(logo ? { logo: { '@type': 'ImageObject', url: logo } } : {}),
    ...(address ? { address } : {}),
    ...(sameAs.length ? { sameAs: Array.from(new Set(sameAs)) } : {}),
    ...(email || telephone ? {
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        ...(email ? { email } : {}),
        ...(telephone ? { telephone } : {}),
      },
    } : {}),
  };
};
