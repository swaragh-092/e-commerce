'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('pages', [
      {
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Terms and Conditions',
        slug: 'terms-and-conditions',
        content: `<h1>Terms and Conditions</h1><p>Welcome to our store. By using our website, you agree to these terms...</p><h2>1. Introduction</h2><p>These terms govern your use of our service...</p>`,
        link_position: 'bottom',
        link_placement: '1',
        status: 'published',
        is_system: true,
        sort_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        content: `<h1>Privacy Policy</h1><p>Your privacy is important to us. We collect minimal data for order processing...</p><h2>Data Collection</h2><p>We collect your email, address, and name for delivery purposes...</p>`,
        link_position: 'bottom',
        link_placement: '1',
        status: 'published',
        is_system: true,
        sort_order: 2,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        title: 'Return Policy',
        slug: 'return-policy',
        content: `<h1>Return Policy</h1><p>We offer a 30-day return policy. Items must be in original condition...</p><h2>Refund Process</h2><p>Once we receive the item, we will process your refund within 7 days...</p>`,
        link_position: 'bottom',
        link_placement: '1',
        status: 'published',
        is_system: true,
        sort_order: 3,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('pages', null, {});
  }
};
