import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules/index');
const { getEligibleInventoryUsers } = require('../../src/modules/inventory/inventoryAlert.service');

const makeUser = ({ id, role, baseRole, status = 'active', emailVerified = true }) => {
  const roles = [{
    slug: `${id}-role`,
    name: `${baseRole} role`,
    baseRole,
    permissions: [{ key: 'products.read' }, { key: 'products.update' }],
  }];
  return {
    id,
    role,
    status,
    emailVerified,
    email: `${id}@example.test`,
    firstName: id,
    lastName: 'User',
    roles,
    toJSON: () => ({ id, role, status, emailVerified, roles }),
  };
};

describe('Inventory alert recipient eligibility', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows only active, verified admin staff with both product permissions', async () => {
    const staff = makeUser({ id: 'staff', role: 'admin', baseRole: 'admin' });
    const customer = makeUser({ id: 'customer', role: 'customer', baseRole: 'customer' });
    const unverified = makeUser({ id: 'unverified', role: 'admin', baseRole: 'admin', emailVerified: false });
    const inactive = makeUser({ id: 'inactive', role: 'admin', baseRole: 'admin', status: 'disabled' });
    vi.spyOn(db.User, 'findAll').mockResolvedValue([staff, customer, unverified, inactive]);

    const eligible = await getEligibleInventoryUsers();

    expect(eligible.map((user) => user.id)).toEqual(['staff']);
  });
});
