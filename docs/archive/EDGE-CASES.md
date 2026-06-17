# Edge Cases — Resolution Status

> All items from the original audit have been incorporated into the architecture docs (v2).

| #   | Gap                                    | Status       | Where Fixed                                                            |
| --- | -------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| 1   | Coupon/Discount module                 | ✅ Resolved   | ARCHITECTURE.md Module 7, DATABASE.md, API.md                          |
| 2   | Email/Notification module              | ✅ Resolved   | ARCHITECTURE.md Module 14, DATABASE.md                                 |
| 3   | Inventory overselling (race condition) | ✅ Resolved   | ARCHITECTURE.md Module 3 (atomic UPDATE)                               |
| 4   | Reserved qty timeout                   | ✅ Resolved   | ARCHITECTURE.md (cron job section)                                     |
| 5   | Double payment                         | ✅ Resolved   | ARCHITECTURE.md Module 6 (idempotency keys)                            |
| 6   | Cart price drift                       | ✅ Resolved   | ARCHITECTURE.md Module 5 (checkout flow step 2-4)                      |
| 7   | Shipping calculation                   | ✅ Resolved   | ARCHITECTURE.md Module 1 (Settings: shipping config)                   |
| 8   | Tax calculation                        | ✅ Resolved   | ARCHITECTURE.md Module 1 (Settings: tax config) + per-product override |
| 9   | Rate limiting                          | ✅ Resolved   | ARCHITECTURE.md (Security section), API.md                             |
| 10  | CORS                                   | ✅ Resolved   | ARCHITECTURE.md (Security section), DEPLOYMENT.md                      |
| 11  | XSS / Input sanitization               | ✅ Resolved   | ARCHITECTURE.md (Security section)                                     |
| 12  | JWT blacklisting                       | ✅ Resolved   | ARCHITECTURE.md Module 2 (documented trade-off)                        |
| 13  | Password policy                        | ✅ Resolved   | ARCHITECTURE.md (Security section)                                     |
| 14  | Helmet headers                         | ✅ Resolved   | ARCHITECTURE.md (Security section), DEPLOYMENT.md                      |
| 15  | File upload validation                 | ✅ Resolved   | ARCHITECTURE.md (Security section + Module 13)                         |
| 16  | Address deletion breaks orders         | ✅ Resolved   | DATABASE.md (shippingAddressSnapshot JSONB)                            |
| 17  | Category deletion with products        | ✅ Resolved   | ARCHITECTURE.md (ON DELETE SET NULL + admin warning)                   |
| 18  | Slug collision                         | ✅ Resolved   | ARCHITECTURE.md Module 3 (generateUniqueSlug)                          |
| 19  | Review without purchase                | ✅ Resolved   | ARCHITECTURE.md Module 10 (configurable feature flag)                  |
| 20  | Cart expiry / cleanup                  | ✅ Resolved   | ARCHITECTURE.md (cron job section)                                     |
| 21  | Missing DB constraints                 | ✅ Resolved   | DATABASE.md (CHECK constraints on all tables)                          |
| 22  | Search index                           | ✅ Documented | DATABASE.md (optional FTS index commented)                             |
| 23  | Invoice PDF                            | 📋 Future     | Planned for post-Phase 6                                               |
| 24  | Return/Exchange                        | 📋 Future     | Planned for post-Phase 6                                               |
| 25  | Webhook idempotency                    | ✅ Resolved   | ARCHITECTURE.md Module 6, DATABASE.md (webhook_events)                 |
| 26  | API versioning                         | 📋 Future     | Documented as consideration                                            |
| 27  | Logging/Error tracking                 | ✅ Resolved   | DEPLOYMENT.md (production checklist)                                   |
| 28  | Database backups                       | ✅ Resolved   | DEPLOYMENT.md (backup section with retention policy)                   |

**25 of 28 items resolved. 3 deferred to future phases.**
