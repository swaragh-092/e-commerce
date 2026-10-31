import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { Enquiry, sequelize } = require('../../src/modules');
const service = require('../../src/modules/enquiry/enquiry.service');
const notifications = require('../../src/modules/notification/notification.service');
const { findEvent } = require('../../src/modules/notification/notification.events');
const { DEFAULTS, TEMPLATE_VARIABLES } = require('../../src/modules/notification/notification.defaults');
let enquiry, transaction;
beforeEach(() => {
  transaction = { LOCK: { UPDATE: 'UPDATE' } };
  enquiry = { id: 'eq', name: 'Customer', email: 'customer@example.test', message: 'Question', status: 'pending', save: vi.fn() };
  vi.spyOn(sequelize, 'transaction').mockImplementation(callback => callback(transaction));
  vi.spyOn(Enquiry, 'findByPk').mockResolvedValue(enquiry);
  vi.spyOn(notifications, 'sendEvent').mockResolvedValue(null);
  vi.spyOn(notifications, 'send').mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());
describe('Enquiry closure outcomes', () => {
  it.each(['closed_converted', 'closed_lost'])('queues the customer notification for %s atomically', async status => {
    await service.updateStatus('eq', status, 'staff');
    expect(enquiry.save).toHaveBeenCalledWith({ transaction });
    expect(notifications.sendEvent).toHaveBeenCalledWith(`enquiry_${status}`, expect.objectContaining({ transaction, variables: expect.objectContaining({ enquiry_id: 'eq', notification_event_id: expect.any(String) }) }));
    expect(notifications.send).toHaveBeenCalledWith(`enquiry_${status}_customer`, enquiry.email, expect.any(Object), 'staff', null, 'email', transaction);
    expect(findEvent(`enquiry_${status}`).customerTemplate).toBe(`enquiry_${status}_customer`);
    expect(DEFAULTS[`enquiry_${status}_customer`].bodyText).toContain('{{productName}}');
    expect(TEMPLATE_VARIABLES[`enquiry_${status}_customer`]).toContain('status_label');
  });
  it('does not resend for an unchanged outcome', async () => {
    enquiry.status = 'closed_lost';
    await service.updateStatus('eq', 'closed_lost');
    expect(enquiry.save).not.toHaveBeenCalled();
    expect(notifications.sendEvent).not.toHaveBeenCalled();
  });
  it('respects disabled event rules without falling back to a customer email', async () => {
    notifications.sendEvent.mockResolvedValue([]);
    await service.updateStatus('eq', 'closed_converted');
    expect(notifications.send).not.toHaveBeenCalled();
  });
  it('keeps legacy closed records and reopening compatible without closure emails', async () => {
    await service.updateStatus('eq', 'closed');
    await service.updateStatus('eq', 'pending');
    expect(notifications.sendEvent).not.toHaveBeenCalled();
  });
  it('rejects unknown statuses', async () => {
    await expect(service.updateStatus('eq', 'won')).rejects.toThrow('Invalid status');
  });
});
