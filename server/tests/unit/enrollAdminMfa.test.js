import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const { resetForReenrollment } = require('../../src/scripts/enrollAdminMfa');
afterEach(() => vi.restoreAllMocks());

describe('operator MFA recovery', () => {
  it.each(['admin', 'customer'])('recovers a %s-base administrator with an audit record in one transaction', async role => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const locked = {
      id: 'admin-id', email: 'admin@example.test', role, status: 'active',
      twoFactorEnabled: true, update: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(callback => callback(transaction));
    vi.spyOn(db.User, 'findByPk').mockImplementation(async (_id, { include }) => ({
      ...locked,
      ...(role === 'customer' ? { roles: [{ slug: 'ops', baseRole: 'customer',
        permissions: include[0]?.include?.some(entry => entry.as === 'permissions') ? [{ key: 'products.read' }] : [],
      }] } : {}),
    }));
    vi.spyOn(db.User, 'findAll').mockResolvedValue([{ id: locked.id }]);
    vi.spyOn(db.RefreshToken, 'update').mockResolvedValue([2]);
    vi.spyOn(db.RememberedDevice, 'update').mockResolvedValue([3]);
    vi.spyOn(db.AuditLog, 'create').mockResolvedValue({});

    await resetForReenrollment(locked.id, locked.email, 'operator-account');

    expect(locked.update).toHaveBeenCalledWith({
      twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null,
    }, { transaction });
    expect(db.RefreshToken.update).toHaveBeenCalledWith(
      { revokedAt: expect.any(Date) }, expect.objectContaining({ transaction }),
    );
    expect(db.RememberedDevice.update).toHaveBeenCalledWith(
      { revokedAt: expect.any(Date) }, expect.objectContaining({ transaction }),
    );
    expect(db.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE', entity: 'USER', entityId: locked.id,
      changes: { mfaRecovery: 'operator_reset_for_reenrollment', operator: 'operator-account' },
    }), { transaction });
  });

  it('refuses if the account is no longer the verified active administrator', async () => {
    const locked = {
      id: 'admin-id', email: 'changed@example.test', role: 'customer', status: 'active',
      twoFactorEnabled: true, update: vi.fn(),
    };
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(callback => callback({ LOCK: { UPDATE: 'UPDATE' } }));
    vi.spyOn(db.User, 'findByPk').mockResolvedValue(locked);

    await expect(resetForReenrollment('admin-id', 'admin@example.test', 'operator-account'))
      .rejects.toThrow('Account changed during recovery');
    expect(locked.update).not.toHaveBeenCalled();
  });
});
