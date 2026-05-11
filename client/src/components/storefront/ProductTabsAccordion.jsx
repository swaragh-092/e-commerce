/**
 * ProductTabsAccordion.jsx
 *
 * Public-facing accordion for product custom tabs on the storefront.
 *
 * Design:
 *  - One panel open at a time (first open by default)
 *  - Smooth CSS height animation via max-height transition
 *  - Matches the existing MUI-based storefront typography/colour system via
 *    CSS custom properties that fall back to sensible defaults
 *  - DOMPurify client-side sanitisation on top of server-side sanitize-html
 *    (defence-in-depth against XSS)
 *
 * Usage:
 *  <ProductTabsAccordion productId={product.id} tabs={product.tabs} />
 *
 *  `tabs` should be the pre-fetched array from the product API response.
 *  If omitted the component will self-fetch from the server.
 */
import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material';
import DOMPurify from 'dompurify';
import productTabService from '../../services/productTabService';

// ─── DOMPurify config ─────────────────────────────────────────────────────────
const PURIFY_CONFIG = {
    ALLOWED_TAGS: [
        'b', 'i', 'em', 'strong', 'u', 'strike', 'del', 's',
        'a', 'p', 'br', 'hr',
        'ul', 'ol', 'li',
        'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'pre', 'code',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'img', 'figure', 'figcaption',
        'div', 'span',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel', 'class', 'width', 'height', 'colspan', 'rowspan'], // Removed 'style'
    FORCE_BODY: true,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'svg'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onchange'],
};

const sanitize = (html) => {
    if (!html) return '';
    if (typeof DOMPurify === 'undefined' || !DOMPurify.sanitize) return '';
    return DOMPurify.sanitize(html, PURIFY_CONFIG);
};

// ─── Chevron SVG ──────────────────────────────────────────────────────────────
const ChevronDown = () => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414
               1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
        />
    </svg>
);

// ─── Single accordion item ────────────────────────────────────────────────────
const AccordionItem = ({ tab, isOpen, onToggle }) => {
    const theme = useTheme();
    const primaryColor = theme.palette.primary.main;
    const borderRadius = theme.shape.borderRadius;

    return (
        <div
            className={`ptab-item${isOpen ? ' ptab-item--open' : ''}`}
            style={{
                borderRadius: borderRadius,
                marginBottom: 12,
                border: '1px solid',
                borderColor: isOpen ? primaryColor : theme.palette.divider,
                overflow: 'hidden',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: isOpen ? `0 4px 12px ${primaryColor}15` : 'none',
            }}
        >
            {/* ── Header button ─────────────────────────────────────────────── */}
            <button
                id={`ptab-btn-${tab.id}`}
                aria-expanded={isOpen}
                aria-controls={`ptab-panel-${tab.id}`}
                className="ptab-button"
                onClick={onToggle}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    background: isOpen
                        ? `${primaryColor}08` // 8% opacity of brand primary
                        : theme.palette.background.paper,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.25s',
                    gap: 12,
                }}
            >
                <span
                    style={{
                        fontSize: '0.95rem',
                        fontWeight: isOpen ? 700 : 600,
                        color: isOpen
                            ? primaryColor
                            : theme.palette.text.primary,
                        lineHeight: 1.4,
                        transition: 'color 0.2s',
                        fontFamily: 'inherit',
                    }}
                >
                    {tab.title}
                </span>
                <span
                    style={{
                        flexShrink: 0,
                        color: isOpen
                            ? primaryColor
                            : theme.palette.text.secondary,
                        transition: 'transform 0.3s, color 0.2s',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <ChevronDown />
                </span>
            </button>

            {/* ── Body panel ────────────────────────────────────────────────── */}
            {isOpen && (
                <div
                    id={`ptab-panel-${tab.id}`}
                    role="region"
                    aria-labelledby={`ptab-btn-${tab.id}`}
                    style={{
                        padding: '16px 20px 24px',
                        background: theme.palette.background.paper,
                        borderTop: `1px solid ${theme.palette.divider}`,
                        animation: 'ptab-slidein 0.22s ease',
                    }}
                >
                    <div
                        className="ptab-content"
                        style={{ color: theme.palette.text.secondary }}
                        dangerouslySetInnerHTML={{ __html: sanitize(tab.content) }}
                    />
                </div>
            )}
        </div>
    );
};

