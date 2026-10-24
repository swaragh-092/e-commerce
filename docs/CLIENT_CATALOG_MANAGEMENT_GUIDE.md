# E-Commerce Platform — Client Catalog Management Guide
## Comprehensive Manual: Categories, Attributes, and Products Data Management

Welcome to the **Catalog Management Guide**. This guide is prepared specifically for store owners, catalog managers, and operations teams. It provides end-to-end instructions on how to set up, organize, and manage your store's catalog across the three foundational pillars:

1. **Categories Management** — Organizing your storefront taxonomy, navigation menus, and category hierarchies.
2. **Attributes & Variants** — Defining options (Size, Color, Material), visual presentation styles (swatches, buttons, chips), and unit measurements.
3. **Products & Data Management** — Creating products, managing variant matrices, handling stock and pricing, and using **Bulk Data Upload & CSV Export**.

---

## Table of Contents
- [1. Categories Management](#1-categories-management)
  - [1.1 Understanding Category Taxonomy](#11-understanding-category-taxonomy)
  - [1.2 Category Hierarchy: Parent and Subcategories](#12-category-hierarchy-parent-and-subcategories)
  - [1.3 Tree View vs. Flat View](#13-tree-view-vs-flat-view)
  - [1.4 Category Data Fields Reference](#14-category-data-fields-reference)
  - [1.5 Setting Category Icons and Banners](#15-setting-category-icons-and-banners)
  - [1.6 Category Ordering & Navigation](#16-category-ordering--navigation)
  - [1.7 Associating Attributes with Categories](#17-associating-attributes-with-categories)
  - [1.8 Step-by-Step: Creating and Managing Categories](#18-step-by-step-creating-and-managing-categories)
- [2. Attributes & Variants Configuration](#2-attributes--variants-configuration)
  - [2.1 The Role of Attributes in E-Commerce](#21-the-role-of-attributes-in-e-commerce)
  - [2.2 Value Types & Customer Experience](#22-value-types--customer-experience)
  - [2.3 Display Styles & Visual Selectors](#23-display-styles--visual-selectors)
  - [2.4 Managing Units of Measurement](#24-managing-units-of-measurement)
  - [2.5 Managing Values: Colors, Sizes, and Swatches](#25-managing-values-colors-sizes-and-swatches)
  - [2.6 Step-by-Step: Setting Up an Attribute with Swatches](#26-step-by-step-setting-up-an-attribute-with-swatches)
- [3. Products & Product Data Management](#3-products--product-data-management)
  - [3.1 Product Types: Simple, Variable, and Combo](#31-product-types-simple-variable-and-combo)
  - [3.2 Product Data Fields Breakdown](#32-product-data-fields-breakdown)
  - [3.3 Managing Pricing, Taxes & Scheduled Sales](#33-managing-pricing-taxes--scheduled-sales)
  - [3.4 Inventory, SKUs & Reserved Stock](#34-inventory-skus--reserved-stock)
  - [3.5 Media Management: Images & Variant Mapping](#35-media-management-images--variant-mapping)
  - [3.6 Creating Variable Products: Step-by-Step](#36-creating-variable-products-step-by-step)
  - [3.7 Shipping Dimensions & Package Setup](#37-shipping-dimensions--package-setup)
  - [3.8 Custom Product Tabs & SEO Metadata](#38-custom-product-tabs--seo-metadata)
- [4. Bulk Product Data Upload & CSV Export](#4-bulk-product-data-upload--csv-export)
  - [4.1 Overview of Bulk Data Import](#41-overview-of-bulk-data-import)
  - [4.2 Excel Import Template Structure (8 Sheets)](#42-excel-import-template-structure-8-sheets)
  - [4.3 How Key Linking Works (`product_key` & `variant_key`)](#43-how-key-linking-works-product_key--variant_key)
  - [4.4 Exporting Catalog Data to CSV](#44-exporting-catalog-data-to-csv)
  - [4.5 Pre-Import Checklist & Common Pitfalls](#45-pre-import-checklist--common-pitfalls)
- [5. Best Practices & Troubleshooting](#5-best-practices--troubleshooting)

---

# 1. Categories Management

Categories form the spine of your e-commerce store. They define how customers browse your website, appear in search engine breadcrumbs, and allow customers to filter products intuitively.

## 1.1 Understanding Category Taxonomy
- **Categories** are hierarchical grouping containers (e.g., *Men > Apparel > T-Shirts*).
- A product can belong to **multiple categories** simultaneously (e.g., *Summer Collection* and *T-Shirts*).
- Categories also serve as template presets: attributes assigned to a category automatically become available to all products assigned to that category.

## 1.2 Category Hierarchy: Parent and Subcategories
Your store supports infinite nesting of categories:
- **Root / Parent Category**: Top-level departments visible on the main menu bar (e.g., `Electronics`, `Clothing`, `Home & Living`).
- **Child / Subcategory**: Nested sections under a parent (e.g., `Men's Wear` under `Clothing`).
- **Grandchild Category**: Deeply nested product groupings (e.g., `Graphic Tees` under `Men's Wear`).

## 1.3 Tree View vs. Flat View
Navigate to **Admin > Catalog > Categories**. You will find two view modes in the top toolbar:
1. **Tree View (Default)**:
   - Displays your categories in an expandable folder-tree hierarchy on the left.
   - Clicking any category expands its child nodes and displays its subcategories, direct products, and metadata on the right panel.
   - Ideal for browsing deep catalogs and organizing department levels.
2. **Flat View**:
   - Displays all categories in a tabular list with full breadcrumb hierarchy paths (e.g., `Clothing > Men > T-Shirts`).
   - Includes quick action buttons: **Add Subcategory**, **Edit**, and **Delete**.
   - Ideal for searching categories quickly or doing bulk audits.

## 1.4 Category Data Fields Reference

| Field Name | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| **Category Name** | **Yes** | The public display name shown in menus, breadcrumbs, and headers. | `Running Shoes` |
| **Parent Category** | No | The parent under which this category is nested. Leave empty for Root categories. | `Men > Footwear` |
| **Description** | No | Rich marketing copy displayed at the top of the category storefront page. | `High-performance running shoes for trail and track.` |
| **Custom Heading (H1)** | No | Custom SEO H1 tag if you want it to differ from the category name. | `Premium Men's Trail & Road Running Shoes` |
| **Category Image** | No | Thumbnail/Hero image displayed on category cards and collection pages. | `media/categories/running-hero.jpg` |
| **Category Icon** | No | Visual icon displayed in navigation menus and category pills. | `DirectionsRun` (or SVG icon) |
| **Banner Image** | No | Wide header banner displayed across the top of the category collection page. | `media/banners/footwear-banner.jpg` |
| **Meta Title** | No | Browser title tag for Google and search engines (recommended 50–60 chars). | `Buy Men's Running Shoes Online \| Best Prices` |
| **Meta Description** | No | Snippet shown beneath Google search results (recommended 140–160 chars). | `Explore our durable, lightweight running shoes designed for ultimate comfort and grip.` |
| **Meta Keywords** | No | Comma-separated search keywords. | `running shoes, sneakers, trail runners, athletic footwear` |
| **OpenGraph Image** | No | Preview image shown when the category link is shared on WhatsApp, Facebook, Twitter. | `media/og/running-shoes-share.jpg` |

## 1.5 Setting Category Icons and Banners
- **Visual Category Icons**: Use the built-in **Category Icon Picker** to choose from hundreds of intuitive vector icons (e.g., clothing hangers, phones, watches, home items). This renders cleanly on mobile menus without requiring heavy graphics.
- **Media Upload**: Click **Choose Image** or **Choose Banner** to open the media gallery. You can upload new files directly or select from existing high-resolution imagery.

## 1.6 Category Ordering & Navigation
- In the Tree View, use the **Up / Down arrow controls** on any category row to reorder its position among siblings.
- The order configured here directly governs the display sequence in the storefront navigation bar, dropdown menus, and sidebar filters.

## 1.7 Associating Attributes with Categories
- In the Category details panel, click **Manage Attributes** (or the Settings icon).
- This opens the **Category Attributes Dialog**. Here you can link predefined attributes (e.g., *Shoe Size*, *Shoe Width*, *Color*) directly to the category.
- When creating a product under this category, those attributes will automatically be suggested, saving your team hours of repetitive configuration.

## 1.8 Step-by-Step: Creating and Managing Categories
1. Navigate to **Catalog > Categories** in your Admin Portal.
2. Click **+ Add Category** in the top-right corner.
3. Enter the **Name** (e.g., `Sneakers`). The URL slug is generated automatically.
4. Select a **Parent Category** if this is a subcategory (e.g., `Footwear`), or leave blank to make it a primary root category.
5. Upload a **Category Image** and select a **Category Icon**.
6. Expand the **SEO Settings** section to review the **Meta Title** and **Description**.
7. Click **Create Category**.
8. To add a child directly, click the **+ (Add Child)** icon next to any category row.

---

# 2. Attributes & Variants Configuration

Attributes define the selectable parameters and specifications of your products. Without attributes, customers cannot choose their size, pick a colorway, or filter by material.

## 2.1 The Role of Attributes in E-Commerce
An **Attribute** represents a characteristic, while **Attribute Values** are the distinct choices available:
- **Attribute**: `Color` &rarr; **Values**: `Black`, `Navy Blue`, `Crimson`, `Heather Gray`.
- **Attribute**: `T-Shirt Size` &rarr; **Values**: `XS`, `S`, `M`, `L`, `XL`, `XXL`.
- **Attribute**: `Storage Capacity` &rarr; **Values**: `128 GB`, `256 GB`, `512 GB`, `1 TB`.

Attributes are managed globally under **Catalog > Attributes** so they can be reused across hundreds of products consistently.

## 2.2 Value Types & Customer Experience
When creating an attribute, the **Value Type** specifies the nature of the data. This informs the storefront how to validate, sort, and display the options:

| Value Type | What It Represents | Automatic Display Behaviour |
| :--- | :--- | :--- |
| **Color** | Color selections with hex color codes or color names. | Displays as circular color swatches. |
| **Pattern** | Pattern styles (e.g. Striped, Polka Dot, Camo). | Displays as image or pattern swatches. |
| **Size** | Apparel, footwear, or physical sizing codes. | Displays as rectangular buttons in natural size order. |
| **Weight** | Product weights (e.g., 250 g, 500 g, 1 kg). | Displays as buttons with unit labels. |
| **Length / Dimension** | Physical dimensions (e.g., 10 cm, 15 cm, 20 cm). | Displays as buttons or pill chips. |
| **Storage** | Digital memory (e.g., 64 GB, 128 GB, 256 GB). | Displays as buttons. |
| **Volume** | Liquid or capacity volume (e.g., 100 ml, 250 ml, 1 L). | Displays as buttons. |
| **Material** | Construction material (e.g., 100% Cotton, Genuine Leather). | Displays as compact chips or dropdown. |
| **Number** | Pure numerical values (e.g., Pack of 3, 6, 12). | Displays as buttons. |
| **Text** | General textual attributes (e.g., Finish: Matte, Glossy). | Displays as text buttons or dropdowns. |

## 2.3 Display Styles & Visual Selectors
You can override the automatic presentation by picking an explicit **Display Style** on the attribute:
1. **Color Swatches**: Renders colored circular swatches. If a value has a hex code (e.g., `#000000`), the customer sees the exact color circle.
2. **Image Swatches**: Renders miniature thumbnail images (ideal for wood finishes, fabric patterns, or multi-tone designs).
3. **Buttons**: Crisp rectangular button selectors. This is the industry standard for clothing sizes (`S`, `M`, `L`).
4. **Chips**: Compact, modern rounded pill tags. Excellent for short specifications.
5. **Radio Buttons**: Classic radio list with explicit labels.
6. **Dropdown**: Clean `<select>` menu. Best for long lists (e.g. 15+ ring sizes) to prevent page clutter.
7. **Text Labels**: Clean text list with underline hover states.

## 2.4 Managing Units of Measurement
For attributes with physical measurements (Weight, Length, Storage, Volume), your store features an integrated **Unit Catalog**:
- Choose the **Unit Category** (e.g., `Weight`).
- The system enables standardized unit attachments (e.g., `g`, `kg`, `oz`, `lb`).
- This guarantees uniform formatting on the customer-facing storefront and prevents data inconsistencies.

## 2.5 Managing Values: Colors, Sizes, and Swatches
In the **Catalog > Attributes** table, click the **Values icon (List icon)** on any row:
- **Adding a Value**:
  - Enter the **Value Name** (e.g., `Forest Green`).
  - For Color attributes: Enter the **Hex Code** (e.g., `#228B22`) or pick from the color palette.
  - For Sizing: Set the **Sort Order** so that `XS` appears before `S`, and `M` appears before `L` (alphabetical sorting would put `L` before `M`, which frustrates customers).
  - For Pattern/Image: Upload a small thumbnail swatch image.
- **Storefront Live Preview**: The Admin screen features a real-time **Storefront Presentation Preview** box, showing you exactly how the selector will appear to customers on desktop and mobile before you save!

## 2.6 Step-by-Step: Setting Up an Attribute with Swatches
1. Go to **Catalog > Attributes** and click **+ Add Attribute**.
2. Name the attribute `Color`.
3. Set **Value Type** to `Color`.
4. Set **Display Style** to `Color swatches`.
5. Click **Save Attribute**.
6. In the list, click the **Manage Values** icon on the new `Color` row.
7. Add your values:
   - Name: `Midnight Black`, Color Code: `#0F172A`.
   - Name: `Arctic White`, Color Code: `#F8FAFC`.
   - Name: `Royal Blue`, Color Code: `#1D4ED8`.
8. Check the **Live Preview** card. The interactive color swatches will render immediately.
9. Click **Close**. Your attribute is now ready to be attached to products.

---

# 3. Products & Product Data Management

The Products section is where your store's inventory, pricing, marketing copy, and media assets come together.

## 3.1 Product Types: Simple, Variable, and Combo
Your catalog supports three specialized product architectures:

1. **Simple Product**:
   - A single standalone item with no customer choices.
   - Has its own direct Price, Sale Price, SKU, and Stock Quantity.
   - Example: *Stainless Steel Water Bottle (750ml)*, *Hardcover Book*.
2. **Variable Product**:
   - A product with selectable choices (variants) generated from attributes.
   - Has a base display price, but **each variant combination** has its own unique SKU, independent stock, individual price, and image.
   - Example: *Cotton Crewneck T-Shirt* with sizes `S, M, L` and colors `Black, White`.
3. **Combo Product (Bundle)**:
   - A curated package combining multiple existing products or variants into a single discounted package.
   - Stock is automatically governed by the underlying component products.
   - Example: *Men's Grooming Kit (Shampoo + Conditioner + Beard Oil)*.

## 3.2 Product Data Fields Breakdown

### General Information
- **Product Name**: Clear, descriptive commercial title (e.g., *Men's Lightweight Breathable Running Jacket*).
- **URL Slug**: URL-friendly identifier (e.g., `mens-lightweight-running-jacket`). Automatically refreshed when editing the name.
- **Product Type**: `Simple`, `Variable`, or `Combo`.
- **Categories**: Multi-select picker to assign the product to one or more store categories.
- **Brand**: Optional brand association (e.g., *Nike*, *Apple*, *Puma*).
- **Status**:
  - `Draft`: Saved internally, hidden from customers.
  - `Published`: Live on the storefront, indexed, and purchasable.
  - `Archived`: Retired from storefront but preserved for order history.
- **Storefront State**:
  - `Active`: Visible, priced, and in stock.
  - `Out of Stock`: Visible, but Add-to-Cart disabled or backorder messaging shown.
  - `Unpriced / Catalog Mode`: Visible for viewing only; price and cart disabled.

## 3.3 Managing Pricing, Taxes & Scheduled Sales
- **MRP (Maximum Retail Price / Regular Price)**: The standard base catalog price.
- **Sale Price**: The discounted price offered to customers. Must be strictly lower than the MRP.
- **Scheduled Sales**:
  - **Sale Start Date & Time**: When the discounted pricing goes live automatically.
  - **Sale End Date & Time**: When the sale expires and reverts to regular MRP.
- **Sale Labels / Badges**: Promotional badges displayed over product cards (e.g., `SALE`, `FLAT 20% OFF`, `BESTSELLER`).
- **Tax Configuration**:
  - Specify whether prices are **Tax Inclusive** or **Tax Exclusive**.
  - Enter applicable GST / VAT split rates (e.g. CGST 9% + SGST 9% or IGST 18%).

## 3.4 Inventory, SKUs & Reserved Stock
- **SKU (Stock Keeping Unit)**: Unique alphanumeric warehouse barcode identifier (e.g., `NIK-RN-BLK-042`).
  - Use the built-in **SKU Generator** (`⚡` bolt icon) to generate standardized, clean SKUs automatically based on product and variant names.
- **Stock Quantity**: The total physical units in your warehouse.
- **Reserved Stock**: Units held in active customer shopping carts or pending checkout payment.
- **Available Stock**: Calculated automatically as `Stock Quantity - Reserved Stock`.
- **Low Stock Threshold**: Triggers automated warnings in the Admin Dashboard when inventory dips below this number (default: 10 units).
- **Stock History Ledger**: Click the **History** icon on any product to see the full audit trail of inventory adjustments, order deductions, returns, and manual edits.

## 3.5 Media Management: Images & Variant Mapping
High-converting product pages require high-quality visual galleries:
1. **Adding Images**: Click **Add Media** to open the Media Picker. Select single or multiple images.
2. **Primary Thumbnail**: Click the **Star icon** on any image to mark it as the **Primary Thumbnail**. This image appears on search results, category grids, and cart summaries.
3. **Reordering**: Images display in the exact sequence shown in your gallery editor.
4. **Variant-Specific Images**: When editing a variant (e.g., Red T-Shirt), you can assign a dedicated variant image. When a customer clicks the Red swatch on the storefront, the main gallery will automatically swap to display the Red image!

## 3.6 Creating Variable Products: Step-by-Step
Creating a variable product with multiple sizes and colors is effortless:

1. **Create Base Product**:
   - Go to **Catalog > Products** and click **+ Add Product**.
   - Enter Product Name: `Classic Oxford Shirt`.
   - Select **Product Type**: `Variable Product`.
   - Select your Categories (e.g., `Men > Shirts`).
   - Enter base descriptions and SEO tags.
   - Click **Save Product**.
2. **Assign Attributes**:
   - Once saved, scroll down to the **Attributes & Variants** panel.
   - Add your attributes: select `Color` and `Size`.
   - Select the values you stock:
     - Color: `Sky Blue`, `White`.
     - Size: `S`, `M`, `L`, `XL`.
   - Ensure the checkbox **Use for variants** is checked for both attributes.
3. **Generate Variant Matrix**:
   - Click **Generate Variants** (or **Review Combinations**).
   - The system computes the Cartesian product (2 colors &times; 4 sizes = 8 combinations).
4. **Configure Each Variant**:
   - The matrix renders 8 rows (`Sky Blue / S`, `Sky Blue / M`, etc.).
   - Use the **SKU Generator** to give each row a distinct SKU (e.g., `OXF-BLU-S`).
   - Set the **Price** and initial **Stock Quantity** for each variant.
   - Upload or select colorway photos for the variants.
5. **Save Changes**: Click **Save Variants**. The product is now live with full swatch and button selectors!

## 3.7 Shipping Dimensions & Package Setup
Accurate dimensions prevent shipping charge surprises:
- **Requires Shipping**: Toggle on for physical goods, off for digital downloads or services.
- **Packing Mode**: `Standard` or `Fragile / Bulky`.
- **Weight**: Enter weight in **grams** (e.g., `450` for 0.45 kg).
- **Dimensions**: Enter **Length &times; Breadth &times; Height in centimeters (cm)**. These numbers are used by integrated shipping couriers (e.g. Shiprocket, FedEx) to calculate volumetric rates.

## 3.8 Custom Product Tabs & SEO Metadata
- **Product Tabs**: Add custom tabs beneath the product description (e.g., *Fabric & Care*, *Size Guide*, *Shipping & Returns*). You can format content with rich text and bullet lists.
- **Search Engine Optimization (SEO)**:
  - Custom **Meta Title** and **Meta Description** with live preview of how the snippet looks on Google.
  - **OpenGraph Social Image**: The high-impact card graphic shown on social platforms when customers share your product link.

---

# 4. Bulk Product Data Upload & CSV Export

Managing hundreds or thousands of products one-by-one in the web browser is time-consuming. Your platform includes a comprehensive **Bulk Data Management System** supporting multi-sheet Excel files and CSV exports.

## 4.1 Overview of Bulk Data Import
The bulk import system uses a relational Excel workbook (`.xlsx`) containing 8 linked sheets. This architecture allows you to import products, assign multiple categories, upload image galleries, define attributes, and build variant matrices in a single file upload!

The template file is located in your project repository at:
[`docs/product_bulk_import_template.xlsx`](file:///home/sr-user91/Documents/Projects/e-commerce/docs/product_bulk_import_template.xlsx)

## 4.2 Excel Import Template Structure (8 Sheets)

### Sheet 1: `Products` (Core Product Catalog)
Contains master product rows. Each row must have a unique `product_key` (e.g., `P001`, `P002`).

| Column Header | Format / Allowed Values | Description |
| :--- | :--- | :--- |
| `product_key` | Alphanumeric (e.g. `P001`) | **Primary reference key** used to link data across all other sheets. |
| `name` | Text (max 255 chars) | Commercial product title. |
| `slug` | Text (lowercase, hyphenated) | URL slug (e.g. `cotton-t-shirt`). |
| `sku` | Alphanumeric | Master product SKU (for Simple products). |
| `type` | `simple`, `variable`, `combo` | The product type. |
| `status` | `draft`, `published` | Storefront publication state. |
| `is_enabled` | `true`, `false` | Master visibility toggle. |
| `is_featured` | `true`, `false` | Highlights product in "Featured" storefront widgets. |
| `brand_slug` | Text (e.g. `nike`) | Slug of existing brand. |
| `price` | Decimal (e.g. `499.00`) | Base regular price / MRP. |
| `sale_price` | Decimal (e.g. `399.00`) | Discounted price (optional). |
| `sale_start_at` | ISO Date (`YYYY-MM-DDTHH:mm:ssZ`) | Scheduled sale start date. |
| `sale_end_at` | ISO Date (`YYYY-MM-DDTHH:mm:ssZ`) | Scheduled sale end date. |
| `sale_label` | Text | Promotional badge (e.g. `Summer Sale`). |
| `quantity` | Integer &ge; 0 | Standalone stock quantity (for Simple products). |
| `weight_grams` | Number | Weight in grams. |
| `length_cm` | Number | Length in centimeters. |
| `breadth_cm` | Number | Breadth / Width in centimeters. |
| `height_cm` | Number | Height in centimeters. |
| `short_description` | Text | Concise teaser shown beside the gallery. |
| `description` | HTML / Text | Full rich-text product description. |
| `meta_title` | Text | Search engine title tag. |
| `meta_description`| Text | Search engine snippet. |
| `meta_keywords` | Comma-separated text | SEO keywords. |
| `og_image` | Full URL | Social media share card image. |
| `tax_config_json`| JSON string | Tax configuration (e.g. `{"inclusive":true,"sgst":0.09,"cgst":0.09}`). |

---

### Sheet 2: `ProductCategories` (Category Mapping)
Maps products to one or more store categories.

| Column Header | Example | Description |
| :--- | :--- | :--- |
| `product_key` | `P001` | Matches `product_key` in the `Products` sheet. |
| `category_slug` | `mens-clothing` | Slug of the target category. |
| `sort_order` | `0` | Order of precedence for multiple categories. |

---

### Sheet 3: `ProductImages` (Gallery & Media)
Associates product and variant images.

| Column Header | Example | Description |
| :--- | :--- | :--- |
| `product_key` | `P001` | Links image to the parent product. |
| `variant_key` | `P002-V001` | (Optional) Links image to a specific variant. Leave blank for general images. |
| `image_url` | `https://site.com/img1.jpg` | Publicly accessible image URL or CDN link. |
| `alt` | `Cotton T-Shirt Front View`| Accessibility and SEO alt text. |
| `sort_order` | `0` | Sequence in gallery (`0` = first). |
| `is_primary` | `true` or `false` | Sets this image as the main product thumbnail. |

---

### Sheet 4: `ProductTags`
Assigns tags for search keywords and promotional filters (e.g., `summer`, `bestseller`, `eco-friendly`).
- Columns: `product_key`, `tag_name`.

---

### Sheet 5: `ProductAttributes`
Links global or custom attributes to the product.
- Columns: `product_key`, `attribute_slug`, `value_slug`, `custom_name`, `custom_value`, `is_variant_attr`, `sort_order`.
- Set `is_variant_attr = true` if this attribute generates variants (e.g. Color and Size).

---

### Sheet 6: `ProductVariants`
Defines variant rows for Variable Products.

| Column Header | Example | Description |
| :--- | :--- | :--- |
| `product_key` | `P002` | Parent product reference. |
| `variant_key` | `P002-V001` | **Unique variant identifier** used across other sheets. |
| `sku` | `TSHIRT-RED-S` | Unique barcode / SKU for this specific variation. |
| `price` | `499.00` | Specific price for this variant. |
| `stock_qty` | `25` | Initial stock units available for this variant. |
| `is_active` | `true` | Whether this variant is enabled for purchase. |
| `sort_order` | `0` | Sorting position. |

---

### Sheet 7: `VariantOptions`
Connects each variant to its exact attribute options.

| Column Header | Example | Description |
| :--- | :--- | :--- |
| `variant_key` | `P002-V001` | References the variant defined in `ProductVariants`. |
| `attribute_slug` | `color` | Attribute slug (e.g. `color`). |
| `value_slug` | `red` | Value slug (e.g. `red`). |

*Example*: For a Red Small shirt (`P002-V001`), add two rows in this sheet:
1. `P002-V001` &rarr; `color` &rarr; `red`
2. `P002-V001` &rarr; `size` &rarr; `small`

---

### Sheet 8: `ProductTabs`
Adds rich content tabs (e.g., Specifications, Care, FAQs).
- Columns: `product_key`, `title`, `content`, `type`, `sort_order`, `is_active`.

---

## 4.3 How Key Linking Works (`product_key` & `variant_key`)
Because Excel files cannot know the database UUIDs before import, temporary linking keys are used:
- **`product_key`**: Any clean reference identifier (such as `P001`, `PROD-SHIRT`, `SKU-1001`). When the system imports the file, it replaces `P001` with the permanent database UUID and links all categories, images, and variants automatically.
- **`variant_key`**: Sub-identifier (such as `P001-V01`, `P001-RED-S`). Links variant images in `ProductImages` and attribute choices in `VariantOptions`.

## 4.4 Exporting Catalog Data to CSV
You can export the products shown on the current list page at any time. The CSV includes only the currently loaded page, up to the selected page size; it does not include matching products on other pages. Export each page separately if you need the full filtered result:
1. Navigate to **Admin > Catalog > Products**.
2. Filter or search for the items you want (e.g. filter by `Status: Published` or `Category: Footwear`).
3. Click the **Export CSV** button in the top action bar.
4. The system immediately downloads a formatted `.csv` file: `products-YYYY-MM-DD.csv`.
5. The exported file contains:
   - `Name`
   - `SKU`
   - `MRP` (Regular Price)
   - `Sale Price`
   - `Stock` (Available Units)
   - `Storefront state` (`Active`, `Out of Stock`, `Catalog Mode`)
6. Open the file in Microsoft Excel, Google Sheets, or Apple Numbers to perform inventory audits or price updates.

## 4.5 Pre-Import Checklist & Common Pitfalls
Before running a bulk upload, review this verification checklist:
- [ ] **SKU Uniqueness**: Every SKU in your file must be unique across the entire database. Duplicate SKUs will cause that row to fail.
- [ ] **Sale Price vs MRP**: `sale_price` must always be strictly less than `price`. Setting a sale price greater than or equal to MRP will reject the product.
- [ ] **Categories Pre-Created**: Ensure category slugs used in `ProductCategories` already exist in your store under **Catalog > Categories**.
- [ ] **Image Accessibility**: If using external image URLs, ensure the images are publicly accessible and use valid formats (`JPG`, `PNG`, `WebP`).
- [ ] **Stock on Simple vs Variable**:
  - For **Simple products**, provide `quantity` in the `Products` sheet.
  - For **Variable products**, leave `quantity` empty in `Products` and provide `stock_qty` on each row in `ProductVariants`.

---

# 5. Best Practices & Troubleshooting

### Why is my product showing "Out of Stock" even though quantity is positive?
Check the **Reserved Stock** count. If customers have active checkout sessions or pending payment carts, those units are temporarily reserved to prevent double-selling. Once the reservation expires or the order cancels, the units return to available inventory.

### Why is my category not appearing in the top navigation bar?
1. Verify that the category has the **Parent Category** set appropriately.
2. In **Catalog > Categories**, check the ordering position.
3. If using the Storefront Menu Builder (**Appearance > Navigation**), ensure the category is added to the active Primary Menu.

### How do I run a limited-time flash sale?
1. Open the product editor (or select multiple products in **Manage Products**).
2. Click **Bulk Actions > Sale / Discounts**.
3. Choose percentage or flat discount (e.g., 25% OFF).
4. Set the **Start Date & Time** and **End Date & Time**.
5. Select a promotional badge like `FLASH SALE`.
6. Save. The system will automatically apply discounted pricing when the clock strikes the start time, and revert to normal price as soon as the sale ends.

### Support & Assistance
For further architectural assistance, technical questions, or database customizations, consult the internal engineering documentation or reach out to your technical platform support team.
