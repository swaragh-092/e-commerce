import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const NotificationService = require('../../src/modules/notification/notification.service');
const { getDueAlerts, runAlertCycle } = require('../../src/modules/inventory/inventoryAlert.service');

afterEach(() => vi.restoreAllMocks());

describe('Inventory alert notification cycle', () => {
  it('retries an unnotified stockout after a recipient becomes available', async () => {
    const now = new Date('2026-09-28T05:15:00.000Z');
    const alertRows = [];
    let users = [];
    const alert = {
      id: 'alert-1',
      inventoryKey: 'product:product-1',
      productId: 'product-1',
      variantId: null,
      productName: 'Out-of-stock product',
      sku: 'SKU-1',
      severity: 'out_of_stock',
      status: 'open',
      quantity: 0,
      reservedQty: 0,
      availableQty: 0,
      threshold: 10,
      firstDetectedAt: now,
      lastNotifiedAt: null,
      update: vi.fn(async function update(values) {
        Object.assign(this, values);
        return this;
      }),
    };
    const config = {
      recipientUserIds: [],
      timezone: 'Asia/Kolkata',
      digestHour: 9,
      reminderIntervalDays: 1,
      immediateOutOfStock: true,
      includeEnvironmentRecipients: false,
    };
    const product = {
      id: 'product-1',
      name: 'Out-of-stock product',
      sku: 'SKU-1',
      type: 'simple',
      quantity: 0,
      reservedQty: 0,
      status: 'published',
      isEnabled: true,
      variants: [],
      toJSON() { return { ...this }; },
    };
    const recipient = {
      id: 'recipient-1',
      email: 'inventory@example.test',
      firstName: 'Inventory',
      lastName: 'Manager',
      role: 'admin',
      status: 'active',
      emailVerified: true,
      roles: [{
        slug: 'admin',
        baseRole: 'admin',
        name: 'Admin',
        permissions: [{ key: 'products.read' }, { key: 'products.update' }],
      }],
      toJSON() {
        return {
          id: this.id,
          role: this.role,
          status: this.status,
          emailVerified: this.emailVerified,
          roles: this.roles,
        };
      },
    };

    vi.spyOn(db.Setting, 'findOne').mockResolvedValue({ value: 10 });
    vi.spyOn(db.Product, 'findAll').mockResolvedValue([product]);
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
    vi.spyOn(db.InventoryAlert, 'findAll').mockImplementation(async (options = {}) => {
      if (options.where?.lastNotifiedAt === null) {
        return alertRows.filter((row) => row.status === 'open'
          && row.severity === 'out_of_stock'
          && row.lastNotifiedAt === null);
      }
      return alertRows.filter((row) => ['open', 'acknowledged'].includes(row.status));
    });
    vi.spyOn(db.InventoryAlert, 'findOrCreate').mockImplementation(async () => {
      alertRows.push(alert);
      return [alert, true];
    });
    vi.spyOn(db.InventoryAlert, 'update').mockImplementation(async (values) => {
      alertRows.forEach((row) => Object.assign(row, values));
      return [alertRows.length];
    });
    vi.spyOn(db.InventoryAlertConfig, 'findOrCreate').mockResolvedValue([config, false]);
    vi.spyOn(db.User, 'findAll').mockImplementation(async () => users);
    vi.spyOn(NotificationService, 'sendOnce')
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);

    const firstCycle = await runAlertCycle({ now });
    expect(firstCycle).toEqual({ queued: 0, reason: 'no_recipients' });
    expect(NotificationService.sendOnce).not.toHaveBeenCalled();

    users = [recipient];
    config.recipientUserIds = [recipient.id];
    await runAlertCycle({ now: new Date(now.getTime() + 60_000) });
    await runAlertCycle({ now: new Date(now.getTime() + 120_000) });

    expect(NotificationService.sendOnce).toHaveBeenCalledTimes(2);
    expect(alert.lastNotifiedAt).toBeNull();
    expect(NotificationService.sendOnce).toHaveBeenCalledWith(
      'inventory_alert_digest',
      recipient.email,
      expect.objectContaining({ inventory_alert_ids: [alert.id] }),
      recipient.id,
      null,
      'email',
      expect.any(String),
    );
  });

  it('pauses acknowledged reminders until the expected restock date, then resumes them', () => {
    const now = new Date('2026-09-28T05:15:00.000Z');
    const getDue = (id, status, expectedRestockAt = null) => ({
      id,
      status,
      expectedRestockAt,
      lastNotifiedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    });

    const due = getDueAlerts([
      getDue('open', 'open'),
      getDue('acknowledged-no-date', 'acknowledged'),
      getDue('acknowledged-future', 'acknowledged', new Date(now.getTime() + 60_000)),
      getDue('acknowledged-due', 'acknowledged', new Date(now.getTime() - 60_000)),
    ], now, 1);

    expect(due.map((alertItem) => alertItem.id)).toEqual(['open', 'acknowledged-due']);
  });
});
