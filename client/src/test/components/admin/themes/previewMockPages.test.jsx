import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  renderMockCartMain,
  renderMockCatalogHeaderOnly,
  renderMockCatalogProductsOnly,
  renderMockCategoryHeaderOnly,
  renderMockCategoryProductsOnly,
  renderMockCheckoutMain,
  renderMockOrdersMain,
  renderMockProductInfoOnly,
} from '../../../../components/admin/themes/previewMockPages';

describe('store designer sample page previews', () => {
  it('keeps purchase controls inline when the sticky panel is disabled', () => {
    render(renderMockProductInfoOnly({ productPage: {
      templateLayout: 'sticky-purchase-panel',
      showStickyAddToCart: false,
      addToCartLabel: 'Add to basket',
      buyNowLabel: 'Buy this item',
    } }));

    expect(screen.queryByText('Purchase Options')).not.toBeInTheDocument();
    expect(screen.getByText('Select Size')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to basket' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy this item' })).toBeInTheDocument();
  });

  it('shows the configured category fallback title and subcategory visibility', () => {
    render(renderMockCategoryHeaderOnly({
      categoryPage: { heroTitle: 'Seasonal picks', headerLayout: 'split', showSubcategories: false },
    }));

    expect(screen.getByText('Seasonal picks')).toBeInTheDocument();
    expect(screen.queryByText('All Outerwear')).not.toBeInTheDocument();
  });

  it('honors collection breadcrumbs, filter placement, and compact list layout', () => {
    render(<>
      {renderMockCatalogHeaderOnly({ catalog: { showBreadcrumbs: false } })}
      {renderMockCatalogProductsOnly({ catalog: {
        showFilters: true,
        filterLayout: 'topbar',
        templateLayout: 'compact-b2b-list',
        gridColumns: 3,
      } })}
    </>);

    expect(screen.queryByText('Home / Products')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Category' })).toBeInTheDocument();
    expect(screen.queryByText('Filters', { selector: 'h6' })).not.toBeInTheDocument();
    expect(screen.getByText('Casual Ribbed Dress')).toBeInTheDocument();
  });

  it('uses the Cart empty message and hides trust badges when disabled', () => {
    render(renderMockCartMain({ cartPage: {
      layout: 'compact',
      showTrustBadges: false,
      emptyStateText: 'Your basket is empty.',
    } }));

    expect(screen.getByText('Your basket is empty.')).toBeInTheDocument();
    expect(screen.queryByText('Secure checkout')).not.toBeInTheDocument();
  });

  it('shows Cart trust badges when enabled', () => {
    render(renderMockCartMain({ cartPage: { showTrustBadges: true } }));

    expect(screen.getByText('Secure checkout')).toBeInTheDocument();
  });

  it('shows the configured Checkout labels in the sample page', () => {
    render(renderMockCheckoutMain({ checkoutPage: {
      paymentHeading: 'Choose a payment method',
      placeOrderLabel: 'Confirm purchase',
    } }));

    expect(screen.getByText('Choose a payment method')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm purchase' })).toBeInTheDocument();
  });

  it('shows the configured Orders empty-state content in the sample page', () => {
    render(renderMockOrdersMain({ ordersPage: {
      emptyHeadline: 'No purchases yet',
      emptyCtaLabel: 'Explore the shop',
    } }));

    expect(screen.getByText('No purchases yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explore the shop' })).toBeInTheDocument();
  });

  it('shows Category drawer filters as a sidebar on desktop', () => {
    render(renderMockCategoryProductsOnly({ catalog: {
      showFilters: true,
      filterLayout: 'drawer',
      categoryDepth: 2,
    } }));

    expect(screen.getByText('Categories · 2 levels')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
  });

  it('shows Category drawer filters as a button on mobile', () => {
    render(renderMockCategoryProductsOnly({ catalog: {
      showFilters: true,
      filterLayout: 'drawer',
      categoryDepth: 2,
    } }, { previewMode: 'mobile' }));

    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.queryByText('Categories · 2 levels')).not.toBeInTheDocument();
  });
});
