import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const featureMiddleware = require('../../src/middleware/featureGate.middleware');
const NotificationService = require('../../src/modules/notification/notification.service');
const SettingsService = require('../../src/modules/settings/settings.service');

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(featureMiddleware, 'getResolvedFeature').mockResolvedValue(true);
  vi.spyOn(db.NotificationLog, 'create').mockResolvedValue({});
});

afterEach(() => vi.restoreAllMocks());

const recordUpdates = ({ claimResult = [0] } = {}) => {
  const calls = [];
  vi.spyOn(db.NotificationQueue, 'update').mockImplementation(async (values, options) => {
    calls.push({ values, where: options?.where });
    return options?.where?.status === 'queued' ? claimResult : [1];
  });
  return calls;
};

describe('notification queue recovery respects maxAttempts', () => {
  it('keeps a dedicated exhausted branch that fails stale jobs instead of requeueing them', async () => {
    const calls = recordUpdates();
    vi.spyOn(db.NotificationQueue, 'findAll').mockResolvedValue([]);

    await NotificationService.processQueued();

    const processingCalls = calls.filter((c) => c.where?.status === 'processing');
    expect(processingCalls).toHaveLength(2);
    const failedBranch = processingCalls.find((c) => c.values.status === 'failed');
    const requeueBranch = processingCalls.find((c) => c.values.status === 'queued');
    expect(failedBranch).toBeTruthy();
    expect(failedBranch.values.error).toMatch(/retry limit/i);
    expect(requeueBranch).toBeTruthy();
    // Both branches target only stale 'processing' rows.
    for (const branch of [failedBranch, requeueBranch]) {
      expect(branch.where.lockedAt).toBeDefined();
    }
  });

  it('never dispatches a claimed job whose attempts already exceed the cap', async () => {
    const job = {
      id: 'job-over-cap',
      templateName: 'order_placed',
      channel: 'email',
      status: 'queued',
      attempts: 3,
      maxAttempts: 3,
      variables: {},
      recipientEmail: 'user@example.com',
      update: vi.fn().mockResolvedValue(undefined),
    };
    recordUpdates({ claimResult: [1] });
    vi.spyOn(db.NotificationQueue, 'findAll').mockResolvedValue([job]);
    const findTemplate = vi.spyOn(db.NotificationTemplate, 'findOne');

    await NotificationService.processQueued();

    // Claim bumps attempts to 4 (> maxAttempts 3): must fail without dispatching.
    expect(findTemplate).not.toHaveBeenCalled();
    expect(job.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: 'Retry limit exceeded' }));
  });

  it('still dispatches the final allowed attempt (attempts == maxAttempts after claim)', async () => {
    const job = {
      id: 'job-final-attempt',
      templateName: 'order_placed',
      channel: 'email',
      status: 'queued',
      attempts: 2,
      maxAttempts: 3,
      variables: {},
      recipientEmail: 'user@example.com',
      update: vi.fn().mockResolvedValue(undefined),
    };
    recordUpdates({ claimResult: [1] });
    vi.spyOn(db.NotificationQueue, 'findAll').mockResolvedValue([job]);
    vi.spyOn(db.NotificationTemplate, 'findOne').mockResolvedValue({
      isActive: true, subject: 'Hello', bodyHtml: '<p>Hi</p>', bodyText: 'Hi',
    });
    vi.spyOn(SettingsService, 'getByGroup').mockResolvedValue({});

    await NotificationService.processQueued();

    // NODE_ENV=test makes email.channel skip real SMTP and return true.
    expect(db.NotificationTemplate.findOne).toHaveBeenCalled();
    expect(job.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
  });
});
