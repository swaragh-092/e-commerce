'use strict';

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE gift_card_purchases ADD COLUMN issued_manually boolean NOT NULL DEFAULT false;
            ALTER TABLE gift_card_deliveries ADD COLUMN message_id text;
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE gift_card_deliveries DROP COLUMN message_id;
            ALTER TABLE gift_card_purchases DROP COLUMN issued_manually;
        `);
    },
};
