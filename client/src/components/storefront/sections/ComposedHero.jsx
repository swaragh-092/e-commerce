import { Fragment, useState } from 'react';
import EnquiryModal from '../EnquiryModal';
import NewsletterSection from './NewsletterSection';
import { formatAttributeValue } from '../../../utils/attributePresentation';
import useHeroCategories from '../../../hooks/useHeroCategories';
import { Box, Stack, Typography, Rating } from '@mui/material';
import StorefrontButton from '../StorefrontButton';
import { getMediaUrl } from '../../../utils/media';

import themeSections from '../../../../../shared/theme-sections.json';

const blockDefinitions = Object.entries(themeSections.composedBlocks.definitions);
export const HERO_BLOCK_LABELS = Object.fromEntries(blockDefinitions.map(([type, { label }]) => [type, label]));
export const HERO_CARD_SOURCES = Object.fromEntries(blockDefinitions.filter(([, def]) => def.source)
  .map(([type, { source }]) => [type, source]));

const safeLink = (value) => /^(https?:\/\/|\/(?![\/\\]))/i.test(value || '') ? value : undefined;
const { bindings, maxDepth } = themeSections.composedBlocks;

function getProductAttribute(product, name) {
  const attribute = product?.attributes?.find((item) =>
    (item.attribute?.name || item.customName || '').toLowerCase() === (name || '').toLowerCase());
  return attribute?.value != null ? formatAttributeValue(attribute.value, attribute.attribute) : attribute?.customValue;
}

function resolveProductBinding(block, product) {
  if (!product || !Object.hasOwn(bindings[block.type] || {}, block.binding)) return block;
  if (block.binding === 'productLink') {
    return product.slug ? { ...block, href: `/products/${encodeURIComponent(product.slug)}` } : block;
  }
  if (block.binding === 'productImage') {
    const image = product.images?.[0];
    const url = image?.url || image?.imageUrl || product.image;
    return typeof url === 'string' && url
      ? { ...block, url, mobileUrl: undefined, mediaType: 'image', alt: block.alt || product.name }
      : block;
  }
  const values = {
    productName: product.name,
    productSku: product.selectedVariant?.sku || product.sku,
    productSummary: product.shortDescription,
    productAttribute: block.binding === 'productAttribute' ? getProductAttribute(product, block.attributeName) : undefined,
  };
  const value = values[block.binding];
  return value != null && String(value).trim() ? { ...block, text: String(value) } : block;
}

const Media = ({ block }) => {
  if (!block.url && !block.mobileUrl) return null;
  const render = (url, type, sx) => url && (
    <Box component={type === 'video' ? 'video' : 'img'}
      src={getMediaUrl(url)} alt={type === 'video' ? undefined : block.alt || ''}
      aria-label={type === 'video' ? block.alt || 'Hero video' : undefined}
      controls={type === 'video' || undefined}
      sx={{ width: '100%', height: 'auto', display: 'block', borderRadius: 1, ...sx }}
    />
  );
  return (
    <>
      {render(block.url, block.mediaType, block.mobileUrl ? { display: { xs: 'none', sm: 'block' } } : {})}
      {render(block.mobileUrl, block.mobileMediaType, block.url ? { display: { xs: 'block', sm: 'none' } } : {})}
    </>
  );
};

