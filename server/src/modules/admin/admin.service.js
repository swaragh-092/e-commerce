'use strict';

const { Op, fn, col, literal } = require('sequelize');
const slugify = require('slugify');
const db = require('../index');
const { Order, User, Product, Role, Permission } = db;
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { ACTIONS, ENTITIES, ROLES } = require('../../config/constants');
const {
  PERMISSIONS,
  enrichUserAuthorization,
  RESERVED_SUPER_ADMIN_PERMISSIONS,
  getPermissionsForUser,
} = require('../../config/permissions');
const { getPagination } = require('../../utils/pagination');

const roleInclude = [
  {
    model: Permission,
    as: 'permissions',
    through: { attributes: [] },
  },
];

const userRoleInclude = [
  {
    model: Role,
    as: 'roles',
    through: { attributes: [] },
    include: roleInclude,
  },
];

const serializeRole = (role) => ({
  id: role.id,
  key: role.slug,
  slug: role.slug,
  name: role.name,
  description: role.description,
  baseRole: role.baseRole,
  isSystem: Boolean(role.isSystem),
  isActive: Boolean(role.isActive),
  permissions: (role.permissions || []).map((permission) => ({
    id: permission.id,
    key: permission.key,
    name: permission.name,
    group: permission.group,
    description: permission.description,
  })),
});

const serializeAccessUser = (user) => {
  const enriched = enrichUserAuthorization(user);
  const assignedRole = Array.isArray(user.roles) && user.roles.length ? serializeRole(user.roles[0]) : null;

  return {
    ...enriched,
    assignedRole,
    roleId: assignedRole?.id || null,
    roleName: assignedRole?.name || user.role,
  };
};

const canManageCustomRoles = (user) => getPermissionsForUser(user).includes(PERMISSIONS.ROLES_MANAGE);
const canManageSystemRoles = (user) => getPermissionsForUser(user).includes(PERMISSIONS.SYSTEM_ROLES_MANAGE);

/**
 * Overall dashboard stats:
 *  totalRevenue, orderCount, customerCount, productCount,
 *  pendingOrders, lowStockCount
 */
const getStats = async () => {
  const [
    revenueResult,
    orderCount,
    customerCount,
    productCount,
    pendingOrders,
    lowStockCount,
  ] = await Promise.all([
    // Total revenue from paid/processing/shipped/delivered orders
    Order.findOne({
      attributes: [[fn('COALESCE', fn('SUM', col('"Order".total')), 0), 'totalRevenue']],
      where: { status: { [Op.in]: ['paid', 'processing', 'shipped', 'delivered'] } },
      raw: true,
    }),
    Order.count(),
    User.count({ where: { role: 'customer' } }),
    Product.count({ where: { status: 'published' } }),
    Order.count({ where: { status: 'pending_payment' } }),
    Product.count({
      where: literal('"Product".quantity - "Product".reserved_qty < 10'),
    }),
  ]);

  return {
    totalRevenue: parseFloat(revenueResult?.totalRevenue || 0),
    orderCount,
    customerCount,
    productCount,
    pendingOrders,
    lowStockCount,
  };
};

/**
 * Sales chart data grouped by period.
 * @param {'daily'|'weekly'|'monthly'} period
 */
const getSalesChart = async (period = 'monthly') => {
  const { sequelize } = db;

  // Determine truncation level
  const trunc = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

  const rows = await Order.findAll({
    attributes: [
      [fn('DATE_TRUNC', trunc, col('"Order".created_at')), 'date'],
      [fn('COALESCE', fn('SUM', col('"Order".total')), 0), 'revenue'],
      [fn('COUNT', col('"Order".id')), 'orderCount'],
    ],
    where: {
      status: { [Op.in]: ['paid', 'processing', 'shipped', 'delivered'] },
      createdAt: {
        // Last 90 days for daily, last 52 weeks for weekly, last 12 months for monthly
        [Op.gte]: new Date(
          period === 'daily'
            ? Date.now() - 90 * 864e5
            : period === 'weekly'
            ? Date.now() - 364 * 864e5
            : Date.now() - 365 * 864e5,
        ),
      },
    },
    group: [fn('DATE_TRUNC', trunc, col('"Order".created_at'))],
    order: [[fn('DATE_TRUNC', trunc, col('"Order".created_at')), 'ASC']],
    raw: true,
  });

  return rows.map((r) => ({
    date: r.date,
    revenue: parseFloat(r.revenue),
    orderCount: parseInt(r.orderCount, 10),
  }));
};

