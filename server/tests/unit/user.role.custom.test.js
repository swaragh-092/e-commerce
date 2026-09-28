import { describe, expect, it, vi, beforeEach } from 'vitest';
const UserService = require('../../src/modules/user/user.service');
const AdminService = require('../../src/modules/admin/admin.service');
const { User, Role } = require('../../src/modules/index');
const { enrichUserAuthorization } = require('../../src/config/permissions');

describe('Custom Role vs Customer list filtering and enrichment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('UserService.listAll({ role: "customer" }) constructs query excluding users with non-customer assigned roles', async () => {
    const findSpy = vi.spyOn(User, 'findAndCountAll').mockResolvedValue({
      count: 0,
      rows: [],
    });

    await UserService.listAll({ page: 1, limit: 10, role: 'customer' });

    expect(findSpy).toHaveBeenCalledTimes(1);
    const callArgs = findSpy.mock.calls[0][0];
    const andClauses = callArgs.where[Object.getOwnPropertySymbols(callArgs.where).find((s) => s.description === 'and')];
    expect(andClauses).toBeDefined();

    // Verify NOT EXISTS for non-customer roles is included
    const hasNotExistsExclusion = andClauses.some((clause) => {
      const sqlVal = clause?.val || '';
      return typeof sqlVal === 'string' && sqlVal.includes("r.slug != 'customer'");
    });
    expect(hasNotExistsExclusion).toBe(true);
  });

  it('AdminService.listAccessUsers with default includeCustomers: false includes custom roles where slug != customer', async () => {
    const findSpy = vi.spyOn(User, 'findAndCountAll').mockResolvedValue({
      count: 0,
      rows: [],
    });
    vi.spyOn(Role, 'findAll').mockResolvedValue([]);

    await AdminService.listAccessUsers({ page: 1, limit: 10, includeCustomers: false });

    expect(findSpy).toHaveBeenCalledTimes(1);
    const callArgs = findSpy.mock.calls[0][0];
    const andClauses = callArgs.where[Object.getOwnPropertySymbols(callArgs.where).find((s) => s.description === 'and')];
    expect(andClauses).toBeDefined();

    // Verify EXISTS check includes custom roles (slug != customer) without base_role restriction
    const hasCustomRoleInclusion = andClauses.some((clause) => {
      const orClauses = clause[Object.getOwnPropertySymbols(clause).find((s) => s.description === 'or')];
      if (!Array.isArray(orClauses)) return false;
      return orClauses.some((c) => {
        const sqlVal = c?.val || '';
        return typeof sqlVal === 'string' && sqlVal.includes("r.slug != 'customer'") && !sqlVal.includes("r.base_role != 'customer'");
      });
    });
    expect(hasCustomRoleInclusion).toBe(true);
  });

  it('enrichUserAuthorization sets effective role to assigned custom role', () => {
    const rawUser = {
      id: 'cust-uuid-1',
      role: 'customer',
      firstName: 'Test',
      lastName: 'User',
      roles: [
        {
          id: 'role-testing-id',
          name: 'Testing',
          slug: 'testing',
          baseRole: 'customer',
          isSystem: false,
        },
      ],
    };

    const enriched = enrichUserAuthorization(rawUser);
    expect(enriched.role).toBe('testing');
    expect(enriched.roles).toEqual(['testing']);
  });
});
