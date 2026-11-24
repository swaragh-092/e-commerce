'use strict';

const pattern = '"https://plus[.]unsplash[.]com/premium_photo-1683121817275-85d1dcf9e4c4([?#][^"]*)?"';
const replacement = '"/assets/fresh-arrivals-hero.webp"';

module.exports = {
  async up({ sequelize }) {
    await sequelize.transaction(async (transaction) => {
      const targets = {
        settings: ['value'],
        design_drafts: ['payload', 'base_snapshot'],
        design_draft_archives: ['payload', 'base_snapshot'],
        design_draft_versions: ['payload'],
        theme_packages: ['package_data'],
      };
      for (const [table, columns] of Object.entries(targets)) {
        for (const column of columns) {
          await sequelize.query(
            `UPDATE "${table}"
             SET "${column}" = regexp_replace("${column}"::text, $pattern, $replacement, 'g')::jsonb
             WHERE "${column}"::text ~ $pattern
             ${table === 'settings' ? "AND \"group\" IN ('homepage', 'sectionPresets')" : ''}`,
            { bind: { pattern, replacement }, transaction },
          );
        }
      }
    });
  },

  async down() {
    // The replacement is shared by migrated and newly edited slides.
  },
};