/**
 * Low-stock products where available qty < threshold.
 * @param {number} threshold - default 10
 */
const getLowStock = async (threshold = 10) => {
  const rows = await Product.findAll({
    attributes: ['id', 'name', 'quantity', 'reservedQty'],
    where: {
      status: 'published',
      [Op.and]: literal(`"Product".quantity - "Product".reserved_qty < ${parseInt(threshold, 10)}`),
    },
    order: [['quantity', 'ASC']],
    limit: 50,
  });

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    quantity: p.quantity,
    reservedQty: p.reservedQty,
    availableQty: p.quantity - p.reservedQty,
  }));
};

/**
 * Five most recent orders with customer name + status.
 */
const getRecentOrders = async () => {
  const orders = await Order.findAll({
    attributes: ['id', 'orderNumber', 'status', 'total', 'createdAt'],
    include: [
      {
        model: User,
        attributes: ['id', 'firstName', 'lastName', 'email'],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: parseFloat(o.total),
    createdAt: o.createdAt,
    customer: o.User
      ? { id: o.User.id, name: `${o.User.firstName} ${o.User.lastName}`, email: o.User.email }
      : null,
  }));
};

const getAccessRoles = async () => {
  const roles = await Role.findAll({
    include: roleInclude,
    order: [['isSystem', 'DESC'], ['name', 'ASC']],
  });

  return roles.map(serializeRole);
};

const getAccessPermissions = async () => {
  const permissions = await Permission.findAll({
    order: [['group', 'ASC'], ['name', 'ASC']],
  });

  return permissions.map((permission) => ({
    id: permission.id,
    key: permission.key,
    name: permission.name,
    group: permission.group,
    description: permission.description,
    reserved: RESERVED_SUPER_ADMIN_PERMISSIONS.includes(permission.key),
  }));
};

const buildRoleSlug = async (name, roleId = null) => {
  const baseSlug = slugify(name, { lower: true, strict: true, trim: true }) || 'custom-role';
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existingRole = await Role.findOne({ where: { slug } });
    if (!existingRole || existingRole.id === roleId) {
      return slug;
    }
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

const createAccessRole = async ({ name, description, baseRole, permissionIds }, actingUserId) => {
  return db.sequelize.transaction(async (transaction) => {
    const permissions = await Permission.findAll({ where: { id: permissionIds }, transaction });
    if (permissions.length !== permissionIds.length) {
      throw new AppError('VALIDATION_ERROR', 400, 'One or more permissions are invalid');
    }

    if (permissions.some((permission) => RESERVED_SUPER_ADMIN_PERMISSIONS.includes(permission.key))) {
      throw new AppError('FORBIDDEN', 403, 'Reserved super admin permissions cannot be assigned to custom roles');
    }

    const role = await Role.create({
      name: name.trim(),
      slug: await buildRoleSlug(name),
      description: description || null,
      baseRole,
      isSystem: false,
      isActive: true,
    }, { transaction });

    await role.setPermissions(permissionIds, { transaction });
    const createdRole = await Role.findByPk(role.id, { include: roleInclude, transaction });

    try {
      await AuditService.log({
        userId: actingUserId,
        action: ACTIONS.CREATE,
        entity: 'Role',
        entityId: role.id,
        changes: {
          name: role.name,
          baseRole,
          permissionIds,
        },
      }, transaction);
    } catch (error) {}

    return serializeRole(createdRole);
  });
};

const updateAccessRole = async (roleId, payload, actingUser) => {
  return db.sequelize.transaction(async (transaction) => {
    const role = await Role.findByPk(roleId, { include: roleInclude, transaction });
    if (!role) {
      throw new AppError('NOT_FOUND', 404, 'Role not found');
    }

    if (role.isSystem && !canManageSystemRoles(actingUser)) {
      throw new AppError('FORBIDDEN', 403, 'Only super admins can edit system roles');
    }

    if (!role.isSystem && !canManageCustomRoles(actingUser)) {
      throw new AppError('FORBIDDEN', 403, 'You do not have permission to edit custom roles');
    }

    if (payload.permissionIds) {
      const permissions = await Permission.findAll({ where: { id: payload.permissionIds }, transaction });
      if (permissions.length !== payload.permissionIds.length) {
        throw new AppError('VALIDATION_ERROR', 400, 'One or more permissions are invalid');
      }
      if (!role.isSystem && permissions.some((permission) => RESERVED_SUPER_ADMIN_PERMISSIONS.includes(permission.key))) {
        throw new AppError('FORBIDDEN', 403, 'Reserved super admin permissions cannot be assigned to custom roles');
      }
      await role.setPermissions(payload.permissionIds, { transaction });
    }

    const updates = {};
    if (!role.isSystem && payload.name && payload.name.trim() !== role.name) {
      updates.name = payload.name.trim();
      updates.slug = await buildRoleSlug(payload.name, role.id);
    } else if (role.isSystem && payload.name && payload.name.trim() !== role.name) {
      throw new AppError('VALIDATION_ERROR', 400, 'System role names cannot be changed');
    }
    if (payload.description !== undefined) {
      updates.description = payload.description || null;
    }
    if (!role.isSystem && payload.baseRole) {
      updates.baseRole = payload.baseRole;
    } else if (role.isSystem && payload.baseRole && payload.baseRole !== role.baseRole) {
      throw new AppError('VALIDATION_ERROR', 400, 'System role base role cannot be changed');
    }

    if (Object.keys(updates).length > 0) {
      await role.update(updates, { transaction });
    }

    const updatedRole = await Role.findByPk(role.id, { include: roleInclude, transaction });

    try {
      await AuditService.log({
        userId: actingUser.id,
        action: ACTIONS.UPDATE,
        entity: 'Role',
        entityId: role.id,
        changes: payload,
      }, transaction);
    } catch (error) {}

    return serializeRole(updatedRole);
  });
};

const listAccessUsers = async ({ page, limit, search, roleId, includeCustomers = false }) => {
  const { limit: pageSize, offset } = getPagination(page, limit);
  const where = {};
  const include = [...userRoleInclude];

  if (roleId) {
    include[0] = {
      ...include[0],
      where: { id: roleId },
    };
  }

  if (search) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${search}%` } },
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (!includeCustomers) {
    where.role = { [Op.ne]: ROLES.CUSTOMER };
  }

  const result = await User.findAndCountAll({
    where,
    include,
    distinct: true,
    limit: pageSize,
    offset,
    order: [['createdAt', 'DESC']],
  });

  return {
    count: result.count,
    rows: result.rows.map((user) => serializeAccessUser(user)),
  };
};

const updateUserRole = async (userId, roleId, actingUserId) => {
  return db.sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { include: userRoleInclude, transaction });
    if (!user) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }

    if (user.id === actingUserId) {
      throw new AppError('VALIDATION_ERROR', 400, 'You cannot change your own role');
    }

    const role = await Role.findByPk(roleId, { include: roleInclude, transaction });
    if (!role || !role.isActive) {
      throw new AppError('NOT_FOUND', 404, 'Role not found');
    }

    const previousRole = user.role;
    const previousAssignedRole = Array.isArray(user.roles) && user.roles.length ? user.roles[0] : null;

    if (previousRole === ROLES.SUPER_ADMIN && role.baseRole !== ROLES.SUPER_ADMIN) {
      const superAdminCount = await User.count({
        where: { role: ROLES.SUPER_ADMIN, status: 'active' },
        transaction,
      });

      if (superAdminCount <= 1) {
        throw new AppError('VALIDATION_ERROR', 400, 'You cannot demote the last active super admin');
      }
    }

    await user.update({ role: role.baseRole }, { transaction });
    await user.setRoles([role], { transaction });

    const updatedUser = await User.findByPk(user.id, { include: userRoleInclude, transaction });

    try {
      await AuditService.log({
        userId: actingUserId,
        action: ACTIONS.UPDATE,
        entity: ENTITIES.USER,
        entityId: user.id,
        changes: {
          baseRole: { old: previousRole, new: role.baseRole },
          assignedRole: { old: previousAssignedRole?.slug || null, new: role.slug },
        },
      }, transaction);
    } catch (error) {}

    return serializeAccessUser(updatedUser);
  });
};

module.exports = {
  getStats,
  getSalesChart,
  getLowStock,
  getRecentOrders,
  getAccessRoles,
  getAccessPermissions,
  createAccessRole,
  updateAccessRole,
  listAccessUsers,
  updateUserRole,
};
