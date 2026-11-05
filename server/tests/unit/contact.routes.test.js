import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';

const express = require('express');
const service = require('../../src/modules/contact/contact.service');
const Store = require('../../src/utils/postgresRateLimitStore');
const router = require('../../src/modules/contact/contact.routes');
const { error: sendError } = require('../../src/utils/response');
const app = express();
app.use(express.json());
app.use('/api/contact', router);
app.use((error, req, res, next) => sendError(res, error.message, error.statusCode || 500, error.code));
const input = { name: 'Jane Doe', email: 'jane@example.test', phone: '9876543210', message: 'Hello from the contact form.' };
let server, url;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}/api/contact`;
});
afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
});
beforeEach(() => {
  let hits = 0;
  vi.spyOn(Store.prototype, 'increment').mockImplementation(async () => ({ totalHits: ++hits, resetTime: new Date(Date.now() + 900000) }));
  vi.spyOn(service, 'submit').mockResolvedValue({ queued: true });
});
afterEach(() => vi.restoreAllMocks());
const post = (body = input) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('Anonymous POST /api/contact', () => {
  it('accepts a valid form without login and reports queued receipt', async () => {
    const response = await post();
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ success: true, data: { queued: true } });
    expect(service.submit).toHaveBeenCalledWith(input);
  });

  it('rejects invalid data before any mail is queued', async () => {
    const response = await post({ ...input, email: 'invalid' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR', details: [{ field: 'email' }] } });
    expect(service.submit).not.toHaveBeenCalled();
  });

  it('strips recipient and template overrides from public submissions', async () => {
    const response = await post({ ...input, to: 'attacker@example.test', templateName: 'password_reset', recipientEmail: 'attacker@example.test' });
    expect(response.status).toBe(202);
    expect(service.submit).toHaveBeenCalledWith(input);
  });

  it('returns 503 instead of success when notification delivery is unavailable', async () => {
    service.submit.mockRejectedValue(Object.assign(new Error('Contact temporarily unavailable'), { statusCode: 503, code: 'CONTACT_UNAVAILABLE' }));
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'CONTACT_UNAVAILABLE' } });
  });

  it('limits anonymous submissions to five attempts per 15 minutes', async () => {
    for (let i = 0; i < 5; i++) expect((await post()).status).toBe(202);
    const response = await post();
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'TOO_MANY_REQUESTS' } });
    expect(service.submit).toHaveBeenCalledTimes(5);
  });
});
