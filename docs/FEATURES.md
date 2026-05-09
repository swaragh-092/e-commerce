# Table of Contents
### For Business & Admin Users
1. [Platform Overview](#1-platform-overview)
2. [Admin Features](#2-admin-features)
3. [Customer-Facing Features](#3-customer-facing-features)
4. [Feature Flag Matrix](#4-feature-flag-matrix)
5. [Permissions Matrix](#5-permissions-matrix)
### For Developers
6. [Technical Architecture](#6-technical-architecture)
---
# Part 1: Business & Admin Documentation
## 1. Platform Overview
### What Is This Platform?
This is a **complete, production-ready e-commerce platform** that can operate in two modes:
| Mode | Purpose |
|------|---------|
| **E-Commerce Mode** | Full shopping experience — customers can browse, add to cart, checkout, pay, and track orders |
| **Catalog Mode** | Browse-only product showcase — customers can view products but cannot purchase (enquiries instead) |
### Key Design Principles
- **White-Label Ready** — Fully customizable branding, colors, fonts, and layouts
- **Config-First** — Almost everything is controlled through settings, no code changes needed
- **Audit-Ready** — Every admin action is logged with before/after diffs
- **Security-Hardened** — Encrypted credentials, rate limiting, brute-force protection
---
## 2. Admin Features
### 2.1 Dashboard & Analytics
**What It Does:** Central command center showing real-time store metrics.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **KPI Cards** | Revenue, total orders, customer count, product count at a glance |
| **Sales Chart** | Visual sales trends — view by daily, weekly, monthly, yearly, or custom date range |
| **Recent Orders** | Latest orders with status badges and quick actions |
| **Low Stock Alerts** | Products running low on inventory |
| **Inventory Warnings** | Health indicators for stock levels |
| **Operations Summary** | Operational metrics (pending orders, failed payments, etc.) |
| **Store Health** | Real-time checklist for system issues (failed payments, inventory warnings, configuration gaps) |
**Customization:**
- Choose layout density: Balanced, Analytics-focused, or Compact
- Widget registry — enable/disable individual widgets
- Drag-and-drop widget ordering
- Widgets auto-hide based on admin permissions (you only see what you're allowed to see)
---
### 2.2 Product Management
**What It Does:** Complete product catalog management with variants, media, and inventory control.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Product CRUD** | Create, view, edit, delete products |
| **DataGrid View** | Sortable, filterable product table with search |
| **Quick-Edit Dialog** | Update stock, price, sale status, or active status without opening full editor |
| **Bulk Actions** | Apply sale or delete multiple products at once |
| **CSV Export** | Download product data as spreadsheet |
| **Media Gallery** | Upload, reorder, and manage product images |
| **Category Assignment** | Assign products to one or more categories |
| **Brand Assignment** | Link products to brands |
| **Attribute Assignment** | Configure product-specific attributes (e.g., material, warranty) |
| **Variant Management** | Create variants (size, color, etc.) with unique SKUs, prices, stock, and dimensions |
| **Bulk Variant Generate** | Auto-generate all variant combinations from attribute options |
| **Clone Variants** | Duplicate existing variant settings to save time |
| **SKU Auto-Generation** | Automatic SKU creation based on configurable prefix, separator, and format |
| **Sale Scheduling** | Set sale start/end dates and sale prices |
| **SEO Fields** | Per-product meta title, meta description, and Open Graph tags |
| **Volumetric Dimensions** | Set length, width, height for accurate shipping calculations |
| **Product Enable/Disable** | Toggle product visibility without deleting |
| **Rating Cache** | Auto-cached average rating displayed on product cards |
| **Tags** | Flexible tagging system for product grouping |
**Customer-Facing Impact:**
- Customers see product details, images, variants, prices, sale badges, availability
- Variant selector shows only in-stock options
- Sale countdown timer for scheduled sales
- SEO-optimized product pages
---
### 2.3 Category Management
**What It Does:** Hierarchical product categorization system.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Tree View** | Visual hierarchical category structure |
| **Table/List Views** | Alternative flat views for large category sets |
| **Breadcrumb Navigation** | Navigate deep category hierarchies easily |
| **Parent-Child Relationships** | Nest categories to any depth |
| **Image Upload** | Category banner/thumbnail images |
| **Auto-Slug Generation** | URL-friendly slugs created automatically |
| **Category-Attribute Linking** | Define which attributes apply to products in a category (with inheritance) |
**Customer-Facing Impact:**
- Customers browse categories in navigation
- Category-specific product listings
- Horizontal category navigation bar (configurable)
---
### 2.4 Brand Management
**What It Does:** Brand directory for product organization and customer filtering.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Brand CRUD** | Create, edit, delete brands |
| **Logo Upload** | Brand logo images |
| **Active/Inactive Toggle** | Show or hide brands from storefront |
| **DataGrid View** | Sortable, searchable brand list |
**Customer-Facing Impact:**
- Brand filter on product listing page
- Brand strip on homepage (configurable)
---
### 2.5 Order Management
**What It Does:** End-to-end order lifecycle management.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Order DataGrid** | Sortable, filterable order table with status summary cards |
| **Status Updates** | Move orders through workflow: `pending_payment` → `confirmed` → `processing` → `shipped` → `delivered` |
| **Fulfillment Creation** | Create shipments with shipping provider selection |
| **Refund Management** | Initiate and track refunds from admin interface |
| **COD Confirmation** | Confirm Cash on Delivery orders |
| **Order Detail View** | Full order breakdown: items, pricing, tax, discounts, customer info, address |
| **Progress Tracker** | Visual order status timeline |
| **Invoice Generation** | Printable order invoices with tax breakdown and store branding |
| **Order Search** | Search orders by ID, customer, status |
| **Customer Cancel Override** | View and manage customer-initiated cancellations |
**Order Status Workflow:**
pending_payment → confirmed → processing → shipped → delivered
                     ↓
                  cancelled
                     ↓
                  refunded
**Customer-Facing Impact:**
- Customers see order progress tracker
- Customers can cancel from allowed statuses
- Customers download/print invoices
- Customers view order history with search and filters
---
### 2.6 Customer Management
**What It Does:** View and manage registered customers.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Customer DataGrid** | Sortable, searchable customer list |
| **View Customer Details** | Profile information, order history, addresses |
| **Ban/Unban** | Block or restore customer access |
| **Status Management** | Update customer account status |
---
### 2.7 Coupon & Discount Engine
**What It Does:** Create and manage promotional codes and discounts.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Coupon CRUD** | Create, edit, delete coupons |
| **Discount Types** | Flat amount, percentage, free shipping |
| **Usage Limits** | Set total usage limit and per-user usage limit |
| **Date Range** | Set start and expiry dates |
| **Product Targeting** | Apply coupon to specific products |
| **Category Targeting** | Apply coupon to products in specific categories |
| **Brand Targeting** | Apply coupon to products from specific brands |
| **Stacking Rules** | Configure whether coupons can be combined with other coupons or discounts |
| **Exclusive Coupons** | Mark coupons that cannot be used with any other offer |
| **Usage Tracking** | View how many times each coupon has been used |
| **Duplicate Coupon** | Clone existing coupon for quick creation |
| **Auto-Deactivation** | Expired coupons are automatically disabled (daily job) |
**Customer-Facing Impact:**
- Customers apply coupon codes at cart or checkout
- Free shipping progress bar in cart
- Coupon validation feedback (valid/invalid/expired)
- Available coupons shown at checkout (if enabled)
---
### 2.8 Payment Gateway Management
**What It Does:** Configure and manage payment providers.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Supported Gateways** | Razorpay, Stripe, Cashfree, PayU, Cash on Delivery (COD) |
| **Enable/Disable** | Toggle each gateway on or off |
| **API Key Management** | Store API keys and secrets (encrypted with AES-256-GCM) |
| **Show/Hide Secrets** | Toggle visibility of sensitive credentials |
| **Test Mode** | Switch gateways between test and production mode |
| **Webhook Monitoring** | Track webhook events with idempotency (prevents double-processing) |
**Security:**
- All API keys stored encrypted at rest
- Credentials auto-masked when displayed to admins
- Webhook signature verification
**Customer-Facing Impact:**
- Customers see available payment methods at checkout
- Razorpay/Stripe SDK loaded dynamically for payment processing
- Payment success/failure pages with retry options
---
### 2.9 Shipping & Fulfillment
**What It Does:** Comprehensive shipping rate calculation, carrier integration, and shipment tracking.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Shipping Providers** | Configure Shiprocket, Ekart, or manual shipping |
| **Provider Capabilities** | Enable COD, returns, reverse pickup, heavy/fragile item support per provider |
| **Shipping Zones** | Define zones by country, state, city, or pincode prefixes |
| **Blocked Pincodes** | Block delivery to specific pincode ranges |
| **Shipping Rules** | Create rules based on weight, price, location, payment method |
| **Rate Types** | Free, flat rate, free above threshold, per-kg slab, volumetric, percent of order |
| **COD Fee** | Configure COD surcharge as flat amount or percentage |
| **Fuel Surcharge** | Add percentage-based fuel surcharge on freight |
| **Delivery Estimates** | Set estimated delivery days per rule |
| **Rule Priority** | Rules evaluated by priority (higher priority wins) |
| **Volumetric Weight** | Industry-standard volumetric calculation (L × B × H / divisor) |
| **Multi-Package Splitting** | Auto-splits orders exceeding 20kg into multiple packages |
| **Shipment Management** | Create, track, and cancel shipments |
| **AWB Generation** | Auto-generate air waybill numbers from carriers |
| **Label Printing** | Download shipping labels |
| **Tracking URLs** | Customer-visible tracking links |
| **Webhook Integration** | Real-time tracking updates from carriers (Shiprocket) |
| **Shipment Events** | Log all carrier tracking events with deduplication |
| **Rule Change History** | Audit trail for shipping rule modifications |
**Shipping Zone Detection (India):**
| Zone | Detection Rule |
|------|---------------|
| Same City | First 4 digits of pincode match |
| Same State | First 2 digits of pincode match |
| Remote | North East India (78-79, 83) or J&K (19) |
| National | All other pincodes (default) |
**Customer-Facing Impact:**
- Shipping cost calculated at checkout
- Serviceability check by pincode
- Shipping quote locked for 10 minutes during checkout
- Tracking information on order detail page
- Delivery estimates shown at checkout
---
### 2.10 Tax Configuration
**What It Does:** Configure tax rules for products and orders.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Indian GST** | Automatic SGST + CGST (intra-state) or IGST (inter-state) |
| **Flat Rate** | Simple percentage-based tax |
| **Per-Product Tax** | Override global tax settings for specific products |
| **Inclusive Tax** | Prices include tax (no additional tax at checkout) |
| **Exclusive Tax** | Tax added on top of displayed prices |
| **Tax Breakdown** | Item-level and order-level tax summaries on invoices |
**Customer-Facing Impact:**
- Tax calculated and displayed at checkout
- Tax breakdown visible on order invoices
- Inclusive/exclusive mode affects displayed prices
---
### 2.11 Reviews & Moderation
**What It Does:** Product review system with admin moderation workflow.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Review DataGrid** | View all reviews with status filters |
| **Moderation Workflow** | Approve, reject, or delete reviews |
| **Status Filters** | Filter by pending, approved, or rejected |
| **Purchase Verification** | See if reviewer actually purchased the product |
| **Rate Limiting** | Customers limited to 5 reviews per day |
**Customer-Facing Impact:**
- Star rating display on product cards and detail pages
- Review submission form on product pages
- Review list with ratings and comments
- Only verified purchasers can review (if enabled)
---
### 2.12 Media Library
**What It Does:** Centralized file management for all images and media.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Upload Files** | Drag-and-drop file upload |
| **Grid/List Views** | Browse media in visual or tabular format |
| **File Information** | View size, format, dimensions |
| **Delete Files** | Remove unused media |
| **Copy URL** | Quick copy media URL to clipboard |
| **Storage Statistics** | Total storage usage and file count |
| **Supported Formats** | JPEG, PNG, WebP, GIF (SVG rejected for security) |
| **File Size Limit** | 5MB default (configurable) |
---
### 2.13 CMS Pages
**What It Does:** Create and manage static content pages (About, Terms, Privacy, etc.).
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Page CRUD** | Create, edit, delete pages |
| **Rich Text Editor** | WYSIWYG editor (Quill) with formatting toolbar |
| **Visual/Code Toggle** | Switch between visual editor and raw HTML |
| **Publish/Draft** | Toggle page visibility |
| **Link Position** | Place page link in header, footer, or neither |
| **Slug Management** | URL-friendly page identifiers |
| **Hero Image Picker** | Select hero banner from media library |
| **SEO Fields** | Per-page meta title, description, noindex control |
| **View on Storefront** | Direct link to published page |
**Customer-Facing Impact:**
- Static pages accessible at `/p/:slug`
- Page links in header/footer navigation (if configured)
---
### 2.14 SEO Management
**What It Does:** Control search engine visibility and social media previews.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Global SEO Defaults** | Site-wide meta title, description, OG image |
| **Per-Entity SEO** | Product-level and page-level meta tags |
| **URL Overrides** | Override SEO for any URL path |
| **Canonical URLs** | Automatic canonical URL generation with manual override |
| **Noindex Control** | Prevent specific pages from being indexed |
| **Social Previews** | Rich Open Graph tags for social media sharing |
| **Google Snippet Preview** | Real-time preview of how page appears in Google search results |
| **Dynamic OG Tags** | Auto-generated social tags with product price and availability |
**SEO Resolution Hierarchy:**
1. URL Override (highest priority)
2. Entity SEO (product/page-specific)
3. Global Defaults (lowest priority)
---
### 2.15 Settings & Customization
**What It Does:** Centralized configuration for every aspect of the store.
**Features Available to Admin — 21 Setting Groups:**
| Group | What It Controls |
|-------|-----------------|
| **General** | Store name, currency, contact information, timezone |
| **Theme** | Primary/secondary colors, fonts, border radius, button style, card style, header style, background style |
| **Homepage** | Section toggles (hero, categories, new arrivals, featured, best sellers, on-sale, brands), section titles, item counts |
| **Catalog** | Default sort order, grid columns, page size, filter visibility |
| **Product Page** | Layout options, image zoom, review display |
| **Sales** | Sale scheduling settings, sale label configuration |
| **SKU** | SKU format: prefix, separator, random characters, uppercase/lowercase |
| **Announcement** | Announcement bar text, enable/disable |
| **Navigation** | Show/hide category bar, navigation link positions |
| **Admin** | Dashboard widget configuration, layout density |
| **Messaging** | Email (SMTP) settings, Twilio SMS/WhatsApp settings |
| **Shipping** | Default shipping rates, free shipping threshold |
| **Tax** | GST rates (CGST/SGST/IGST), origin state |
| **Payments** | Gateway-specific settings |
| **Features** | Feature flag toggles (wishlist, reviews, etc.) |
| **Logo** | Store logo selection |
| **Hero** | Homepage hero section configuration |
| **Footer** | Footer links, social media links, copyright text |
| **Invoice** | Invoice header, terms, footer text |
| **Gateway Credentials** | Encrypted payment gateway API keys |
| **Messaging Credentials** | Encrypted SMTP/Twilio credentials |
**Security:**
- Credential groups auto-encrypted with AES-256-GCM
- Sensitive values auto-masked (passwords, tokens, secrets)
- Tier 1 features cannot be modified via API
- Tier 2 features require Super Admin access
---
### 2.16 Feature Flags & Toggles
**What It Does:** Enable or disable platform features without code changes.
**Two-Tier System:**
| Tier | Description | Features |
|------|-------------|----------|
| **Tier 1 (Mode-Locked)** | Cannot be overridden — controlled by platform mode (ecommerce vs catalog) | Pricing, Cart, Checkout, Orders, Payments, Shipping |
| **Tier 2 (Admin-Controlled)** | Can be toggled by admins (Super Admin required) | Wishlist, Reviews, Coupons, Guest Checkout, SEO, Email Verification, Require Purchase for Review, Show Available Coupons, Multi-Currency, Social Login, Enquiry, Show Price |
**Feature Flag Behavior:**
- Tier 1 features are **always on** in ecommerce mode and **always off** in catalog mode
- Tier 2 features have per-mode defaults and can be overridden in settings
- Routes, UI components, and API endpoints automatically respect feature flags
- Invalid feature settings fail closed (feature is disabled)
---
### 2.17 Access Control & Roles (RBAC)
**What It Does:** Granular permission-based access control for admin staff.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Role Management** | Create, edit, delete custom roles |
| **Permission Checkboxes** | Visual permission assignment interface |
| **System Roles** | Predefined roles that cannot be modified (Customer, Admin, Super Admin) |
| **Custom Roles** | Create roles with specific permission sets |
| **Role Inheritance** | Permissions can be inherited from parent roles |
| **User-Role Assignment** | Assign one or more roles to admin users |
| **Super Admin Protection** | Reserved permissions that only super admins can have |
| **Permission-Based UI** | Dashboard widgets and admin menu items auto-hide based on permissions |
**Available Permission Categories:**
| Category | Permissions |
|----------|------------|
| Products | `products.read`, `products.manage` |
| Categories | `categories.read`, `categories.manage` |
| Orders | `orders.read`, `orders.manage` |
| Customers | `customers.read`, `customers.manage` |
| Reviews | `reviews.read`, `reviews.manage` |
| Media | `media.read`, `media.manage` |
| Settings | `settings.read`, `settings.manage` |
| Pages | `pages.read`, `pages.manage` |
| Roles | `roles.read`, `roles.manage` |
| Audit | `audit.read` |
| Notifications | `notifications.read`, `notifications.manage` |
| Coupons | `coupons.read`, `coupons.manage` |
---
### 2.18 Audit Logs
**What It Does:** Track every administrative action for accountability and debugging.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Action Logging** | Every create, update, delete action is recorded |
| **Value Diffing** | Old and new values stored as JSONB diffs |
| **Security Events** | Login attempts, permission changes, sensitive data access |
| **Entity Tracking** | Filter logs by entity (Products, Orders, Settings, Users, etc.) |
| **Action Tracking** | Filter logs by action type (CREATE, UPDATE, DELETE, LOGIN, etc.) |
| **User Attribution** | Each log linked to the user who performed the action |
| **DataGrid View** | Sortable, filterable audit log table |
| **Detail Dialog** | View full diff details for each action |
| **Color-Coded Actions** | Visual distinction between action types |
**Logged Entities:** Products, Orders, Settings, Users, Roles, Permissions, Coupons, Shipping Rules, Categories, Brands, Pages, Payment Gateways
---
### 2.19 Notifications & Email Templates
**What It Does:** Multi-channel notification system with customizable email templates.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Email Templates** | 9 pre-built templates with variable support |
| **Template Editor** | Edit template subject, body (HTML), and variables |
| **Variable Chips** | Click-to-insert dynamic variables (e.g., `{{customerName}}`, `{{orderNumber}}`) |
| **Preview** | See how template renders before saving |
| **Test Send** | Send test email to verify template output |
| **Reset to Default** | Revert template to factory default |
| **Multi-Channel** | Email (SMTP), SMS (Twilio), WhatsApp (Twilio) |
| **Notification Logs** | Track sent notifications with delivery status |
**Available Email Templates:**
| Template | Trigger | Audience |
|----------|---------|----------|
| `welcome` | New user registration | Customer |
| `email_verification` | Account creation | Customer |
| `password_reset` | Password reset request | Customer |
| `order_placed` | Order created | Customer |
| `order_shipped` | Order shipped | Customer |
| `order_delivered` | Order delivered | Customer |
| `order_cancelled` | Order cancelled | Customer |
| `order_refunded` | Order refunded | Customer |
| `low_stock_alert` | Variant stock below threshold | Admin |
| `admin_new_order` | New order placed | Admin |
| `admin_order_cancelled` | Order cancelled | Admin |
| `admin_order_failed` | Payment failed | Admin |
**Credential Management:**
- SMTP credentials stored encrypted
- Twilio credentials stored encrypted
- Credentials auto-masked in admin UI
- Dynamic credential resolution from settings (no hardcoding)
---
### 2.20 Enquiries
**What It Does:** Product enquiry system for catalog mode and customer questions.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Enquiry DataGrid** | View all customer enquiries with status filter |
| **Status Management** | Mark enquiries as new, in-progress, resolved, closed |
| **Detail View** | Full enquiry content including attached cart items |
| **Reply Functionality** | Respond to customer enquiries |
| **Product Context** | See which product the enquiry is about |
**Customer-Facing Impact:**
- Enquiry modal on product detail pages
- Customer can attach cart items to enquiry
- Name, email, phone, and message fields
---
### 2.21 Sale Labels
**What It Does:** Customizable badges and labels for products on sale.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Label CRUD** | Create, edit, delete sale labels |
| **Color Picker** | Custom background color for each label |
| **Drag-and-Drop** | Reorder labels by priority |
| **Active Toggle** | Show or hide labels |
| **Preset Labels** | Hot Sale, Flash Sale, Clearance, New Arrival, Hot Deal, Limited Time |
| **Slug-Based IDs** | URL-friendly identifiers for each label |
**Customer-Facing Impact:**
- Sale badges on product cards
- Sale countdown timer on product detail pages
- On-sale product sections on homepage
---
### 2.22 Attributes & Variants
**What It Does:** Flexible product attribute system for variant creation.
**Features Available to Admin:**
| Feature | Description |
|---------|-------------|
| **Attribute Templates** | Define attributes (Color, Size, Type, etc.) with preset values |
| **Attribute Values** | Manage available values for each attribute |
| **Category-Attribute Linking** | Link attributes to categories with inheritance |
| **Product Attribute Overrides** | Override category-level attributes for specific products |
| **Variant Management** | Create product variants from attribute combinations |
| **Bulk Variant Generation** | Auto-generate all possible variant combinations |
| **Variant Cloning** | Copy settings from one variant to another |
| **Per-Variant Fields** | SKU, price, stock quantity, dimensions per variant |
| **Variant Option Labels** | Configurable display format for variant selectors |
**Customer-Facing Impact:**
- Variant selector on product pages (dropdown or chips)
- Out-of-stock variants shown as disabled
- Price updates when variant changes
- Variant-specific images
---
## 3. Customer-Facing Features
### 3.1 Storefront Browsing
| Feature | Description |
|---------|-------------|
| **Homepage** | Configurable sections: hero banner, category grid, new arrivals, featured products, best sellers, on-sale products, brand strip |
| **Announcement Bar** | Dismissible banner at the top of the page (configurable text) |
| **Category Navigation** | Horizontal category bar (if enabled in settings) |
| **Header Navigation** | Dynamic links from CMS pages (header link position) |
| **Footer** | Store branding, navigation links, social media links, copyright |
| **Responsive Design** | Mobile, tablet, and desktop layouts |
| **Dynamic Theming** | Store colors, fonts, button styles, card styles all from settings |
### 3.2 Product Discovery & Filtering
| Feature | Description |
|---------|-------------|
| **Product Listing Page** | Grid view with configurable columns |
| **Search** | Debounced real-time search |
| **Category Filter** | Filter by category (with subcategory support) |
| **Brand Filter** | Filter by brand |
| **Price Range Filter** | Min/max price slider |
| **Sorting** | Multiple sort options (price, name, date, rating) |
| **Pagination** | Configurable page size |
| **Product Cards** | Image, name, price, sale badge, wishlist button, rating |
### 3.3 Product Detail Page
| Feature | Description |
|---------|-------------|
| **Image Gallery** | Main image with thumbnail navigation, zoom capability |
| **Variant Selector** | Dropdown or chip-style selectors, out-of-stock variants disabled |
| **Dynamic Pricing** | Price updates based on selected variant |
| **Add to Cart** | Add product/variant to cart with quantity |
| **Buy Now** | Direct checkout for single item |
| **Wishlist Button** | Add/remove from wishlist with animation |
| **Review Section** | Star rating summary, review list, review submission form |
| **Enquiry Modal** | Send product enquiry with optional cart items |
| **Sale Countdown** | Timer for scheduled sale end date |
| **Sale Labels** | Custom badge labels (Hot Sale, Clearance, etc.) |
| **SEO Meta Tags** | Per-product title, description, OG tags for social sharing |
### 3.4 Shopping Cart
| Feature | Description |
|---------|-------------|
| **Cart Page** | View all cart items with images, prices, quantities |
| **Quantity Controls** | Increase/decrease item quantity |
| **Remove Items** | Delete items from cart |
| **Coupon Validation** | Apply coupon codes with validation feedback |
| **Tax Calculation** | Tax displayed and calculated at cart |
| **Free Shipping Progress** | Visual progress bar showing amount needed for free shipping |
| **Optimistic Updates** | Instant UI updates with server sync |
| **Guest Cart** | Cart persists for guest users (session-based) |
| **Guest-to-User Merge** | Cart items merge into account on login |
| **Price Re-Validation** | Server-side price verification at checkout (prevents stale price exploits) |
### 3.5 Checkout
| Feature | Description |
|---------|-------------|
| **Address Selection** | Choose from saved addresses or add new one |
| **Address Management** | Create, edit, set default address during checkout |
| **Shipping Calculation** | Real-time shipping cost by pincode |
| **Shipping Quote Lock** | Shipping cost locked for 10 minutes during checkout |
| **Coupon Application** | Apply coupons at checkout |
| **Payment Method Selection** | Choose from enabled payment gateways |
| **Order Summary** | Full breakdown: subtotal, tax, shipping, discounts, total |
| **Buy Now Support** | Single-item checkout bypasses cart |
| **Guest Checkout** | Checkout without account (if enabled) |
### 3.6 Payments
| Feature | Description |
|---------|-------------|
| **Razorpay** | Indian payment gateway with UPI, cards, net banking, wallets |
| **Stripe** | International payment gateway with cards |
| **Cashfree** | Indian payment gateway |
| **PayU** | Indian payment gateway |
| **Cash on Delivery** | Pay on delivery option |
| **Dynamic SDK Loading** | Payment gateway SDK loaded only when needed |
| **Signature Verification** | Payment response verified for security |
| **Payment Success Page** | Order confirmation with links |
| **Payment Failure Page** | Error display with retry option |
### 3.7 Order Tracking
| Feature | Description |
|---------|-------------|
| **Order History** | View all past orders with search and status filters |
| **Order Detail** | Full order breakdown with progress tracker |
| **Status Timeline** | Visual order status progression |
| **Cancel Order** | Cancel from allowed statuses |
| **Invoice Download** | Printable order invoice |
| **Invoice Print** | Print-friendly invoice layout |
| **Shipping Tracking** | Tracking information and URLs (if shipped) |
### 3.8 Wishlist
| Feature | Description |
|---------|-------------|
| **Add to Wishlist** | Heart icon toggle on product cards and detail pages |
| **Wishlist Page** | Grid view of saved products |
| **Move to Cart** | Single item or all items moved to cart |
| **Stock Validation** | Out-of-stock items flagged on move-to-cart |
| **Auto-Cleanup** | Unavailable products automatically removed (with count shown) |
| **Unavailable Filtering** | Filter out-of-stock or unpublished items |
### 3.9 Reviews
| Feature | Description |
|---------|-------------|
| **Star Rating** | 1-5 star rating on products |
| **Review Submission** | Text review with star rating |
| **Verified Purchase Badge** | Shows if reviewer purchased the product |
| **Review List** | All approved reviews displayed on product page |
| **Purchase-Gated Reviews** | Only verified purchasers can review (if enabled) |
### 3.10 Account Management
| Feature | Description |
|---------|-------------|
| **Login** | Email/password login with validation |
| **Registration** | Account creation with password strength checklist |
| **Forgot Password** | Password reset via email link |
| **Reset Password** | Token-based password reset |
| **Email Verification** | Verify email address via link |
| **Profile Management** | Update name, phone, avatar |
| **Avatar Upload** | Profile picture from file or media picker |
| **Password Change** | Change password with strength validation |
| **Address Book** | Manage multiple shipping/billing addresses |
| **Default Address** | Set primary address for checkout |
| **Order History** | View all orders with details |
### 3.11 Static Pages
| Feature | Description |
|---------|-------------|
| **CMS Pages** | About, Terms, Privacy, Return Policy, etc. |
| **Rich Content** | Formatted text, images, links |
| **Header/Footer Links** | Pages linked in navigation (if configured) |
---
## 4. Feature Flag Matrix
### Tier 1 — Mode-Locked (Cannot Be Overridden)
| Feature | E-Commerce Mode | Catalog Mode | Description |
|---------|:---:|:---:|-------------|
| `pricing` | ✅ | ❌ | Show prices on products |
| `cart` | ✅ | ❌ | Shopping cart functionality |
| `checkout` | ✅ | ❌ | Checkout flow |
| `orders` | ✅ | ❌ | Order management |
| `payments` | ✅ | ❌ | Payment processing |
| `shipping` | ✅ | ❌ | Shipping calculation and fulfillment |
### Tier 2 — Admin-Controlled
| Feature | E-Commerce Default | Catalog Default | Description |
|---------|:---:|:---:|-------------|
| `wishlist` | ✅ | ✅ | Product wishlist |
| `reviews` | ✅ | ✅ | Product reviews and ratings |
| `coupons` | ✅ | ✅ | Discount coupon system |
| `guestCheckout` | ✅ | ❌ | Checkout without account |
| `seo` | ✅ | ✅ | SEO meta tag management |
| `emailVerification` | ✅ | ✅ | Require email verification |
| `requirePurchaseForReview` | ❌ | ❌ | Only verified purchasers can review |
| `showAvailableCoupons` | ❌ | ❌ | Show available coupons at checkout |
| `multiCurrency` | ❌ | ❌ | Multiple currency support *(not yet implemented)* |
| `socialLogin` | ❌ | ❌ | Social media login *(not yet implemented)* |
| `enquiry` | ✅ | ✅ | Product enquiry system |
| `showPrice` | ✅ | ❌ | Display product prices |
---
## 5. Permissions Matrix
### System Roles
| Permission | Customer | Admin | Super Admin |
|------------|:---:|:---:|:---:|
| **Products** | | | |
| `products.read` | ❌ | ✅ | ✅ |
| `products.manage` | ❌ | ✅ | ✅ |
| **Categories** | | | |
| `categories.read` | ❌ | ✅ | ✅ |
| `categories.manage` | ❌ | ✅ | ✅ |
| **Orders** | | | |
| `orders.read` | ❌ | ✅ | ✅ |
| `orders.manage` | ❌ | ✅ | ✅ |
| **Customers** | | | |
| `customers.read` | ❌ | ✅ | ✅ |
| `customers.manage` | ❌ | ✅ | ✅ |
| **Reviews** | | | |
| `reviews.read` | ❌ | ✅ | ✅ |
| `reviews.manage` | ❌ | ✅ | ✅ |
| **Media** | | | |
| `media.read` | ❌ | ✅ | ✅ |
| `media.manage` | ❌ | ✅ | ✅ |
| **Settings** | | | |
| `settings.read` | ❌ | ✅ | ✅ |
| `settings.manage` | ❌ | ❌ | ✅ |
| **Pages** | | | |
| `pages.read` | ❌ | ✅ | ✅ |
| `pages.manage` | ❌ | ✅ | ✅ |
| **Roles** | | | |
| `roles.read` | ❌ | ❌ | ✅ |
| `roles.manage` | ❌ | ❌ | ✅ |
| **Audit** | | | |
| `audit.read` | ❌ | ❌ | ✅ |
| **Notifications** | | | |
| `notifications.read` | ❌ | ✅ | ✅ |
| `notifications.manage` | ❌ | ❌ | ✅ |
| **Coupons** | | | |
| `coupons.read` | ❌ | ✅ | ✅ |
| `coupons.manage` | ❌ | ✅ | ✅ |
| **Shipping** | | | |
| `shipping.read` | ❌ | ✅ | ✅ |
| `shipping.manage` | ❌ | ✅ | ✅ |
| **Admin Access** | | | |
| `admin.access` | ❌ | ✅ | ✅ |
---
# Part 2: Developer Documentation
## 6. Technical Architecture
### 6.1 Project Structure
e-commerce/
├── client/                      # React frontend (Vite + MUI)
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── admin/           # Admin-specific components
│   │   │   │   └── dashboard/   # Dashboard widgets
│   │   │   ├── common/          # Shared components
│   │   │   ├── editor/          # Rich text editor
│   │   │   ├── layout/          # Layout components
│   │   │   ├── orders/          # Order-related components
│   │   │   ├── product/         # Product components
│   │   │   └── storefront/      # Storefront components
│   │   ├── context/             # React Context stores
│   │   ├── hooks/               # Custom React hooks
│   │   ├── layouts/             # Page layouts
│   │   ├── pages/               # Page components
│   │   │   ├── admin/           # Admin pages (26)
│   │   │   └── storefront/      # Storefront pages (23)
│   │   ├── routes/              # Route definitions and guards
│   │   ├── services/            # API service modules
│   │   ├── theme/               # MUI theme configuration
│   │   └── utils/               # Utility functions
│   └── public/                  # Static assets
├── server/                      # Express backend
│   ├── src/
│   │   ├── modules/             # Domain-driven modules (23)
│   │   │   ├── access/          # RBAC
│   │   │   ├── admin/           # Dashboard & Analytics
│   │   │   ├── attribute/       # Product attributes
│   │   │   ├── audit/           # Action logging
│   │   │   ├── auth/            # JWT & Session
│   │   │   ├── brand/           # Brand management
│   │   │   ├── cart/            # Shopping cart
│   │   │   ├── category/        # Product categories
│   │   │   ├── coupon/          # Discount engine
│   │   │   ├── enquiry/         # Customer questions
│   │   │   ├── media/           # File management
│   │   │   ├── notification/    # Email/SMS/WhatsApp
│   │   │   ├── order/           # Order lifecycle
│   │   │   ├── page/            # CMS content
│   │   │   ├── payment/         # Gateway integrations
│   │   │   ├── product/         # Catalog & Pricing
│   │   │   ├── review/          # Ratings & Moderation
│   │   │   ├── seo/             # Meta tag management
│   │   │   ├── settings/        # Store configuration
│   │   │   ├── shipping/        # Fulfillment & Rates
│   │   │   ├── tax/             # GST & Tax rules
│   │   │   ├── user/            # Customer profiles
│   │   │   └── wishlist/        # Saved products
│   │   ├── middleware/          # Express middlewares
│   │   ├── models/              # Sequelize base models
│   │   ├── jobs/                # Background workers
│   │   ├── config/              # Server configuration
│   │   └── utils/               # Shared helpers
├── shared/                      # Shared logic between client/server
├── config/                      # Global configuration presets
├── scripts/                     # DevOps & Maintenance scripts
└── docs/                        # Documentation