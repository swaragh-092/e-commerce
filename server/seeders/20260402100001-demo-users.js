'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const adminId = uuidv4();
    const customerId = uuidv4();

    const hashedPassword = await bcrypt.hash('Password123', 12);
    
    await queryInterface.bulkInsert('users', [
      {
        id: adminId,
        first_name: 'Admin',
        last_name: 'User',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'super_admin',
        status: 'active',
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: customerId,
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'customer@example.com',
        password: hashedPassword,
        role: 'customer',
        status: 'active',
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    await queryInterface.bulkInsert('user_profiles', [
      {
        id: uuidv4(),
        user_id: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        user_id: customerId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    const roles = await queryInterface.sequelize.query(
      'SELECT id, slug FROM roles WHERE slug IN (:slugs)',
      {
        replacements: { slugs: ['super_admin', 'customer'] },
        type: Sequelize.QueryTypes.SELECT,
      }
    );
    const roleIdBySlug = Object.fromEntries(roles.map(({ id, slug }) => [slug, id]));
    const userRoleRows = [
      { userId: adminId, roleSlug: 'super_admin' },
      { userId: customerId, roleSlug: 'customer' },
    ]
      .filter(({ roleSlug }) => roleIdBySlug[roleSlug])
      .map(({ userId, roleSlug }) => ({
        id: uuidv4(),
        user_id: userId,
        role_id: roleIdBySlug[roleSlug],
        created_at: new Date(),
        updated_at: new Date(),
      }));

    if (userRoleRows.length) {
      await queryInterface.bulkInsert('user_roles', userRoleRows);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('user_profiles', null, {});
  }
};
