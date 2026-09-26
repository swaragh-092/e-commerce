'use strict';

/**
 * Keep obvious development fixtures out of the public storefront.
 *
 * This is intentionally narrow: it archives only the exact test/demo names
 * reported during the production audit and does not delete any catalog data.
 * The settings updates are also exact-match/idempotent so merchant-authored
 * copy is left untouched.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`
        UPDATE products
        SET status = 'archived', is_enabled = false, updated_at = NOW()
        WHERE deleted_at IS NULL
          AND (
            LOWER(name) IN ('test1', 'demo')
            OR LOWER(name) LIKE 'demo product %'
            OR LOWER(slug) LIKE 'demo-product-%'
          )
      `, { transaction });

      await sequelize.query(`
        UPDATE brands
        SET is_active = false, updated_at = NOW()
        WHERE LOWER(name) = 'demo' OR LOWER(slug) = 'demo'
      `, { transaction });

      // A free-shipping message is only valid when checkout is configured to
      // waive shipping above a threshold. The storefront derives any such
      // message from shipping settings; this neutralizes the old dollar copy.
      await sequelize.query(`
        UPDATE settings
        SET value = to_jsonb('Fresh arrivals and curated picks are live.'::text), updated_at = NOW()
        WHERE "group" = 'announcement'
          AND "key" = 'text'
          AND LOWER(value #>> '{}') LIKE 'free shipping on orders over $%'
      `, { transaction });

      await sequelize.query(`
        UPDATE settings
        SET value = to_jsonb('₹'::text), updated_at = NOW()
        WHERE "group" = 'general'
          AND "key" = 'currencySymbol'
          AND (value #>> '{}') = '$'
          AND EXISTS (
            SELECT 1
            FROM settings currency
            WHERE currency."group" = 'general'
              AND currency."key" = 'currency'
              AND UPPER(currency.value #>> '{}') = 'INR'
          )
      `, { transaction });

      // Replace the exact placeholder brand-directory copy without touching
      // any custom title or subtitle a merchant has written.
      await sequelize.query(`
        UPDATE settings
        SET value = to_jsonb('Shop by Brand'::text), updated_at = NOW()
        WHERE "group" = 'brandsPage'
          AND "key" = 'heroTitle'
          AND LOWER(value #>> '{}') = 'check the brand what you want'
      `, { transaction });

      await sequelize.query(`
        UPDATE settings
        SET value = to_jsonb('Discover products grouped by your favorite brands.'::text), updated_at = NOW()
        WHERE "group" = 'brandsPage'
          AND "key" = 'heroSubtitle'
          AND LOWER(value #>> '{}') = 'ohh ohh see this brand'
      `, { transaction });

      // The section editor stores hero slides both as a standalone setting
      // and, for newer designs, nested inside homepage.sections.
      await sequelize.query(`
        UPDATE settings
        SET value = (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN LOWER(COALESCE(slide->>'title', '')) IN ('campaign headline', 'come shop here')
                OR LOWER(COALESCE(slide->>'subtitle', '')) IN ('add supporting copy for this slide.', 'promote a launch, sale, or category.')
              THEN slide || jsonb_build_object(
                'title', 'Fresh arrivals are here',
                'subtitle', 'Discover new products selected for your next shop.'
              )
              ELSE slide
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(value) AS slide
        ), updated_at = NOW()
        WHERE "group" = 'homepage'
          AND "key" = 'heroSlides'
          AND jsonb_typeof(value) = 'array'
      `, { transaction });

      await sequelize.query(`
        UPDATE settings
        SET value = (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN section->>'type' = 'hero-carousel' THEN jsonb_set(
                section,
                '{slides}',
                COALESCE((
                  SELECT jsonb_agg(
                    CASE
                      WHEN LOWER(COALESCE(slide->>'title', '')) IN ('campaign headline', 'come shop here')
                        OR LOWER(COALESCE(slide->>'subtitle', '')) IN ('add supporting copy for this slide.', 'promote a launch, sale, or category.')
                      THEN slide || jsonb_build_object(
                        'title', 'Fresh arrivals are here',
                        'subtitle', 'Discover new products selected for your next shop.'
                      )
                      ELSE slide
                    END
                  )
                  FROM jsonb_array_elements(COALESCE(section->'slides', '[]'::jsonb)) AS slide
                ), '[]'::jsonb)
              )
              ELSE section
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(value) AS section
        ), updated_at = NOW()
        WHERE "group" = 'homepage'
          AND "key" = 'sections'
          AND jsonb_typeof(value) = 'array'
      `, { transaction });
    });
  },

  async down() {
    // This data hygiene migration is intentionally one-way. Re-enabling
    // development fixtures could publish test content accidentally; archived
    // records remain available for an administrator to restore deliberately.
  },
};
