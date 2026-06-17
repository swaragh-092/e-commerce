# Documentation Index

> Last updated: 2026-05-29

## Reading Order

### New Developer Onboarding
1. **[README.md](../README.md)** — Project overview, quick start, tech stack
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — System architecture, project structure, module map
3. **[DATABASE.md](DATABASE.md)** — Database schema, models, relationships
4. **[API.md](API.md)** — API endpoint reference
5. **[AUTH-GUIDE.md](AUTH-GUIDE.md)** — Authentication, RBAC, permissions

### By Role

| Role | Essential Docs |
|------|---------------|
| **Frontend Dev** | ARCHITECTURE.md → FEATURES.md → STORE-TEMPLATES.md → SEO.md |
| **Backend Dev** | ARCHITECTURE.md → DATABASE.md → API.md → ASSOCIATIONS.md (in `server/src/modules/`) |
| **DevOps** | DEPLOYMENT.md → SECURITY.md (root) → TESTING_GUIDE.md |
| **Product/PM** | FEATURES.md → STORE-TEMPLATES.md → THEME-SYSTEM-COMPETITOR-GAP-ROADMAP.md → SHOPIFY-ARCHITECTURE-COMPARISON.md |

---

## Documentation Map

### Architecture & Platform
| Doc | What It Covers |
|-----|---------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, project structure, module reference, config system, feature flags, background jobs, API conventions |
| [DATABASE.md](DATABASE.md) | PostgreSQL schema, Sequelize models, UUID conventions, soft delete, JSONB patterns |
| [DATABASE-VISUALIZATION.md](DATABASE-VISUALIZATION.md) | Visual entity-relationship diagrams |
| [API.md](API.md) | Complete REST API endpoint reference with auth, params, and responses |
| [KIDS_DATABASE_EXPLANATION.md](KIDS_DATABASE_EXPLANATION.md) | Simplified database explainer (onboarding aid) |
| [SHOPIFY-ARCHITECTURE-COMPARISON.md](SHOPIFY-ARCHITECTURE-COMPARISON.md) | Real-world architectural comparison with Shopify |

### Features & Admin Capabilities
| Doc | What It Covers |
|-----|---------------|
| [FEATURES.md](FEATURES.md) | Complete feature catalog — admin + customer-facing, feature flags, permissions matrix |
| [STORE-TEMPLATES.md](STORE-TEMPLATES.md) | Store Templates system, theme marketplace, template composer, section registry, preview system, import/export, activation history |
| [THEME-SYSTEM-COMPETITOR-GAP-ROADMAP.md](THEME-SYSTEM-COMPETITOR-GAP-ROADMAP.md) | Roadmap for editable cards, component styles, page templates beyond homepage, and competitor-level theme editing |
| [AUTH-GUIDE.md](AUTH-GUIDE.md) | Authentication flows, JWT, sessions, RBAC, role management, brute-force protection, email verification |
| [COUPONS.md](COUPONS.md) | Coupon/discount engine — types, usage limits, stacking rules, targeting, auto-deactivation |
| [SHIPPING-SYSTEM.md](SHIPPING-SYSTEM.md) | Shipping rate engine, zones, carriers, volumetric weight, COD, fulfillment, webhook tracking |
| [SEO.md](SEO.md) | SEO meta tag management, URL overrides, canonical URLs, social OG tags, Google snippet preview |
| [MEDIA.md](MEDIA.md) | Media upload, storage, library UI, picker/uploader components |

### Operations & Security
| Doc | What It Covers |
|-----|---------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker deployment, AWS EC2 setup, environment config, backup strategy |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Manual & automated testing framework, QA workflows |
| [../SECURITY.md](../SECURITY.md) | Security policy, supported versions, vulnerability reporting |
| [CUSTOM-CODE.md](CUSTOM-CODE.md) | Custom CSS/JS injection system, security controls, sandboxing |

### Agent Rules
| Doc | What It Covers |
|-----|---------------|
| [../GEMINI.md](../GEMINI.md) | Standing agent rules for this workspace |

---

## Archive

Historical audit reports, implementation plans, and phase-tracking documents are in [archive/](archive/). These are preserved for reference but no longer authoritative. Key archived items:

- `AUDIT-REPORT.md` — April-May 2026 full-system audit (all findings resolved)
- `FIX-PLAN.md` — April 2026 fix plan (all 19 fixes applied)
- `CODE_REVIEW_REPORT.md` — April 2026 code review snapshot
- `THEME-MARKETPLACE-IMPLEMENTATION-PLAN-V1.md` — Original theme marketplace design (now implemented)
- `SMART-INSTALL-DEFAULTS.md` — Smart install design decision (now implemented)
- Various audit reports for specific modules (access control, reviews, search, etc.)
