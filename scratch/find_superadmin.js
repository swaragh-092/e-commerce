const { User, Role } = require('./server/src/modules');
const { Sequelize } = require('sequelize');

async function findSuperAdmin() {
  try {
    const superAdminRole = await Role.findOne({ where: { name: 'super_admin' } });
    if (!superAdminRole) {
      console.log('Super Admin role not found');
      return;
    }
    const user = await User.findOne({ where: { roleId: superAdminRole.id } });
    if (user) {
      console.log('Super Admin Email:', user.email);
    } else {
      console.log('No Super Admin user found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

findSuperAdmin();
