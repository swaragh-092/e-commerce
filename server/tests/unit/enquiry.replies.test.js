import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { Enquiry, User, sequelize } = require('../../src/modules');
const service = require('../../src/modules/enquiry/enquiry.service');
const settings = require('../../src/modules/settings/settings.service');
const notifications = require('../../src/modules/notification/notification.service');
let transaction, enquiry;
let currentEnquiry;
beforeEach(() => {
  transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
  enquiry = { id: 'eq', name: 'Customer', email: 'customer@example.test', status: 'pending', message: 'Question', save: vi.fn() };
  currentEnquiry = { status: 'pending', replies: [{ id: 'old', message: 'Previous reply' }], save: vi.fn() };
  vi.spyOn(sequelize, 'transaction').mockResolvedValue(transaction);
  vi.spyOn(Enquiry, 'findByPk').mockResolvedValueOnce(enquiry).mockResolvedValue(currentEnquiry);
  vi.spyOn(User, 'findByPk').mockResolvedValue({ firstName: 'Staff', lastName: 'Member', email: 'staff@example.test' });
  vi.spyOn(settings, 'getAll').mockResolvedValue({});
  vi.spyOn(notifications, 'sendEvent').mockResolvedValue(null);
  vi.spyOn(notifications, 'send').mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());
describe('Saved enquiry replies', () => {
  it('retains earlier replies and records sender and time under a row lock', async () => {
    const result = await service.replyToEnquiry('eq', ' New reply ', 'staff-id');
    expect(result.replies).toHaveLength(2);
    expect(result.replies[1]).toMatchObject({ message: 'New reply', senderId: 'staff-id', senderName: 'Staff Member', createdAt: expect.any(String) });
    expect(Enquiry.findByPk).toHaveBeenLastCalledWith('eq', { transaction, lock: 'UPDATE' });
    expect(currentEnquiry.save).toHaveBeenCalledWith({ transaction });
    expect(transaction.commit).toHaveBeenCalledOnce();
    expect(result.status).toBe('responded');
  });
  it('rolls back history and status if email cannot be queued', async () => {
    notifications.send.mockResolvedValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(service.replyToEnquiry('eq', 'New reply', 'staff-id')).rejects.toThrow('Failed to send reply email');
    expect(transaction.rollback).toHaveBeenCalledOnce();
    expect(transaction.commit).not.toHaveBeenCalled();
  });
});
