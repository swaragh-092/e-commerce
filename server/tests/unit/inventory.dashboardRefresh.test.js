import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const { getDashboardAlertData } = require('../../src/modules/inventory/inventoryAlert.service');
afterEach(() => vi.restoreAllMocks());

describe('dashboard inventory refresh', () => {
  it('resolves a disabled item’s previous alert before showing dashboard counts', async () => {
    const alert = { inventoryKey: 'product:disabled', status: 'open', severity: 'low_stock', toJSON() { return { ...this }; } };
    alert.update = vi.fn(async (values) => Object.assign(alert, values));
    vi.spyOn(db.Setting, 'findOne').mockResolvedValue({ value: 10 });
    vi.spyOn(db.Product, 'findAll').mockResolvedValue([]);
    vi.spyOn(db.User, 'findAll').mockResolvedValue([]);
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
    vi.spyOn(db.InventoryAlert, 'findAll').mockImplementation(async (options) => options.transaction ? [alert] : alert.status === 'resolved' ? [] : [alert]);
    vi.spyOn(db.InventoryAlert, 'count').mockImplementation(async () => alert.status === 'resolved' ? 0 : 1);
    const data = await getDashboardAlertData();
    expect(alert.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'resolved' }), expect.anything());
    expect(data.rows).toEqual([]);
    expect(data.totalCount).toBe(0);
  });
});
