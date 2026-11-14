import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const settings = require('../../src/modules/settings/settings.service');
const { compileTemplate } = require('../../src/modules/notification/notification.service');
const { SAMPLE_VARIABLES } = require('../../src/modules/notification/notification.defaults');
const nodemailer = require('nodemailer');
const emailChannel = require('../../src/modules/notification/channels/email.channel');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('uses Store Identity in template subjects, headers and footers even with sample variables', async () => {
  vi.stubEnv('API_PUBLIC_URL', 'https://api.example.com');
  const groups = {
    general: { storeName: 'ORBI', contactEmail: 'help@example.com' },
    logo: { main: 'https://orbi.example/logo.png' },
  };
  vi.spyOn(settings, 'getByGroup').mockImplementation(async (group) => groups[group] || {});

  const rendered = await compileTemplate({
    subject: 'Welcome to {{store_name}}',
    bodyHtml: '<img src="{{store_logo}}" alt="{{store_name}}">',
    bodyText: '{{copyright}} {{support_email}}',
  }, SAMPLE_VARIABLES);

  expect(rendered.subject).toBe('Welcome to ORBI');
  expect(rendered.html).toBe('<img src="https://orbi.example/logo.png" alt="ORBI">');
  expect(rendered.text).toContain('ORBI. All rights reserved. help@example.com');
});

it('uses Store Identity as the sender display name and keeps the configured sender address', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const groups = {
    general: { storeName: 'ORBI' },
    messaging: { emailFrom: 'My Store <sender@example.com>' },
    messaging_credentials: {
      smtp_host: 'smtp.example.com',
      smtp_user: 'account@example.com',
      smtp_pass: 'test-password',
    },
  };
  vi.spyOn(settings, 'getByGroup').mockImplementation(async (group) => groups[group] || {});
  const sendMail = vi.fn().mockResolvedValue({});
  vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail });

  await emailChannel.send({ to: 'customer@example.com', subject: 'Welcome', text: 'Hello' });

  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
    from: { name: 'ORBI', address: 'sender@example.com' },
  }));
});
