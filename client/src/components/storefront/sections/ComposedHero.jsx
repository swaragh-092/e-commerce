import { useState } from 'react';
import EnquiryModal from '../EnquiryModal';
import NewsletterSection from './NewsletterSection';
import { formatAttributeValue } from '../../../utils/attributePresentation';
import useHeroCategories from '../../../hooks/useHeroCategories';
import { Box, Stack, Typography, Rating } from '@mui/material';
import StorefrontButton from '../StorefrontButton';
import { getMediaUrl } from '../../../utils/media';

export const HERO_BLOCK_LABELS = {
  group: 'Group', heading: 'Heading', text: 'Text', button: 'Button',
  media: 'Media', 'product-attribute': 'Product attribute', 'product-rating': 'Product rating', enquiry: 'Enquiry form', newsletter: 'Newsletter signup', blog: 'Blog post card', availability: 'Product availability', fulfillment: 'Ships from', page: 'Page link', gallery: 'Gallery album', collection: 'Collection card', brand: 'Brand card', tag: 'Tag card', product: 'Product card',
};

export const HERO_CARD_SOURCES = {
  collection: { field: 'categorySlug', label: 'Category', path: 'category', fallback: 'Collection' },
  brand: { field: 'brandSlug', label: 'Brand', path: 'brands', fallback: 'Brand' },
  tag: { field: 'tagSlug', label: 'Tag', path: 'tags', fallback: 'Tag' },
  product: { field: 'productSlug', label: 'Product', path: 'products', fallback: 'Product' },
  blog: { field: 'blogSlug', label: 'Blog post', path: 'blogs', fallback: 'Blog post' },
  page: { field: 'pageSlug', label: 'Page', path: 'p', fallback: 'Page' },
  gallery: { field: 'gallerySlug', label: 'Gallery album', path: null, fallback: 'Gallery' },
};

const safeLink = (value) => /^(https?:\/\/|\/(?![\/\\]))/i.test(value || '') ? value : undefined;

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

const HeroBlock = ({ block, onSelect, catalog, product, depth = 0, onEnquiry }) => {
  if (depth > 3) return null;

  let content;
  switch (block.type) {
    case 'group':
      content = <Stack direction={{ xs: 'column', sm: block.direction || 'column' }} spacing={2} sx={{ '& > *': { flex: 1, minWidth: 0 } }}>
        {(block.children || []).map((child) => <HeroBlock key={child.id} block={child} onSelect={onSelect} catalog={catalog} product={product} onEnquiry={onEnquiry} depth={depth + 1} />)}
      </Stack>;
      break;
    case 'heading':
      content = <Typography component="h2" variant="h2" sx={{ overflowWrap: 'anywhere' }}>{block.text}</Typography>;
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
      const attribute = product?.attributes?.find((item) =>
        (item.attribute?.name || item.customName || '').toLowerCase() === (block.attributeName || '').toLowerCase());
      const value = attribute?.value
        ? formatAttributeValue(attribute.value, attribute.attribute)
        : attribute?.customValue;
      content = value ? <Typography>{block.prefix || ''}{value}{block.suffix || ''}</Typography> : null;
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

  const select = (event) => {
    event.stopPropagation();
    onSelect(block.id);
  };
  return (
    <Box
      onClick={onSelect ? select : undefined}
      sx={{ minWidth: 0, ...(onSelect && { cursor: 'pointer', '&:hover': { outline: '1px solid', outlineColor: 'primary.main' } }) }}
    >
      {content || (onSelect && <Typography color="text.secondary">{HERO_BLOCK_LABELS[block.type]}</Typography>)}
    </Box>
  );
};

const hasBinding = (blocks, type, key) => blocks.some((block) =>
  (block.type === type && block[key]) || hasBinding(block.children || [], type, key));

export default function ComposedHero({ section, onInlineBlockFocus, product, embedded = false }) {
  const blocks = section.heroBlocks || [];
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
      {blocks.map((block) => <HeroBlock key={block.id} block={block} onSelect={onSelect} catalog={catalog} product={product} onEnquiry={onEnquiry} />)}
      <EnquiryModal open={enquiryOpen} onClose={() => setEnquiryOpen(false)} product={product} />
    </Stack>
  );
}