// ─── Skeleton loader ──────────────────────────────────────────────────────────
const Skeleton = () => {
    const theme = useTheme();
    return (
        <div style={{ marginTop: 8 }}>
            {[80, 65, 90].map((w, i) => (
                <div
                    key={i}
                    style={{
                        height: 54,
                        borderRadius: theme.shape.borderRadius,
                        marginBottom: 12,
                        width: `${w}%`,
                        background: theme.palette.mode === 'dark'
                            ? 'linear-gradient(90deg,#2c2c2c 25%,#3d3d3d 50%,#2c2c2c 75%)'
                            : 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'ptab-shimmer 1.4s infinite',
                    }}
                />
            ))}
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * @param {string}   productId     UUID of the product (used for self-fetch fallback)
 * @param {Array}    tabs          Pre-fetched tab array from product API response.
 *                                 When provided, no extra network request is made.
 */
const ProductTabsAccordion = ({ productId, tabs: initialTabs }) => {
    const theme = useTheme();
    const [tabs, setTabs] = useState(null);     // null = not yet resolved
    const [openId, setOpenId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(false);

    const primaryColor = theme.palette.primary.main;

    useEffect(() => {
        // Resolve tabs: prefer pre-fetched prop, fall back to self-fetch
        if (Array.isArray(initialTabs)) {
            // Explicitly handle isActive: undefined/null are treated as active (true by default in DB)
            const active = initialTabs.filter((t) => t.isActive !== false);
            setTabs(active);
            if (active.length > 0) setOpenId(active[0].id);
            return;
        }
        if (!productId) return;

        setLoading(true);
        productTabService
            .getTabs(productId)
            .then((res) => {
                const raw = res?.data?.data ?? [];
                const active = raw.filter((t) => t.isActive !== false);
                setTabs(active);
                if (active.length > 0) setOpenId(active[0].id);
            })
            .catch(() => setFetchError(true))
            .finally(() => setLoading(false));
    }, [productId, initialTabs]);

    const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

    // Nothing to show
    if (fetchError || (tabs && tabs.length === 0)) return null;

    return (
        <div style={{ marginTop: 28, marginBottom: 8 }}>
            {/* Global styles injected once */}
            <style>{`
                @keyframes ptab-slidein {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes ptab-shimmer {
                    0%   { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                /* Rich-text content styles */
                .ptab-content { font-size: 0.9rem; line-height: 1.8; color: #4b5563; }
                .ptab-content h2 { font-size: 1.1rem; font-weight: 700; margin: 0.9rem 0 0.45rem; color: #1a1a1a; }
                .ptab-content h3 { font-size: 1rem; font-weight: 600; margin: 0.75rem 0 0.35rem; color: #1a1a1a; }
                .ptab-content h4 { font-size: 0.95rem; font-weight: 600; margin: 0.6rem 0 0.3rem; }
                .ptab-content p  { margin: 0.3rem 0 0.75rem; }
                .ptab-content ul, .ptab-content ol { padding-left: 1.5rem; margin: 0.4rem 0 0.8rem; }
                .ptab-content li { margin-bottom: 0.3rem; }
                .ptab-content a  { color: #1976d2; text-decoration: underline; }
                .ptab-content a:hover { color: #1565c0; }
                .ptab-content blockquote {
                    border-left: 3px solid #1976d2;
                    margin: 0.75rem 0;
                    padding: 0.3rem 0.9rem;
                    color: #6b7280;
                    background: #f8fafc;
                    border-radius: 0 4px 4px 0;
                }
                .ptab-content code {
                    background: #f3f4f6;
                    padding: 0.1em 0.4em;
                    border-radius: 4px;
                    font-size: 0.82em;
                    font-family: monospace;
                }
                .ptab-content pre {
                    background: #1e293b;
                    color: #e2e8f0;
                    padding: 1rem 1.25rem;
                    border-radius: 6px;
                    overflow-x: auto;
                    font-size: 0.8rem;
                    margin: 0.75rem 0;
                }
                .ptab-content table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 0.75rem 0;
                    font-size: 0.875rem;
                }
                .ptab-content th, .ptab-content td {
                    border: 1px solid #e5e7eb;
                    padding: 0.5rem 0.75rem;
                    text-align: left;
                }
                .ptab-content th {
                    background: #f9fafb;
                    font-weight: 600;
                    color: #374151;
                }
                .ptab-content img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 6px;
                    display: block;
                    margin: 0.5rem 0;
                }
                .ptab-content hr { border: none; border-top: 1px solid ${theme.palette.divider}; margin: 1rem 0; }

                .ptab-button:focus-visible {
                    outline: 2px solid ${primaryColor};
                    outline-offset: -2px;
                    background: ${primaryColor}12 !important;
                }
                .ptab-button:focus:not(:focus-visible) {
                    outline: none;
                }
            `}</style>

            {loading && <Skeleton />}

            {!loading && tabs && tabs.map((tab) => (
                <AccordionItem
                    key={tab.id}
                    tab={tab}
                    isOpen={openId === tab.id}
                    onToggle={() => toggle(tab.id)}
                />
            ))}
        </div>
    );
};

export default ProductTabsAccordion;