const HeroBlock = ({ block: configuredBlock, onSelect, catalog, product, depth = 0, onEnquiry, owner }) => {
  if (depth > maxDepth || configuredBlock.enabled === false) return null;
  const block = resolveProductBinding(configuredBlock, product);

  let content;
  switch (block.type) {
    case 'group':
      content = <Stack direction={{ xs: 'column', sm: block.direction || 'column' }} spacing={2} sx={{ '& > *': { flex: 1, minWidth: 0 } }}>
        {(block.children || []).map((child) => <HeroBlock key={child.id} block={child} onSelect={onSelect} catalog={catalog} product={product} onEnquiry={onEnquiry} depth={depth + 1} owner={owner} />)}
      </Stack>;
      break;
    case 'heading':
      content = <Typography component="h2" variant={{ small: 'h4', medium: 'h3', large: 'h2' }[block.textSize] || 'h2'}
        sx={{ overflowWrap: 'anywhere', textAlign: block.textAlign,
          fontWeight: { regular: 400, semibold: 600, bold: 700 }[block.textWeight] }}>{block.text}</Typography>;
      break;
    case 'text':
      content = <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{block.text}</Typography>;
      break;
    case 'newsletter':
      content = <NewsletterSection section={{ title: block.title || 'Stay in touch', subtitle: block.subtitle || '', ctaText: block.ctaText || 'Subscribe', variant: 'inline-form' }} mode={onSelect ? 'preview' : 'live'} />;
      break;
    case 'enquiry':
      content = <StorefrontButton onClick={onSelect ? undefined : onEnquiry}>Enquire now</StorefrontButton>;
      break;
    case 'availability':
      content = product?.storefrontAvailability !== undefined
        ? <Typography color={product.storefrontAvailability ? 'success.main' : 'text.secondary'}>{product.storefrontAvailability ? 'In stock' : 'Currently unavailable'}</Typography>
        : null;
      break;
    case 'fulfillment':
      {
        const shipping = product?.storefrontShipping;
        const method = shipping?.method || 'flat_rate';
        const rate = Number(shipping?.flatRate || 0);
        const threshold = Number(shipping?.freeThreshold || 0);
        const currency = product?.currency || 'INR';
        const deliveryText = method === 'free'
          ? 'Free delivery'
          : method === 'free_above_threshold' && threshold > 0
            ? `Delivery from ${new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(rate)}. Free above ${new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(threshold)}`
            : `Delivery ${new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(rate)}`;
        content = product?.storefrontShipsFrom ? (
          <Stack spacing={0.5}>
            <Typography color="text.secondary">Ships from <strong>{product.storefrontShipsFrom}</strong></Typography>
            {shipping && <Typography color="text.secondary">{deliveryText}</Typography>}
          </Stack>
        ) : null;
      }
      break;
    case 'product-rating':
      content = product?.avgRating > 0 ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <Rating value={Number(product.avgRating)} precision={0.1} readOnly size="small" />
          <Typography variant="body2">{Number(product.avgRating).toFixed(1)} ({product.reviewCount || 0})</Typography>
        </Stack>
      ) : null;
      break;
    case 'product-attribute': {
      const value = getProductAttribute(product, block.attributeName);
      content = value != null && String(value).trim() ? (
        <Stack spacing={0.5}>
          {block.text && <Typography component="h2" variant="h6">{block.text}</Typography>}
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{block.prefix || ''}{value}{block.suffix || ''}</Typography>
        </Stack>
      ) : null;
      break;
    }
    case 'button':
      content = <StorefrontButton href={onSelect ? undefined : safeLink(block.href)}>{block.text || 'Shop now'}</StorefrontButton>;
      break;
    case 'media':
      content = <Media block={block} />;
      break;
    case 'gallery':
    case 'page':
    case 'blog':
    case 'product':
    case 'tag':
    case 'brand':
    case 'collection': {
      const source = HERO_CARD_SOURCES[block.type];
      const record = catalog[block.type].find(({ slug }) => slug === block[source.field]);
      const href = safeLink(block.href) || (record && source.path && `/${source.path}/${encodeURIComponent(record.slug)}`);
      const media = block.url ? block : {
        ...block,
        url: record?.image,
        mediaType: 'image',
        alt: record?.name || '',
      };
      content = (
        <Stack component={!onSelect && href ? 'a' : 'div'} href={!onSelect ? href : undefined}
          spacing={1} sx={{ color: 'inherit', textDecoration: 'none' }}>
          <Media block={media} />
          <Typography variant="h6">{block.text || record?.name || source.fallback}</Typography>
          {block.type === 'product' && record?.price != null && (
            <Typography variant="body2">{new Intl.NumberFormat(undefined, { style: 'currency', currency: record.currency || 'INR' }).format(Number(record.price))}</Typography>
          )}
        </Stack>
      );
      break;
    }
    default:
      return null;
  }

  if (block.type === 'product-attribute' && !content && !onSelect) return null;

  const select = (event) => {
    event.stopPropagation();
    onSelect(block.id);
  };
  return (
    <Box
      data-store-block={block.id}
      data-store-owner={owner}
      onClick={onSelect ? select : undefined}
      sx={{ minWidth: 0, ...(onSelect && { cursor: 'pointer', '&:hover': { outline: '1px solid', outlineColor: 'primary.main' } }) }}
    >
      {content || (onSelect && <Typography color="text.secondary">{HERO_BLOCK_LABELS[block.type]}</Typography>)}
    </Box>
  );
};

const hasBinding = (blocks, type, key) => blocks.some((block) =>
  (block.type === type && block[key]) || hasBinding(block.children || [], type, key));

export default function ComposedHero({ section, onInlineBlockFocus, product, embedded = false, insertionPlacement }) {
  const blocks = section.heroBlocks || [];
  const canvasInsertion = insertionPlacement || (!embedded && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('previewMode') === '1' && blocks.length < 12
    ? 'section' : undefined);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const onEnquiry = () => setEnquiryOpen(true);
  const { categories } = useHeroCategories(hasBinding(blocks, 'collection', 'categorySlug'));
  const { categories: brands } = useHeroCategories(hasBinding(blocks, 'brand', 'brandSlug'), 'brand');
  const { categories: pages } = useHeroCategories(hasBinding(blocks, 'page', 'pageSlug'), 'page');
  const { categories: galleries } = useHeroCategories(hasBinding(blocks, 'gallery', 'gallerySlug'), 'gallery');
  const { categories: posts } = useHeroCategories(hasBinding(blocks, 'blog', 'blogSlug'), 'blog');
  const { categories: products } = useHeroCategories(hasBinding(blocks, 'product', 'productSlug'), 'product');
  const { categories: tags } = useHeroCategories(hasBinding(blocks, 'tag', 'tagSlug'), 'tag');
  const catalog = { collection: categories, brand: brands, tag: tags, product: products, blog: posts, page: pages, gallery: galleries };
  const onSelect = onInlineBlockFocus
    ? (id) => onInlineBlockFocus(section.id, 'heroBlocks', id)
    : undefined;
  return (
    <Stack spacing={2.5} sx={embedded ? { my: 2 } : { px: { xs: 2, md: 5 }, py: { xs: 3, md: 6 } }}>
      {canvasInsertion === 'section' && <button type="button" hidden data-store-add-block="section"
        data-store-owner={section.id}>Add block here</button>}
      {blocks.map((block) => <Fragment key={block.id}>
        <HeroBlock block={block} onSelect={onSelect} catalog={catalog} product={product} onEnquiry={onEnquiry} owner={section.id} />
        {canvasInsertion && <button type="button" hidden data-store-add-block={canvasInsertion}
          data-store-owner={section.id} data-store-anchor={block.id}>Add block below</button>}
      </Fragment>)}
      <EnquiryModal open={enquiryOpen} onClose={() => setEnquiryOpen(false)} product={product} />
    </Stack>
  );
}
