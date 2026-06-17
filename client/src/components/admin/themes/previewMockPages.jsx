/**
 * Mock page renderers for the StorefrontTemplatePreview.
 *
 * Each function receives a settings object and returns JSX that
 * approximates the real storefront page layout using the active
 * theme tokens.  These are used in the admin preview when the
 * section type is a system section (product-info, cart-main, etc.)
 * that has no dedicated section component yet.
 */
import {
  Box, Typography, Button, Grid, Chip, Divider, IconButton, Stack,
} from '@mui/material';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FilterListIcon from '@mui/icons-material/FilterList';

const getEditableSectionProps = (previewContext = {}) => {
  if (!previewContext.onSelectSection || !previewContext.section) return {};
  return {
    onClick: (event) => {
      event.stopPropagation();
      previewContext.onSelectSection(previewContext.section);
    },
    sx: {
      cursor: 'pointer',
      transition: 'outline-color 0.15s ease',
      '&:hover': { outline: '2px dashed #1976d2', outlineOffset: '-2px' },
    },
  };
};

// ─── Product Info ────────────────────────────────────────────────────────────

export const renderMockProductInfoOnly = (settingsObj, previewContext = {}) => {
  const pp = settingsObj?.productPage || {};
  const previewProduct = Array.isArray(previewContext.products) ? previewContext.products[0] : null;
  const productImages = previewProduct?.images || previewProduct?.media || previewProduct?.gallery || [];
  const firstImage = Array.isArray(productImages) ? productImages[0] : productImages;
  const productImageUrl = previewProduct?.imageUrl || previewProduct?.thumbnail || previewProduct?.featuredImage || firstImage?.url || firstImage?.src || firstImage;
  const formatPrice = (value) => {
    if (value == null || value === "") return null;
    if (typeof value === "string") return value.startsWith("$") ? value : "$" + value;
    if (typeof value === "number") return "$" + value.toFixed(2);
    return value?.formatted || value?.display || null;
  };
  const editableSectionSx = previewContext.onSelectSection ? {
    cursor: "pointer",
    transition: "outline-color 0.15s ease",
    "&:hover": { outline: "2px dashed #1976d2", outlineOffset: "-2px" },
  } : {};
  const handleSectionClick = (event) => {
    if (!previewContext.onSelectSection || !previewContext.section) return;
    event.stopPropagation();
    previewContext.onSelectSection(previewContext.section);
  };
  const addToCartLabel = pp.addToCartLabel || 'Add to Cart';
  const buyNowLabel = pp.buyNowLabel || 'Buy Now';
  const showBuyNowButton = pp.showBuyNowButton !== false;
  const imageAlignment = pp.imageAlignment === 'vertical' ? 'vertical' : 'horizontal';
  const productTemplateLayout = pp.templateLayout || 'media-left-details-right';

  const productTitle = previewProduct?.name || previewProduct?.title || "Elysian Silk Wrap Dress";
  const productPrice = formatPrice(previewProduct?.salePrice ?? previewProduct?.price) || "$245.00";
  const productBrand = previewProduct?.brand?.name || previewProduct?.brand || previewProduct?.vendor || "Studio Atelier";
  const productSku = previewProduct?.sku || previewProduct?.SKU || "SA-ELYS-SILK-02";
  const productDesc = previewProduct?.shortDescription || previewProduct?.description || "Indulge in pure luxury with the Elysian Silk Wrap Dress. Meticulously crafted from organic mulberry silk, this dress features a draped surplice neckline, an adjustable self-tie wrap closure, and elegant balloon sleeves with button cuffs. The soft, fluid drape creates a timeless silhouette perfect for both day and night.";

  const showBreadcrumbs = pp.showBreadcrumbs !== false;
  const showSku = pp.showSKU !== false;
  const showStockBadge = pp.showStockBadge !== false;

  const isGalleryTop = productTemplateLayout === 'gallery-top-details-below';
  const isStickyPanel = productTemplateLayout === 'sticky-purchase-panel';
  const isEditorial = ['luxury-editorial', 'editorial'].includes(productTemplateLayout);
  const isLuxury = productTemplateLayout === 'luxury-editorial';

  return (
    <Box onClick={handleSectionClick} sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto', bgcolor: 'background.default', ...editableSectionSx }}>
      {showBreadcrumbs && (
        <Box sx={{ display: 'flex', gap: 1, mb: 3, color: 'text.secondary', fontSize: '0.8rem' }}>
          <span>Home</span> <span>/</span> <span>Women</span> <span>/</span> <span>Dresses</span> <span>/</span> <span style={{ fontWeight: 600, color: 'var(--store-color-text)' }}>{productTitle}</span>
        </Box>
      )}

      <Grid container spacing={4}>
        {isGalleryTop ? (
          <>
            <Grid item xs={12}>
              <Box sx={{ width: '100%', height: 320, bgcolor: 'action.hover', borderRadius: 'var(--store-radius-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                {productImageUrl ? <Box component="img" src={productImageUrl} alt={productTitle} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Typography color="text.secondary">Main Image Showcase (Gallery Top)</Typography>}
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, justifyContent: 'center' }}>
                {[1, 2, 3, 4].map(i => (
                  <Box key={i} sx={{ width: 60, height: 60, borderRadius: 'var(--store-radius)', bgcolor: 'action.hover', border: '1px solid', borderColor: i === 1 ? 'primary.main' : 'divider', cursor: 'pointer' }} />
                ))}
              </Box>
            </Grid>

            <Grid item xs={12} md={8} sx={{ mx: 'auto', mt: 2 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1.5 }}>{productBrand}</Typography>
                <Typography variant="h4" component="h1" sx={{ mt: 0.5, mb: 1, fontWeight: 'var(--store-font-weight-heading)', fontFamily: 'var(--store-font-heading)' }}>{productTitle}</Typography>
                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" sx={{ mb: 1.5 }}>
                  {showStockBadge && <Chip label="In Stock" color="success" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }} />}
                  {showSku && <Typography variant="caption" color="text.secondary">{productSku}</Typography>}
                </Stack>
                <Typography variant="h5" color="primary.main" fontWeight={800} sx={{ mb: 2 }}>{productPrice}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 4 }}>{productDesc}</Typography>

              <Box sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', bgcolor: 'background.paper', mb: 4 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>Select Color</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      {['#e5d5c5', '#1e293b', '#64748b'].map((c, i) => (
                        <Box key={c} sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: c, border: i === 0 ? '2px solid' : '1px solid', borderColor: i === 0 ? 'primary.main' : 'divider', cursor: 'pointer' }} />
                      ))}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>Select Size</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      {['XS', 'S', 'M', 'L'].map((s, i) => (
                        <Box key={s} sx={{ px: 1.5, py: 0.5, border: '1px solid', borderColor: i === 1 ? 'primary.main' : 'divider', borderRadius: 'var(--store-radius)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: i === 1 ? 700 : 500, bgcolor: i === 1 ? 'primary.main' : 'transparent', color: i === 1 ? '#fff' : 'text.primary' }}>{s}</Box>
                      ))}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sx={{ mt: 1 }}>
                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" color="primary" fullWidth startIcon={<ShoppingBagOutlinedIcon />}>{addToCartLabel}</Button>
                      {showBuyNowButton && <Button variant="contained" color="secondary" fullWidth>{buyNowLabel}</Button>}
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </>
        ) : isStickyPanel ? (
          <>
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', flexDirection: imageAlignment === 'vertical' ? 'row' : 'column', gap: 1.5 }}>
                {imageAlignment === 'vertical' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {[1, 2, 3].map(i => (
                      <Box key={i} sx={{ width: 50, height: 50, borderRadius: 'var(--store-radius)', bgcolor: 'action.hover', border: '1px solid', borderColor: i === 1 ? 'primary.main' : 'divider' }} />
                    ))}
                  </Box>
                )}
                <Box sx={{ flex: 1, height: 320, bgcolor: 'action.hover', borderRadius: 'var(--store-radius-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'divider' }}>
                  {productImageUrl ? <Box component="img" src={productImageUrl} alt={productTitle} sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Typography color="text.secondary">Main Image</Typography>}
                </Box>
                {imageAlignment === 'horizontal' && (
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    {[1, 2, 3].map(i => (
                      <Box key={i} sx={{ width: 50, height: 50, borderRadius: 'var(--store-radius)', bgcolor: 'action.hover', border: '1px solid', borderColor: i === 1 ? 'primary.main' : 'divider' }} />
                    ))}
                  </Box>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="overline" color="text.secondary" fontWeight={700}>{productBrand}</Typography>
              <Typography variant="h4" component="h1" sx={{ mt: 0.5, mb: 1, fontWeight: 'var(--store-font-weight-heading)', fontFamily: 'var(--store-font-heading)' }}>{productTitle}</Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                {showStockBadge && <Chip label="In Stock" color="success" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }} />}
                {showSku && <Typography variant="caption" color="text.secondary">{productSku}</Typography>}
              </Stack>
              <Typography variant="h5" color="primary.main" fontWeight={800} sx={{ mb: 2 }}>{productPrice}</Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{productDesc}</Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', bgcolor: 'background.paper', position: 'sticky', top: 20 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Purchase Options</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>Select Color</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, mb: 2 }}>
                  {['#e5d5c5', '#1e293b'].map((c, i) => (
                    <Box key={c} sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: c, border: i === 0 ? '2px solid' : '1px solid', borderColor: i === 0 ? 'primary.main' : 'divider' }} />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>Select Size</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, mb: 2.5 }}>
                  {['S', 'M', 'L'].map((s, i) => (
                    <Box key={s} sx={{ px: 1.25, py: 0.25, border: '1px solid', borderColor: i === 1 ? 'primary.main' : 'divider', borderRadius: 'var(--store-radius)', fontSize: '0.7rem', fontWeight: i === 1 ? 700 : 500, bgcolor: i === 1 ? 'primary.main' : 'transparent', color: i === 1 ? '#fff' : 'text.primary' }}>{s}</Box>
                  ))}
                </Box>
                <Stack spacing={1}>
                  <Button variant="contained" color="primary" fullWidth size="small" startIcon={<ShoppingBagOutlinedIcon />}>{addToCartLabel}</Button>
                  {showBuyNowButton && <Button variant="contained" color="secondary" fullWidth size="small">{buyNowLabel}</Button>}
                </Stack>
              </Box>
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} md={isEditorial ? 7 : 6}>
              <Box sx={{ display: 'flex', flexDirection: imageAlignment === 'vertical' ? 'row' : 'column', gap: 2 }}>
                {imageAlignment === 'vertical' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {[1, 2, 3, 4].map(i => (
                      <Box key={i} sx={{ width: 60, height: 60, borderRadius: 'var(--store-radius)', bgcolor: 'action.hover', border: '1px solid', borderColor: i === 1 ? 'primary.main' : 'divider' }} />
                    ))}
                  </Box>
                )}
                <Box sx={{ flex: 1, height: isLuxury ? 400 : 350, bgcolor: 'action.hover', borderRadius: 'var(--store-radius-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                  {productImageUrl ? (
                    <Box component="img" src={productImageUrl} alt={productTitle} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Typography color="text.secondary" variant={isLuxury ? 'h6' : 'body1'} sx={{ fontStyle: isLuxury ? 'italic' : 'normal', fontFamily: isLuxury ? 'serif' : 'inherit' }}>
                      {isLuxury ? 'Luxury Editorial Showcase' : 'Main Product Image'}
                    </Typography>
                  )}
                </Box>
                {imageAlignment === 'horizontal' && (
                  <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
                    {[1, 2, 3, 4].map(i => (
                      <Box key={i} sx={{ width: 60, height: 60, borderRadius: 'var(--store-radius)', bgcolor: 'action.hover', border: '1px solid', borderColor: i === 1 ? 'primary.main' : 'divider' }} />
                    ))}
                  </Box>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={isEditorial ? 5 : 6}>
              <Box sx={{ pl: isEditorial ? { md: 2 } : 0 }}>
                <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1.5 }}>{productBrand}</Typography>
                <Typography variant={isLuxury ? 'h3' : 'h4'} component="h1" sx={{ mt: 0.5, mb: 1, fontWeight: isLuxury ? 400 : 'var(--store-font-weight-heading)', fontFamily: isLuxury ? 'serif' : 'var(--store-font-heading)' }}>{productTitle}</Typography>
                
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  {showStockBadge && <Chip label="In Stock" color="success" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }} />}
                  {showSku && <Typography variant="caption" color="text.secondary">{productSku}</Typography>}
                </Stack>

                <Typography variant="h5" color="primary.main" fontWeight={800} sx={{ mb: 3 }}>{productPrice}</Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>{productDesc}</Typography>
                
                <Divider sx={{ my: 3 }} />

                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>Select Color</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
                  {['#e5d5c5', '#1e293b', '#64748b'].map((c, i) => (
                    <Box key={c} sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: c, border: i === 0 ? '2px solid' : '1px solid', borderColor: i === 0 ? 'primary.main' : 'divider', cursor: 'pointer' }} />
                  ))}
                </Box>

                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>Select Size</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 4 }}>
                  {['XS', 'S', 'M', 'L'].map((s, i) => (
                    <Box key={s} sx={{ px: 1.5, py: 0.5, border: '1px solid', borderColor: i === 1 ? 'primary.main' : 'divider', borderRadius: 'var(--store-radius)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: i === 1 ? 700 : 500, bgcolor: i === 1 ? 'primary.main' : 'transparent', color: i === 1 ? '#fff' : 'text.primary' }}>{s}</Box>
                  ))}
                </Box>

                <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                  <Button variant="contained" color="primary" fullWidth size="large" startIcon={<ShoppingBagOutlinedIcon />}>{addToCartLabel}</Button>
                  {showBuyNowButton && <Button variant="contained" color="secondary" fullWidth size="large">{buyNowLabel}</Button>}
                </Stack>
              </Box>
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );
};

