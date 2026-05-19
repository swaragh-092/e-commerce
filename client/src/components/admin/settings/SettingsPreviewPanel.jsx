import { Box, Divider, Typography } from '@mui/material';

const bool = (value) => value !== false && value !== 'false' && value !== '0';

const SettingsPreviewPanel = ({
  currentTab,
  form,
  previewStyles,
  themeMode,
  textColor,
  storeName,
  previewHeaderBackground,
  headerStyle,
  previewCardSx,
  storeDescription,
  previewButtonSx,
  brandSecondary,
  announcementEnabled,
  brandPrimary,
  stickyHeader,
  showCategoryBar,
  footerEnabled,
  surfaceColor,
  borderRadius,
  footerTagline,
  footerShowLinks,
  links,
  primaryHeroSlide,
  heroTextColor,
  heroTitle,
  heroSubtitle,
  heroButtonText,
  homepageSections,
  homepageSectionTypes,
  showProductSku,
  showStockBadge,
  showBuyNowButton,
  addToCartLabel,
  buyNowLabel,
  formatMoney,
  taxInclusive,
  guestCheckoutEnabled,
  couponsEnabled,
  showSaleLabelBadge,
  saleLabel,
  showDiscountPercentBadge,
  showSavingsAmount,
  showSaleTiming,
  showCountdown,
}) => {
    const previewContainerSx = {
      ...previewStyles,
      p: 2,
      border: '1px solid',
      borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      overflow: 'hidden',
      boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
    };

    if (currentTab === 'Store' || currentTab === 'Branding') {
      return (
        <Box sx={previewContainerSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>Storefront Header</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: textColor }}>{storeName}</Typography>
            </Box>
            {form['logo.main'] ? (
              <Box component="img" src={form['logo.main']} alt="Logo" sx={{ maxWidth: 72, maxHeight: 36, objectFit: 'contain' }} />
            ) : (
              <Box sx={{ px: 1.5, py: 0.75, background: previewHeaderBackground, color: headerStyle === 'glass' ? textColor : '#fff', borderRadius: 2, fontWeight: 700 }}>Logo</Box>
            )}
          </Box>
          <Box sx={{ ...previewCardSx, p: 2, mb: 2 }}>
            <Typography variant="body2" sx={{ color: textColor, fontWeight: 600 }}>{storeDescription}</Typography>
            <Typography variant="caption" sx={{ color: themeMode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}>
              {form['general.contactEmail'] || 'hello@store.com'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ flex: 1, p: 1.5, ...previewButtonSx, textAlign: 'center', fontWeight: 700 }}>Primary</Box>
            <Box sx={{ flex: 1, p: 1.5, bgcolor: brandSecondary, color: '#fff', borderRadius: 2, textAlign: 'center', fontWeight: 700 }}>Accent</Box>
          </Box>
        </Box>
      );
    }

    if (currentTab === 'Layout') {
      return (
        <Box sx={previewContainerSx}>
          {announcementEnabled && (
            <Box sx={{ mb: 1.5, px: 1.5, py: 1, bgcolor: form['announcement.bgColor'] || brandPrimary, color: form['announcement.fgColor'] || '#fff', borderRadius: 2, fontSize: 12, textAlign: 'center' }}>
              {form['announcement.text'] || 'Free shipping on orders over $50!'}
            </Box>
          )}
          <Box sx={{ ...previewCardSx, p: 1.5, mb: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>{storeName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {stickyHeader ? 'Sticky header enabled' : 'Standard header'} • {showCategoryBar ? 'Category bar visible' : 'Category bar hidden'}
            </Typography>
          </Box>
          {footerEnabled && (
            <Box sx={{ mt: 2, p: 2, bgcolor: form['footer.bgColor'] || surfaceColor, color: form['footer.fgColor'] || textColor, borderRadius: `${borderRadius}px`, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700}>{storeName}</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{footerTagline}</Typography>
              {footerShowLinks && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1.5 }}>
                  {(links.slice(0, 3).map((link) => link.label).filter(Boolean).join(' • ')) || 'Home • Products • Cart'}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      );
    }

    if (currentTab === 'Homepage') {
      return (
        <Box sx={previewContainerSx}>
          <Box
            sx={{
              p: 2.5,
              borderRadius: `${borderRadius + 4}px`,
              color: primaryHeroSlide.color || heroTextColor,
              background: primaryHeroSlide.image
                ? `linear-gradient(rgba(0,0,0,0.52), rgba(0,0,0,0.52)), url(${primaryHeroSlide.image}) center/cover`
                : `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})`,
            }}
          >
            {primaryHeroSlide.eyebrow && (
              <Typography variant="caption" fontWeight={800} sx={{ color: 'inherit', opacity: 0.9 }}>
                {primaryHeroSlide.eyebrow}
              </Typography>
            )}
            <Typography variant="h6" fontWeight={800} sx={{ color: 'inherit' }}>{primaryHeroSlide.title || heroTitle}</Typography>
            <Typography variant="body2" sx={{ color: 'inherit', opacity: 0.9, mt: 0.75, mb: 2 }}>{primaryHeroSlide.subtitle || heroSubtitle}</Typography>
            <Box sx={{ display: 'inline-block', px: 1.5, py: 0.9, ...previewButtonSx, fontWeight: 700, fontSize: 13 }}>
              {primaryHeroSlide.buttonText || heroButtonText}
            </Box>
          </Box>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {homepageSections.filter((item) => item.type !== 'hero-carousel' && bool(item.enabled)).slice(0, 7).map((item) => (
              <Box key={item.id}>
                <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                  {item.title || homepageSectionTypes.find((type) => type.value === item.type)?.label || item.type}
                </Typography>
                <Box sx={{
                  display: item.type === 'value-props' || item.type === 'brand-showcase' ? 'flex' : 'grid',
                  gridTemplateColumns: item.type === 'category-shortcuts' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                  gap: 1,
                }}>
                  {Array.from({ length: item.type === 'value-props' || item.type === 'brand-showcase' ? 4 : item.type === 'category-shortcuts' ? 3 : 2 }).map((_, i) => (
                    <Box key={i} sx={{ height: item.type === 'brand-showcase' ? 22 : item.type === 'category-shortcuts' ? 40 : 58, flex: 1, bgcolor: surfaceColor, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      );
    }

    if (currentTab === 'Catalog') {
      return (
        <Box sx={previewContainerSx}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1.5 }}>Catalog Card Preview</Typography>
          <Box sx={{ p: 1.5, bgcolor: surfaceColor, borderRadius: `${borderRadius}px`, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ height: 120, borderRadius: 2, background: `linear-gradient(135deg, ${brandPrimary}22, ${brandSecondary}33)`, mb: 1.5 }} />
            <Typography variant="body2" fontWeight={700}>Everyday Essential Tee</Typography>
            {showProductSku && (
              <Typography variant="caption" color="text.secondary">SKU: TSHIRT-RED-M</Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5 }}>
              <Typography variant="body2" fontWeight={700}>{formatMoney(49.99)}</Typography>
              {showStockBadge && (
                <Box sx={{ px: 1, py: 0.4, borderRadius: 999, bgcolor: '#2e7d3220', color: '#2e7d32', fontSize: 11, fontWeight: 700 }}>In Stock</Box>
              )}
            </Box>
            <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: showBuyNowButton ? '1fr 1fr' : '1fr', gap: 1 }}>
              <Box sx={{ px: 1.25, py: 0.9, bgcolor: brandPrimary, color: '#fff', borderRadius: 2, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                {addToCartLabel}
              </Box>
              {showBuyNowButton && (
                <Box sx={{ px: 1.25, py: 0.9, border: '1px solid', borderColor: brandPrimary, color: brandPrimary, borderRadius: 2, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                  {buyNowLabel}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      );
    }

    if (currentTab === 'Checkout') {
      const shippingValue = form['shipping.method'] === 'free'
        ? 0
        : Number(form['shipping.flatRate'] || 5);
      const taxRate = Number(form['tax.rate'] || 0);
      const subtotal = 89.99;
      const taxAmount = taxInclusive ? 0 : subtotal * taxRate;
      const total = subtotal + shippingValue + taxAmount;

      return (
        <Box sx={previewContainerSx}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1.5 }}>Checkout Summary</Typography>
          <Box sx={{ p: 2, bgcolor: surfaceColor, borderRadius: `${borderRadius}px`, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Order #Preview</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}><Typography variant="body2">Subtotal</Typography><Typography variant="body2">{formatMoney(subtotal)}</Typography></Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}><Typography variant="body2">Shipping</Typography><Typography variant="body2">{shippingValue === 0 ? 'Free' : formatMoney(shippingValue)}</Typography></Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}><Typography variant="body2">Tax</Typography><Typography variant="body2">{taxInclusive ? 'Included' : formatMoney(taxAmount)}</Typography></Box>
            <Divider sx={{ my: 1.25 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="subtitle2" fontWeight={800}>Total</Typography><Typography variant="subtitle2" fontWeight={800}>{formatMoney(total)}</Typography></Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {guestCheckoutEnabled ? 'Guest checkout enabled' : 'Account required'} • {couponsEnabled ? 'Coupons available' : 'Coupons hidden'}
          </Typography>
        </Box>
      );
    }

    if (currentTab === 'Promotions') {
      return (
        <Box sx={previewContainerSx}>
          <Box sx={{ p: 2, bgcolor: surfaceColor, borderRadius: `${borderRadius}px`, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.25 }}>
              {showSaleLabelBadge && (
                <Box sx={{ px: 1, py: 0.4, borderRadius: 999, bgcolor: `${brandSecondary}22`, color: brandSecondary, fontSize: 11, fontWeight: 700 }}>
                  {saleLabel}
                </Box>
              )}
              {showDiscountPercentBadge && (
                <Box sx={{ px: 1, py: 0.4, borderRadius: 999, bgcolor: `${brandPrimary}22`, color: brandPrimary, fontSize: 11, fontWeight: 700 }}>
                  25% OFF
                </Box>
              )}
            </Box>
            <Typography variant="body2" fontWeight={700}>Wireless Headphones</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1 }}>
              <Typography variant="h6" fontWeight={800}>{formatMoney(149.99)}</Typography>
              <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>{formatMoney(199.99)}</Typography>
            </Box>
            {showSavingsAmount && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>You save {formatMoney(50)}</Typography>
            )}
            {Boolean(form['sales.showTiming']) || Boolean(form['sales.showSaleTiming']) ? null : null}
            {showSaleTiming && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Ends tomorrow at 11:59 PM</Typography>
            )}
            {showCountdown && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: brandSecondary, fontWeight: 700 }}>Ending soon • 08h 24m left</Typography>
            )}
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={previewContainerSx}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1.5 }}>Search & Discovery Preview</Typography>
        <Box sx={{ p: 2, bgcolor: surfaceColor, borderRadius: `${borderRadius}px`, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">Search result</Typography>
          <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>{storeName} | Premium online shopping experience</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{form['seo.defaultDescription'] || 'Shop the best products online at unbeatable prices.'}</Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: brandPrimary }}>
            {form['seo.googleAnalyticsId'] || 'Analytics not connected yet'}
          </Typography>
        </Box>
      </Box>
    );
  };

export default SettingsPreviewPanel;
