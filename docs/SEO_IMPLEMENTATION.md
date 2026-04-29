# E-Commerce SEO Control System — A to Z Documentation (v2.1)

This document outlines the architecture, implementation, and management of the comprehensive SEO control system, with advanced controls for white-label environments.

---

## 1. Overview
The SEO Control System provides granular control over meta tags, Open Graph (OG) data, and search engine directives across the entire storefront. It follows a hierarchical resolution strategy:
1.  **URL Overrides**: Specific metadata for arbitrary paths (e.g., `/`, `/about`).
2.  **Entity Metadata**: SEO fields defined specifically for Products and Categories.
3.  **Global Defaults**: Site-wide settings (Site Name, Default Title Suffix, etc.).

> [!IMPORTANT]
> **Master Control**: All SEO features can be completely toggled on/off via the **Settings > SEO > Enable Storefront SEO Features** toggle. This is ideal for white-label instances where SEO may be managed externally or not required.

---

## 2. Rendering Strategy (CRITICAL)
To ensure reliable indexing and rich social previews, this platform uses a **Pre-rendering** strategy.
*   **Recommendation**: Use `react-snap` or `vite-plugin-ssr`.
*   **Process**: During the build process, the system crawls the sitemap and generates static HTML files for every product and category.
*   **Why**: While Google can render JS, pre-rendering ensures faster indexing, 100% reliability for social crawlers (Facebook/Twitter), and zero performance penalty for SEO bots.

---

## 3. Database Schema

### Entity Updates
The `products` and `categories` tables have been extended with the following fields:
*   `meta_title` (VARCHAR 255): The `<title>` tag for the page.
*   `meta_description` (TEXT): The `<meta name="description">` tag.
*   `meta_keywords` (VARCHAR 500): Used for **internal search tagging** only (Google ignores this for ranking).
*   `og_image` (VARCHAR 500): The image used when sharing on social media.

### SEO Overrides Table
A new table `seo_overrides` handles SEO for non-entity routes:
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `path` | VARCHAR | The URL path (e.g., `/`, `/search`) |
| `meta_title` | VARCHAR | Override Title |
| `meta_description` | TEXT | Override Description |
| `og_image` | VARCHAR | Override OG Image |
| `canonical_url` | VARCHAR | **Manual Override** only (pagination/filters) |
| `no_index` | BOOLEAN | Directive for `robots` meta tag |

### Global Settings
Managed in the `settings` table under the `seo` group:
*   `seo.titleSuffix`: Appended to all titles (e.g., ` | My Store`).
*   `seo.defaultTitle`: Fallback home title.
*   `seo.defaultDescription`: Fallback meta description.
*   `seo.defaultOgImage`: Fallback social sharing image.
*   `seo.canonicalBaseUrl`: The base URL (e.g. `https://mystore.com`) used to generate automatic canonical tags.
*   `seo.googleAnalyticsId`: G-ID for analytics injection.

---

## 4. Backend Logic (Metadata Engine)

The `SeoService.getMetadataByPath(urlPath)` method implements the resolution logic:

1.  **Check Overrides**: Query `SeoOverride` where `path = urlPath`.
2.  **Check Entity**:
    *   If path matches `/product/:slug`, fetch SEO fields from `Product`.
    *   If path matches `/category/:slug`, fetch SEO fields from `Category`.
3.  **Merge Defaults**: Any missing fields are filled using global defaults from `Settings`.
4.  **Automatic Canonical**: The system automatically generates a canonical URL as `BASE_URL + urlPath` unless a manual override is provided.
5.  **Dynamic OG Tags**: For products, the engine automatically includes:
    *   `og:type`: "product"
    *   `product:price:amount`: The current price.
    *   `product:availability`: "in stock" or "out of stock".

---

## 5. API Endpoints

### Get Metadata for Path
*   **URL**: `GET /api/seo/metadata?path={urlPath}`
*   **Response Data**:
    ```json
    {
      "success": true,
      "data": {
        "title": "Product Name | My Store",
        "description": "Best product in the market...",
        "keywords": "electronics, gadget, premium",
        "ogImage": "https://cdn.example.com/product.jpg",
        "canonicalUrl": "https://mystore.com/product/slug",
        "noIndex": false,
        "type": "product",
        "productData": {
          "price": "99.00",
          "currency": "USD",
          "availability": "in stock"
        }
      }
    }
    ```

---

## 6. Storefront Integration

The frontend uses `react-helmet-async` for dynamic head injection and respects the master feature toggle.

**Implementation Pattern (`SEO.jsx`):**
```jsx
const SEO = () => {
    const { settings } = useContext(SettingsContext);
    const location = useLocation();
    const [metadata, setMetadata] = useState(null);

    useEffect(() => {
        // RESPECT MASTER TOGGLE
        if (settings?.features?.seo === false) return;
        
        const fetchMetadata = async () => {
            const data = await seoService.getMetadata(location.pathname);
            if (data) setMetadata(data);
        };

        fetchMetadata();
    }, [location.pathname, settings?.features?.seo]);

    if (!metadata) return null;

    return (
        <Helmet>
            <title>{metadata.title}</title>
            <meta name="description" content={metadata.description} />
            {metadata.keywords && <meta name="keywords" content={metadata.keywords} />}
            {metadata.canonicalUrl && <link rel="canonical" href={metadata.canonicalUrl} />}

            {/* Open Graph Tags */}
            <meta property="og:title" content={metadata.title} />
            <meta property="og:description" content={metadata.description} />
            <meta property="og:type" content={metadata.type || 'website'} />
            {metadata.ogImage && <meta property="og:image" content={metadata.ogImage} />}

            {/* Rich Product Data */}
            {metadata.type === 'product' && metadata.productData && (
                <>
                    <meta property="product:price:amount" content={metadata.productData.price} />
                    <meta property="product:price:currency" content={metadata.productData.currency} />
                    <meta property="product:availability" content={metadata.productData.availability} />
                </>
            )}

            {/* Robots */}
            {metadata.noIndex && <meta name="robots" content="noindex" />}
        </Helmet>
    );
};
```

---

## 7. White-Label & Admin Controls
*   **Global Settings**: Promote SEO to a first-class tab in the Admin Settings for easy access.
*   **Conditional UI**: SEO configuration sections in Product and Category editors are automatically hidden if `features.seo` is disabled.
*   **Live Previews**: Admins can see a real-time Google search preview as they type, ensuring titles and descriptions are optimized before saving.

---

## 8. SEO Best Practices in the Codebase
*   **Slug Integrity**: All products and categories use unique, URL-safe slugs.
*   **Internal Keywords**: Use the `meta_keywords` field for site-search optimization only.
*   **Canonical Safety**: Always point to the clean URL, avoiding tracking parameters or filter strings in the canonical tag. Point the `seo.canonicalBaseUrl` to the primary domain.