// ─── Product Reviews ─────────────────────────────────────────────────────────

export const renderMockReviews = () => (
  <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto', bgcolor: 'background.default' }}>
    <Box sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', bgcolor: 'background.paper' }}>
      <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>Customer Reviews</Typography>
      <Stack spacing={2}>
        {[
          { name: "Sarah M.", rating: 5, date: "2 weeks ago", comment: "Absolutely beautiful dress! The silk is so soft and it fits perfectly." },
          { name: "Jessica L.", rating: 4, date: "1 month ago", comment: "Very elegant. The sleeves are a bit long but overall I love it." }
        ].map((r, i) => (
          <Box key={i} sx={{ borderBottom: i === 0 ? '1px solid' : 'none', borderColor: 'divider', pb: i === 0 ? 2 : 0 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>{r.name}</Typography>
              <Typography variant="caption" color="text.secondary">{r.date}</Typography>
            </Stack>
            <Typography variant="body2" sx={{ mb: 1, color: 'primary.main' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Typography>
            <Typography variant="body2" color="text.secondary">{r.comment}</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  </Box>
);

// ─── Category Header ─────────────────────────────────────────────────────────

export const renderMockCategoryHeaderOnly = (settingsObj) => {
  const cp = settingsObj?.categoryPage || {};
  const headerLayout = cp.headerLayout || 'standard';
  const showSubcategories = cp.showSubcategories !== false;
  const catName = "Outerwear & Coats";

  const isCover = headerLayout === 'cover';
  const isSplit = headerLayout === 'split';

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      {isCover ? (
        <Box sx={{ bgcolor: 'primary.dark', color: '#fff', py: 8, px: 4, textAlign: 'center', backgroundImage: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url("https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=600")', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <Typography variant="h3" fontWeight={800} sx={{ mb: 1, fontFamily: 'var(--store-font-heading)' }}>{catName}</Typography>
          <Typography variant="body2" sx={{ maxWidth: 600, opacity: 0.9 }}>Elevate your cold-weather style with our premium selection of tailored coats, utility jackets, and waterproof layers.</Typography>
        </Box>
      ) : isSplit ? (
        <Box sx={{ bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider', p: 4 }}>
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography variant="h3" fontWeight={800} sx={{ mb: 2, fontFamily: 'var(--store-font-heading)' }}>{catName}</Typography>
              <Typography variant="body1" color="text.secondary">Elevate your cold-weather style with our premium selection of tailored coats, utility jackets, and waterproof layers. Crafted from wool blends and technical fabrics to keep you warm and stylish.</Typography>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ width: '100%', height: 160, borderRadius: 'var(--store-radius-card)', bgcolor: 'divider', display: 'grid', placeItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">Category Banner Image</Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Box sx={{ p: 4, textAlign: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h3" fontWeight={800} sx={{ mb: 1.5, fontFamily: 'var(--store-font-heading)' }}>{catName}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>Elevate your cold-weather style with our premium selection of tailored coats, utility jackets, and waterproof layers.</Typography>
        </Box>
      )}

      {showSubcategories && (
        <Box sx={{ py: 2, px: 4, display: 'flex', gap: 1, overflowX: 'auto', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          {['All Outerwear', 'Trench Coats', 'Wool Coats', 'Puffer Jackets', 'Leather Jackets'].map((s, i) => (
            <Chip key={s} label={s} clickable color={i === 0 ? 'primary' : 'default'} size="small" variant={i === 0 ? 'filled' : 'outlined'} />
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Category Products ───────────────────────────────────────────────────────

export const renderMockCategoryProductsOnly = () => (
  <Box sx={{ p: 4, bgcolor: 'background.default' }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>8 Products Found</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="outlined" startIcon={<FilterListIcon />}>Filters</Button>
        <Button size="small" variant="outlined">Sort: Recommended</Button>
      </Box>
    </Stack>

    <Grid container spacing={3}>
      {[
        { title: "Draped Wool Trench Coat", price: "$345.00" },
        { title: "Quilted Puffer Jacket", price: "$220.00" },
        { title: "Classic Moto Leather Jacket", price: "$295.00" },
        { title: "Double-Breasted Overcoat", price: "$380.00" }
      ].map((p, idx) => (
        <Grid item xs={12} sm={6} md={3} key={idx}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', p: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ aspectRatio: '3/4', bgcolor: 'action.hover', borderRadius: 'var(--store-radius)', display: 'grid', placeItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Product Image</Typography>
            </Box>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }} noWrap>{p.title}</Typography>
            <Typography variant="body2" color="primary.main" fontWeight={800}>{p.price}</Typography>
          </Box>
        </Grid>
      ))}
    </Grid>
  </Box>
);

// ─── Catalog Header ──────────────────────────────────────────────────────────

export const renderMockCatalogHeaderOnly = () => (
  <Box sx={{ p: 4, pb: 0, bgcolor: 'background.default' }}>
    <Typography variant="h4" fontWeight={800} sx={{ mb: 2, fontFamily: 'var(--store-font-heading)' }}>All Products</Typography>
  </Box>
);

// ─── Catalog Products ────────────────────────────────────────────────────────

export const renderMockCatalogProductsOnly = (settingsObj) => {
  const cat = settingsObj?.catalog || {};
  const showFilters = cat.showFilters !== false;
  const gridColumns = Number(cat.gridColumns) || 4;
  const showCategoryIcon = cat.showCategoryIcon !== false;
  const priceRangeMax = cat.priceRangeMax || 2000;
  const defaultSort = cat.defaultSort || 'recommended';

  const colWidth = 12 / gridColumns;

  return (
    <Box sx={{ p: 4, pt: 2, bgcolor: 'background.default' }}>
      <Grid container spacing={3}>
        {showFilters && (
          <Grid item xs={12} md={3}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>Filters</Typography>
              
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>Categories</Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>
                {['New In', 'Apparel', 'Accessories', 'Footwear'].map((c, i) => (
                  <Stack key={c} direction="row" alignItems="center" justifyContent="space-between" sx={{ fontSize: '0.85rem', cursor: 'pointer', color: i === 1 ? 'primary.main' : 'text.primary', fontWeight: i === 1 ? 700 : 500 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {showCategoryIcon && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: i === 1 ? 'primary.main' : 'action.disabled', opacity: 0.7 }} />}
                      <span>{c}</span>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">(14)</Typography>
                  </Stack>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>Price Range</Typography>
              <Box sx={{ px: 1, py: 1 }}>
                <Box sx={{ height: 4, bgcolor: 'divider', borderRadius: 2, position: 'relative', mb: 2 }}>
                  <Box sx={{ position: 'absolute', left: '10%', right: '60%', height: '100%', bgcolor: 'primary.main', borderRadius: 2 }} />
                  <Box sx={{ position: 'absolute', left: '10%', top: -4, width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main', border: '2px solid #fff' }} />
                  <Box sx={{ position: 'absolute', right: '40%', top: -4, width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main', border: '2px solid #fff' }} />
                </Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">$0</Typography>
                  <Typography variant="caption" fontWeight={700}>Max: ${priceRangeMax}</Typography>
                </Stack>
              </Box>
            </Box>
          </Grid>
        )}

        <Grid item xs={12} md={showFilters ? 9 : 12}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>Showing 6 of 36 Products</Typography>
            <Button size="small" variant="outlined">Sort: {defaultSort}</Button>
          </Stack>

          <Grid container spacing={3}>
            {[
              { title: "Casual Ribbed Dress", price: "$95.00" },
              { title: "Modern Cotton Tote Bag", price: "$60.00" },
              { title: "Minimalist Leather Sandals", price: "$120.00" },
              { title: "Lightweight Wool Knit", price: "$145.00" },
              { title: "Cropped Denim Jacket", price: "$110.00" },
              { title: "Silk Evening Skirt", price: "$165.00" }
            ].slice(0, showFilters ? 6 : 8).map((p, idx) => (
              <Grid item xs={12} sm={6} md={colWidth} key={idx}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', p: 1.5, bgcolor: 'background.paper' }}>
                  <Box sx={{ aspectRatio: '3/4', bgcolor: 'action.hover', borderRadius: 'var(--store-radius)', display: 'grid', placeItems: 'center', mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Product Image</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }} noWrap>{p.title}</Typography>
                  <Typography variant="body2" color="primary.main" fontWeight={800}>{p.price}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

// ─── Brands Header ───────────────────────────────────────────────────────────

export const renderMockBrandsHeaderOnly = (settingsObj) => {
  const bp = settingsObj?.brandsPage || {};
  const title = bp.heroTitle || 'Shop by Brand';
  const subtitle = bp.heroSubtitle || 'Discover products grouped by your favorite brands.';

  return (
    <Box sx={{ p: 4, pb: 0, bgcolor: 'background.default' }}>
      <Box sx={{ textAlign: 'center', maxWidth: 760, mx: 'auto', mb: 2 }}>
        <Typography variant="h3" fontWeight={800} sx={{ fontFamily: 'var(--store-font-heading)', mb: 1 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      </Box>
    </Box>
  );
};

// ─── Brands List ─────────────────────────────────────────────────────────────

export const renderMockBrandsListOnly = (settingsObj) => {
  const bp = settingsObj?.brandsPage || {};
  const columns = Number(bp.gridColumns) || 4;
  const cardLayout = bp.cardLayout || 'standard';
  const showDescriptions = bp.showDescriptions !== false;
  const showProductCount = bp.showProductCount === true;
  const showAlphabeticalFilter = bp.showAlphabeticalFilter !== false;
  const colWidth = 12 / columns;
  const brands = ['NOVA Studio', 'ATLAS Goods', 'AURA Living', 'MONO Lab', 'LUXE Atelier', 'CRAFT House', 'FRESH Market', 'CORE Supply'];

  return (
    <Box sx={{ p: 4, pt: 2, bgcolor: 'background.default' }}>
      {showAlphabeticalFilter && (
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 4, flexWrap: 'wrap', gap: 1 }}>
          {['All', 'A', 'C', 'F', 'L', 'M', 'N'].map((letter, index) => (
            <Chip key={letter} label={letter} color={index === 0 ? 'primary' : 'default'} variant={index === 0 ? 'filled' : 'outlined'} size="small" />
          ))}
        </Stack>
      )}

      <Grid container spacing={3}>
        {brands.map((brand, index) => (
          <Grid item xs={12} sm={6} md={colWidth} key={brand}>
            <Box sx={{
              height: '100%',
              p: cardLayout === 'minimal' ? 2 : 0,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 'var(--store-radius-card)',
              bgcolor: 'background.paper',
              overflow: 'hidden',
              boxShadow: 'var(--store-shadow-soft)',
              textAlign: cardLayout === 'minimal' ? 'center' : 'left',
            }}>
              <Box sx={{
                height: cardLayout === 'minimal' ? 72 : 150,
                bgcolor: 'action.hover',
                display: 'grid',
                placeItems: 'center',
                background: cardLayout === 'overlay' ? 'linear-gradient(135deg, var(--store-color-primary), var(--store-color-secondary))' : undefined,
              }}>
                <Typography variant="h5" fontWeight={950} color={cardLayout === 'overlay' ? '#fff' : 'primary.main'}>{brand.slice(0, 2).toUpperCase()}</Typography>
              </Box>
              <Box sx={{ p: cardLayout === 'minimal' ? 0 : 2 }}>
                <Typography variant="subtitle1" fontWeight={900}>{brand}</Typography>
                {showDescriptions && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Curated products and signature collections.</Typography>}
                {showProductCount && <Chip label={`${12 + index} products`} size="small" variant="outlined" sx={{ mt: 1 }} />}
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

// ─── Blog Header ─────────────────────────────────────────────────────────────

export const renderMockBlogHeaderOnly = () => (
  <Box sx={{ p: 4, pb: 0, maxWidth: 1000, mx: 'auto', bgcolor: 'background.default' }}>
    <Typography variant="h3" fontWeight={800} sx={{ mb: 2, textAlign: 'center', fontFamily: 'var(--store-font-heading)' }}>Our Blog & Insights</Typography>
  </Box>
);

// ─── Blog Posts ──────────────────────────────────────────────────────────────

export const renderMockBlogPostsOnly = (settingsObj) => {
  const bp = settingsObj?.blogPage || {};
  const listLayout = bp.listLayout || 'grid';
  const showDate = bp.showDate !== false;
  const showAuthor = bp.showAuthor !== false;

  const posts = [
    { title: "Spring/Summer Palette: Organic Textures & Tones", author: "Sarah Jenkins", date: "May 28, 2026", excerpt: "Explore the new seasonal direction focused on earthy palettes, sustainable flax linens, and structural draping that moves with you." },
    { title: "The Silk Care Guide: Preserving Organic Sheen", author: "David Vance", date: "April 15, 2026", excerpt: "Learn the proper methods to clean, steam, and store your mulberry silk garments to ensure their long life and signature luster." },
    { title: "Designing the Perfect Capsule Wardrobe", author: "Eliza Thorne", date: "March 10, 2026", excerpt: "Find simplicity in curation. We outline the 10 essential base layers and statement outerwear needed for effortless daily pairing." }
  ];

  return (
    <Box sx={{ p: 4, pt: 2, maxWidth: 1000, mx: 'auto', bgcolor: 'background.default' }}>
      {listLayout === 'grid' ? (
        <Grid container spacing={3}>
          {posts.map((post, idx) => (
            <Grid item xs={12} md={4} key={idx}>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', overflow: 'hidden', bgcolor: 'background.paper', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ height: 160, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
                  <ArticleOutlinedIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                </Box>
                <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Stack direction="row" spacing={1.5} sx={{ mb: 1, color: 'text.secondary', fontSize: '0.75rem' }}>
                    {showDate && <span>{post.date}</span>}
                    {showAuthor && showDate && <span>•</span>}
                    {showAuthor && <span>By {post.author}</span>}
                  </Stack>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, lineHeight: 1.3 }}>{post.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>{post.excerpt}</Typography>
                  <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mt: 'auto' }}>Read Article <KeyboardArrowRightIcon fontSize="inherit" /></Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Stack spacing={3}>
          {posts.map((post, idx) => (
            <Box key={idx} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', overflow: 'hidden', bgcolor: 'background.paper', p: 2 }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={4}>
                  <Box sx={{ height: 140, bgcolor: 'action.hover', borderRadius: 'var(--store-radius)', display: 'grid', placeItems: 'center' }}>
                    <ArticleOutlinedIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Stack direction="row" spacing={1.5} sx={{ mb: 1, color: 'text.secondary', fontSize: '0.75rem' }}>
                    {showDate && <span>{post.date}</span>}
                    {showAuthor && showDate && <span>•</span>}
                    {showAuthor && <span>By {post.author}</span>}
                  </Stack>
                  <Typography variant="h5" fontWeight={700} sx={{ mb: 1, fontFamily: 'var(--store-font-heading)' }}>{post.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{post.excerpt}</Typography>
                  <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Read Article <KeyboardArrowRightIcon fontSize="inherit" /></Typography>
                </Grid>
              </Grid>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

// ─── Account Main ────────────────────────────────────────────────────────────

export const renderMockAccountMain = (settingsObj) => {
  const accountPage = settingsObj?.accountPage || {};
  const useSidebarLayout = accountPage.layout === 'sidebar';
  const showSupportInfo = accountPage.showSupportInfo === true;
  const tabs = ['Profile', 'Addresses', 'Password', 'Security'];

  return (
    <Box sx={{ p: 4, maxWidth: 1000, mx: 'auto', bgcolor: 'background.default' }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 3, fontFamily: 'var(--store-font-heading)' }}>My Account</Typography>
      <Box sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 'var(--store-radius-card)',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        display: useSidebarLayout ? { xs: 'block', md: 'grid' } : 'block',
        gridTemplateColumns: useSidebarLayout ? '220px minmax(0, 1fr)' : undefined,
      }}>
        <Stack
          direction={useSidebarLayout ? { xs: 'row', md: 'column' } : 'row'}
          spacing={0}
          sx={{
            borderRight: useSidebarLayout ? { md: '1px solid' } : 0,
            borderBottom: useSidebarLayout ? { xs: '1px solid', md: 0 } : '1px solid',
            borderColor: 'divider',
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab, index) => (
            <Box key={tab} sx={{ px: 2.5, py: 1.5, bgcolor: index === 0 ? 'action.hover' : 'transparent', color: index === 0 ? 'primary.main' : 'text.primary', fontWeight: 800, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {tab}
            </Box>
          ))}
        </Stack>
        <Box sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', fontWeight: 900 }}>JD</Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={900}>Jordan Doe</Typography>
              <Typography variant="caption" color="text.secondary">jordan@example.com</Typography>
            </Box>
          </Stack>
          <Grid container spacing={2}>
            {['First Name', 'Last Name', 'Phone'].map((field) => (
              <Grid item xs={12} md={field === 'Phone' ? 12 : 6} key={field}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius)', px: 1.5, py: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">{field}</Typography>
                  <Typography variant="body2" fontWeight={700}>{field === 'Phone' ? '+1 555 0100' : field.replace(' Name', '')}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Button variant="contained" sx={{ mt: 3 }}>Save Changes</Button>
        </Box>
      </Box>
      {showSupportInfo && (
        <Box sx={{ mt: 3, p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', bgcolor: 'background.paper' }}>
          <Typography variant="subtitle1" fontWeight={800}>Need help?</Typography>
          <Typography variant="body2" color="text.secondary">Contact support from your order details page or registered email.</Typography>
        </Box>
      )}
    </Box>
  );
};

// ─── Cart Main ───────────────────────────────────────────────────────────────

export const renderMockCartMain = (settingsObj, previewContext = {}) => {
  const cp = settingsObj?.cartPage || {};
  const layout = cp.layout || 'standard';
  const isStacked = layout === 'stacked';
  const showCoupon = cp.showCoupon === true;
  const showSavings = cp.showSavings === true;
  const showShippingEstimator = cp.showShippingEstimator === true;
  const showOrderNotes = cp.showOrderNotes === true;
  const showRecentlyViewed = cp.showRecentlyViewed === true;
  const checkoutLabel = cp.checkoutLabel || 'Proceed to Checkout';
  const editableProps = getEditableSectionProps(previewContext);

  const items = [
    { title: 'Elysian Silk Wrap Dress', price: '$245.00', desc: 'Color: Sand / Size: S', qty: 1 },
    { title: 'Tailored Linen Trousers', price: '$179.00', desc: 'Color: Navy / Size: M', qty: 2 },
  ];

  return (
    <Box onClick={editableProps.onClick} sx={{ p: { xs: 2, md: 4 }, maxWidth: 1080, mx: 'auto', bgcolor: 'background.default', ...(editableProps.sx || {}) }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 4, fontFamily: 'var(--store-font-heading)' }}>Shopping Cart</Typography>
      <Grid container spacing={4}>
        <Grid item xs={12} md={isStacked ? 12 : 8}>
          <Stack spacing={2.5}>
            {items.map((item, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 2, pb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ width: 80, height: 100, bgcolor: 'action.hover', borderRadius: 'var(--store-radius)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Typography variant="caption" color="text.secondary">Item</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle2" fontWeight={700}>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{item.desc}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                    <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider' }}><RemoveIcon fontSize="inherit" /></IconButton>
                    <Typography variant="body2" sx={{ px: 1 }}>{item.qty}</Typography>
                    <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider' }}><AddIcon fontSize="inherit" /></IconButton>
                    <Box sx={{ flexGrow: 1 }} />
                    <Button size="small" color="error">Remove</Button>
                  </Stack>
                </Box>
                <Typography variant="body2" fontWeight={800} sx={{ alignSelf: 'flex-start' }}>{item.price}</Typography>
              </Box>
            ))}
          </Stack>
          {showOrderNotes && (
            <Box sx={{ mt: 3, p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Order notes</Typography>
              <Box sx={{ height: 74, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius)', bgcolor: 'background.default' }} />
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={isStacked ? 12 : 4}>
          <Box sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', bgcolor: 'background.paper', position: isStacked ? 'static' : 'sticky', top: 20 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>Order Summary</Typography>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Subtotal</Typography><Typography fontWeight={700}>$603.00</Typography></Stack>
              {showSavings && <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Savings</Typography><Typography color="success.main" fontWeight={700}>-$42.00</Typography></Stack>}
              <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Shipping</Typography><Typography color="success.main" fontWeight={700}>Free</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Estimated Tax</Typography><Typography fontWeight={700}>$48.24</Typography></Stack>
            </Stack>
            {showCoupon && <Box sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius)', px: 1.5, py: 1 }}><Typography variant="caption" color="text.secondary">Discount code</Typography></Box>}
            {showShippingEstimator && <Box sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius)', px: 1.5, py: 1 }}><Typography variant="caption" color="text.secondary">Shipping estimator</Typography></Box>}
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={800}>Total</Typography>
              <Typography variant="subtitle2" fontWeight={800} color="primary.main">$651.24</Typography>
            </Stack>
            <Button variant="contained" color="primary" fullWidth size="large">{checkoutLabel}</Button>
          </Box>
        </Grid>
      </Grid>
      {showRecentlyViewed && <Box sx={{ mt: 5 }}><Typography variant="h6" fontWeight={800}>Recently viewed</Typography></Box>}
    </Box>
  );
};

// ─── Checkout Main ───────────────────────────────────────────────────────────

export const renderMockCheckoutMain = (settingsObj, previewContext = {}) => {
  const cp = settingsObj?.checkoutPage || {};
  const layout = cp.layout || 'two-column';
  const isOneColumn = layout === 'one-column' || layout === 'accordion';
  const showOrderSummary = cp.showOrderSummary !== false;
  const allowGuestCheckout = cp.allowGuestCheckout !== false;
  const showCoupon = cp.showCoupon === true;
  const showShippingStep = cp.showShippingStep !== false;
  const showOrderNotes = cp.showOrderNotes === true;
  const paymentHeading = cp.paymentHeading || 'Payment';
  const placeOrderLabel = cp.placeOrderLabel || 'Place Order';
  const editableProps = getEditableSectionProps(previewContext);

  const panelSx = { p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', bgcolor: 'background.paper' };

  return (
    <Box onClick={editableProps.onClick} sx={{ p: { xs: 2, md: 4 }, maxWidth: 1080, mx: 'auto', bgcolor: 'background.default', ...(editableProps.sx || {}) }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 4, fontFamily: 'var(--store-font-heading)' }}>Checkout</Typography>
      <Grid container spacing={4}>
        <Grid item xs={12} md={showOrderSummary && !isOneColumn ? 7 : 12}>
          <Stack spacing={layout === 'accordion' ? 1.5 : 3}>
            <Box sx={panelSx}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>Contact</Typography>
              {allowGuestCheckout && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>Guest checkout enabled</Typography>}
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius)', px: 1.5, py: 1.25 }}>
                <Typography variant="caption" color="text.secondary">Email</Typography>
                <Typography variant="body2" fontWeight={700}>jordan@example.com</Typography>
              </Box>
            </Box>
            {showShippingStep && (
              <Box sx={panelSx}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>Shipping Address</Typography>
                <Grid container spacing={2}>
                  {['First Name', 'Last Name', 'Address', 'City', 'Postcode'].map((f, i) => (
                    <Grid item xs={12} sm={i < 2 ? 6 : 12} key={f}>
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius)', px: 1.5, py: 1.25 }}>
                        <Typography variant="caption" color="text.secondary">{f}</Typography>
                        <Box sx={{ height: 14, bgcolor: 'action.hover', borderRadius: 1, mt: 0.5, width: i % 2 === 0 ? '70%' : '55%' }} />
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
            <Box sx={panelSx}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>{paymentHeading}</Typography>
              <Stack spacing={1.5}>
                {['Credit / Debit Card', 'PayPal', 'Bank Transfer'].map((m, i) => (
                  <Box key={m} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, border: '1px solid', borderColor: i === 0 ? 'primary.main' : 'divider', borderRadius: 'var(--store-radius)', bgcolor: i === 0 ? 'action.selected' : 'transparent' }}>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid', borderColor: i === 0 ? 'primary.main' : 'divider', display: 'grid', placeItems: 'center' }}>{i === 0 && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />}</Box>
                    <Typography variant="body2" fontWeight={i === 0 ? 700 : 500}>{m}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
            {showCoupon && <Box sx={panelSx}><Typography variant="subtitle2" fontWeight={800}>Discount code</Typography></Box>}
            {showOrderNotes && <Box sx={panelSx}><Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Order notes</Typography><Box sx={{ height: 70, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius)' }} /></Box>}
            <Button variant="contained" color="primary" fullWidth size="large">{placeOrderLabel}</Button>
          </Stack>
        </Grid>
        {showOrderSummary && (
          <Grid item xs={12} md={isOneColumn ? 12 : 5}>
            <Box sx={{ ...panelSx, position: isOneColumn ? 'static' : 'sticky', top: 20 }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>Order Summary</Typography>
              {[{ title: 'Elysian Silk Wrap Dress', price: '$245.00', qty: 1 }, { title: 'Tailored Linen Trousers', price: '$179.00', qty: 2 }].map((item, i) => (
                <Stack key={i} direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
                  <Box sx={{ width: 52, height: 64, bgcolor: 'action.hover', borderRadius: 'var(--store-radius)', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="caption" fontWeight={700}>{item.title}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Qty: {item.qty}</Typography></Box>
                  <Typography variant="caption" fontWeight={800}>{item.price}</Typography>
                </Stack>
              ))}
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1}>{[['Subtotal', '$424.00'], ['Shipping', 'Free'], ['Tax', '$33.92']].map(([k, v]) => (<Stack key={k} direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">{k}</Typography><Typography variant="caption" fontWeight={700} color={k === 'Shipping' ? 'success.main' : 'text.primary'}>{v}</Typography></Stack>))}</Stack>
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" justifyContent="space-between"><Typography variant="subtitle2" fontWeight={800}>Total</Typography><Typography variant="subtitle2" fontWeight={800} color="primary.main">$457.92</Typography></Stack>
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

// ─── Wishlist Main ───────────────────────────────────────────────────────────

export const renderMockWishlistMain = () => (
  <Box sx={{ p: 4, maxWidth: 1000, mx: 'auto', bgcolor: 'background.default' }}>
    <Typography variant="h4" fontWeight={800} sx={{ mb: 1, fontFamily: 'var(--store-font-heading)' }}>My Wishlist</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>3 saved items</Typography>
    <Grid container spacing={3}>
      {[
        { title: 'Elysian Silk Wrap Dress', price: '$245.00', badge: 'In Stock' },
        { title: 'Tailored Linen Trousers', price: '$179.00', badge: 'In Stock' },
        { title: 'Structured Wool Coat', price: '$345.00', badge: 'Low Stock' },
      ].map((item, idx) => (
        <Grid item xs={12} sm={4} key={idx}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', p: 1.5, bgcolor: 'background.paper', position: 'relative' }}>
            <Box sx={{ aspectRatio: '3/4', bgcolor: 'action.hover', borderRadius: 'var(--store-radius)', display: 'grid', placeItems: 'center', mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Product Image</Typography>
            </Box>
            <Chip label={item.badge} size="small" color={item.badge === 'Low Stock' ? 'warning' : 'success'} variant="outlined" sx={{ position: 'absolute', top: 12, left: 12, height: 20, fontSize: '0.68rem', fontWeight: 800 }} />
            <Typography variant="body2" fontWeight={700} noWrap sx={{ mb: 0.5 }}>{item.title}</Typography>
            <Typography variant="body2" color="primary.main" fontWeight={800} sx={{ mb: 1.5 }}>{item.price}</Typography>
            <Button variant="contained" fullWidth size="small" startIcon={<ShoppingBagOutlinedIcon />}>Add to Cart</Button>
          </Box>
        </Grid>
      ))}
    </Grid>
  </Box>
);

// ─── Search Main ─────────────────────────────────────────────────────────────

export const renderMockSearchMain = (settingsObj) => {
  const sp = settingsObj?.searchPage || {};
  const gridColumns = Number(sp.gridColumns) || 4;
  const showFilters = sp.showFilters !== false;
  const showSortBar = sp.showSortBar !== false;
  const showResultCount = sp.showResultCount !== false;
  const searchPlaceholder = sp.searchPlaceholder || 'silk dress';
  const noResultsMessage = sp.noResultsMessage || 'No products found for your search.';
  const xs = gridColumns >= 4 ? 3 : gridColumns === 3 ? 4 : 6;

  const mockProducts = [
    { title: 'Elysian Silk Wrap Dress', price: '$245.00' },
    { title: 'Silk Evening Slip Dress', price: '$198.00' },
    { title: 'Satin Bias-Cut Midi Dress', price: '$165.00' },
    { title: 'Silk Charmeuse Blouse', price: '$120.00' },
  ].slice(0, gridColumns);

  return (
    <Box sx={{ p: 4, maxWidth: 1100, mx: 'auto', bgcolor: 'background.default' }}>
      <Box sx={{ mb: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Box sx={{ flex: 1, border: '1px solid', borderColor: 'primary.main', borderRadius: 'var(--store-radius)', px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.paper' }}>
          <FilterListIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
          <Typography variant="body2" color="text.secondary">{searchPlaceholder}</Typography>
        </Box>
        <Button variant="contained" size="medium">Search</Button>
      </Box>
      {(showResultCount || showSortBar) && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          {showResultCount && <Typography variant="caption" color="text.secondary" fontWeight={700}>12 results for "{searchPlaceholder}"</Typography>}
          {showSortBar && <Button size="small" variant="outlined">Sort: Relevance</Button>}
        </Stack>
      )}
      <Box sx={{ display: 'flex', gap: 3 }}>
        {showFilters && (
          <Box sx={{ width: 180, flexShrink: 0 }}>
            <Typography variant="caption" fontWeight={800} sx={{ mb: 1.5, display: 'block' }}>Filter by</Typography>
            {['Category', 'Price', 'Brand', 'Size'].map((f) => (
              <Box key={f} sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">{f}</Typography>
              </Box>
            ))}
          </Box>
        )}
        <Grid container spacing={2} sx={{ flex: 1 }}>
          {mockProducts.length ? mockProducts.map((p, idx) => (
            <Grid item xs={12} sm={xs} key={idx}>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', p: 1.5, bgcolor: 'background.paper' }}>
                <Box sx={{ aspectRatio: '3/4', bgcolor: 'action.hover', borderRadius: 'var(--store-radius)', display: 'grid', placeItems: 'center', mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Product Image</Typography>
                </Box>
                <Typography variant="body2" fontWeight={700} noWrap sx={{ mb: 0.5 }}>{p.title}</Typography>
                <Typography variant="body2" color="primary.main" fontWeight={800}>{p.price}</Typography>
              </Box>
            </Grid>
          )) : (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>{noResultsMessage}</Typography>
            </Grid>
          )}
        </Grid>
      </Box>
    </Box>
  );
};

// ─── Not Found Main ──────────────────────────────────────────────────────────

export const renderMockNotFoundMain = (settingsObj) => {
  const nfp = settingsObj?.notFoundPage || {};
  const headline  = nfp.headline  || 'Page Not Found';
  const subtext   = nfp.subtext   || "Sorry, the page you're looking for doesn't exist or has been moved.";
  const cta1Label = nfp.cta1Label || 'Browse Products';
  const cta2Label = nfp.cta2Label || 'Go Home';
  return (
    <Box sx={{ p: { xs: 4, md: 8 }, textAlign: 'center', maxWidth: 560, mx: 'auto', bgcolor: 'background.default' }}>
      <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'action.hover', mx: 'auto', mb: 3, display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ fontSize: 36 }}>🔍</Typography>
      </Box>
      <Typography variant="h2" fontWeight={900} color="text.disabled" sx={{ mb: 1, fontFamily: 'var(--store-font-heading)', letterSpacing: '-2px' }}>404</Typography>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 1.5, fontFamily: 'var(--store-font-heading)' }}>{headline}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>{subtext}</Typography>
      <Stack direction="row" spacing={2} justifyContent="center">
        <Button variant="contained" color="primary" startIcon={<ShoppingBagOutlinedIcon />}>{cta1Label}</Button>
        <Button variant="outlined">{cta2Label}</Button>
      </Stack>
    </Box>
  );
};

// ─── Orders Main ─────────────────────────────────────────────────────────────

export const renderMockOrdersMain = (settingsObj) => {
  const op = settingsObj?.ordersPage || {};
  const showStatusBadge = op.showStatusBadge !== false;
  const showTotal       = op.showTotal !== false;
  const emptyHeadline  = op.emptyHeadline || "You haven't placed any orders yet";
  const emptyCtaLabel  = op.emptyCtaLabel || 'Start Shopping';

  const mockOrders = [
    { id: '#ORD-10042', date: 'May 28, 2026', status: 'Delivered',   color: 'success', items: 3, total: '$312.00' },
    { id: '#ORD-10038', date: 'May 14, 2026', status: 'Shipped',     color: 'info',    items: 1, total: '$89.00'  },
    { id: '#ORD-10031', date: 'Apr 30, 2026', status: 'Processing',  color: 'warning', items: 2, total: '$178.50' },
  ];

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: 'auto', bgcolor: 'background.default' }}>
      <Typography variant="h6" fontWeight={800} sx={{ mb: 3, fontFamily: 'var(--store-font-heading)' }}>My Orders</Typography>
      <Stack spacing={2}>
        {mockOrders.map((order) => (
          <Box
            key={order.id}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 'var(--store-radius-card)',
              p: 2,
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 140 }}>
              <Typography variant="body2" fontWeight={800}>{order.id}</Typography>
              <Typography variant="caption" color="text.secondary">{order.date} · {order.items} item{order.items > 1 ? 's' : ''}</Typography>
            </Box>
            {showStatusBadge && (
              <Chip label={order.status} size="small" color={order.color} variant="outlined" sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }} />
            )}
            {showTotal && (
              <Typography variant="body2" fontWeight={800} color="primary.main">{order.total}</Typography>
            )}
            <Button size="small" variant="outlined" endIcon={<KeyboardArrowRightIcon />}>View</Button>
          </Box>
        ))}
      </Stack>

      {/* Empty state preview */}
      <Box sx={{ mt: 5, p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 'var(--store-radius-card)', bgcolor: 'action.hover' }}>
        <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ display: 'block', mb: 1 }}>Empty State Preview</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{emptyHeadline}</Typography>
        <Button variant="contained" size="small">{emptyCtaLabel}</Button>
      </Box>
    </Box>
  );
};

// ─── Section type → renderer map ─────────────────────────────────────────────

export const SECTION_TYPE_TO_MOCK_RENDERER = {
  'product-info':      (s, c) => renderMockProductInfoOnly(s, c),
  'product-reviews':   (s, c) => renderMockReviews(s, c),
  'category-header':   (s) => renderMockCategoryHeaderOnly(s),
  'category-products': (s, c) => renderMockCategoryProductsOnly(s, c),
  'catalog-header':    ()  => renderMockCatalogHeaderOnly(),
  'catalog-products':  (s) => renderMockCatalogProductsOnly(s),
  'brands-header':     (s) => renderMockBrandsHeaderOnly(s),
  'brands-list':       (s) => renderMockBrandsListOnly(s),
  'blog-header':       (s, c) => renderMockBlogHeaderOnly(s, c),
  'blog-posts':        (s) => renderMockBlogPostsOnly(s),
  'account-main':      (s) => renderMockAccountMain(s),
  'cart-main':         (s, c) => renderMockCartMain(s, c),
  'checkout-main':     (s, c) => renderMockCheckoutMain(s, c),
  'wishlist-main':     ()  => renderMockWishlistMain(),
  'search-main':       (s) => renderMockSearchMain(s),
  'not-found-main':    (s) => renderMockNotFoundMain(s),
  'orders-main':       (s) => renderMockOrdersMain(s),
};
