'use strict';

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Password Reset & Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('NotificationService.send defensively handles a transaction passed as channel parameter', async () => {
    const NotificationService = require('../../src/modules/notification/notification.service');
    const { NotificationTemplate, NotificationQueue } = require('../../src/modules');

    const mockTemplate = { id: 'tpl-1', name: 'password_reset', channel: 'email', isActive: true };
    const findOneSpy = vi.spyOn(NotificationTemplate, 'findOne').mockResolvedValue(mockTemplate);
    const createSpy = vi.spyOn(NotificationQueue, 'create').mockResolvedValue({ id: 'job-1' });

    const fakeTransaction = { id: 'tx-123', commit: vi.fn(), rollback: vi.fn() };

    // Call send passing fakeTransaction as the 6th parameter (channel)
    const result = await NotificationService.send(
      'password_reset',
      'user@example.com',
      { name: 'John', reset_url: 'http://localhost:5173/reset-password?token=abc' },
      'user-1',
      null,
      fakeTransaction
    );

    expect(result).toBe(true);
    expect(findOneSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: 'password_reset', channel: 'email' },
        transaction: fakeTransaction,
      })
    );
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: 'password_reset',
        channel: 'email',
        recipientEmail: 'user@example.com',
      }),
      { transaction: fakeTransaction }
    );
  });

  it('email.channel detects placeholder credentials and simulates delivery in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const SettingsService = require('../../src/modules/settings/settings.service');
      vi.spyOn(SettingsService, 'getByGroup').mockResolvedValue({});

      const emailChannel = require('../../src/modules/notification/channels/email.channel');
      // The current .env has placeholder credentials (your_email@gmail.com / your_app_password_here)
      const result = await emailChannel.send({
        to: 'test@example.com',
        subject: 'Reset your password',
        html: '<p>Reset link</p>',
        text: 'Reset link',
      });

      expect(result).toBe(true);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
