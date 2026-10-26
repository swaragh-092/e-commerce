'use strict';

// Records when a confirm email was successfully queued for the current
// consent session, so GET /newsletter/me can report `confirmationQueued` and
// clients stop showing a "check your inbox" notice after a failed send.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('newsletter_subscribers', 'last_confirm_sent_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('newsletter_subscribers', 'last_confirm_sent_at');
  },
};
