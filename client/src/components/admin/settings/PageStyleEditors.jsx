import React from 'react';
import { getDesignPageControlSchema } from '../../../utils/designRegistry';
import { DesignSchemaFields } from '../themes/designer/DesignSchemaFields';

// ─── PRODUCT DETAIL PAGE EDITOR ──────────────────────────────────────────────
export const ProductPageStyleEditor = ({ value = {}, onChange }) => {
  return (
    <DesignSchemaFields
      schema={getDesignPageControlSchema('product')}
      value={value}
      onChange={onChange}
    />
  );
};

// ─── CATEGORY DETAIL PAGE EDITOR ─────────────────────────────────────────────
export const CategoryPageStyleEditor = ({ value = {}, onChange }) => {
  return <DesignSchemaFields schema={getDesignPageControlSchema('category')} value={value} onChange={onChange} />;
};

// ─── CATALOG / COLLECTION PAGE EDITOR ────────────────────────────────────────
export const CatalogPageStyleEditor = ({ value = {}, onChange }) => {
  return <DesignSchemaFields schema={getDesignPageControlSchema('collection')} value={value} onChange={onChange} />;
};

// ─── BLOG PAGE EDITOR ────────────────────────────────────────────────────────
export const BlogPageStyleEditor = ({ value = {}, onChange }) => {
  return <DesignSchemaFields schema={getDesignPageControlSchema('blog')} value={value} onChange={onChange} />;
};


// ─── BRANDS PAGE EDITOR ─────────────────────────────────────────────────────
export const BrandsPageStyleEditor = ({ value = {}, onChange }) => {
  return <DesignSchemaFields schema={getDesignPageControlSchema('brand')} value={value} onChange={onChange} />;
};


// ─── ACCOUNT PAGE EDITOR ───────────────────────────────────────────────────
export const AccountPageStyleEditor = ({ value = {}, onChange }) => {
  return <DesignSchemaFields schema={getDesignPageControlSchema('account')} value={value} onChange={onChange} />;
};


// ─── CART PAGE EDITOR ─────────────────────────────────────────────────────────
export const CartPageStyleEditor = ({ value = {}, onChange }) => {
  return <DesignSchemaFields schema={getDesignPageControlSchema('cart')} value={value} onChange={onChange} />;
};


// ─── CHECKOUT PAGE EDITOR ─────────────────────────────────────────────────────
export const CheckoutPageStyleEditor = ({ value = {}, onChange }) => {
  return <DesignSchemaFields schema={getDesignPageControlSchema('checkout')} value={value} onChange={onChange} />;
};


// ─── SEARCH PAGE EDITOR ───────────────────────────────────────────────────────
export const SearchPageStyleEditor = ({ value = {}, onChange }) => {
  return <DesignSchemaFields schema={getDesignPageControlSchema('search')} value={value} onChange={onChange} />;
};


// ─── 404 PAGE EDITOR ──────────────────────────────────────────────────────────
export const NotFoundPageStyleEditor = ({ value = {}, onChange }) => {
  return <DesignSchemaFields schema={getDesignPageControlSchema('not-found')} value={value} onChange={onChange} />;
};


// ─── ORDERS PAGE EDITOR ───────────────────────────────────────────────────────
export const OrdersPageStyleEditor = ({ value = {}, onChange }) => {
  return <DesignSchemaFields schema={getDesignPageControlSchema('orders')} value={value} onChange={onChange} />;
};
