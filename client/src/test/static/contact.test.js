import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = resolve(import.meta.dirname, '../../../../demo-orbis-seeds-v1-html');
let dom;
const mount = (fetchImpl) => {
  dom = new JSDOM(readFileSync(resolve(root, 'contact-us.html'), 'utf8'), { url: 'http://localhost/contact-us.html', runScripts: 'outside-only' });
  const w = dom.window;
  w.API_URL = 'https://api.example.test/api/';
  w.fetch = vi.fn(fetchImpl);
  w.eval(readFileSync(resolve(root, 'js/contact.js'), 'utf8'));
  return w;
};
const fill = w => {
  const form = w.document.getElementById('contact-form');
  for (const [name, value] of Object.entries({ name: 'Jane Doe', email: 'jane@example.test', phone: '+91 98765 43210', message: 'Please contact me.\nThank you.' })) form.elements.namedItem(name).value = value;
  return form;
};
const submit = (w, form) => form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
const success = () => ({ ok: true, status: 202, json: async () => ({ success: true, message: 'Your message has been received.' }) });
afterEach(() => dom?.window.close());

describe('Demo contact form submission', () => {
  it('posts all fields to the public endpoint, blocks duplicate clicks and confirms receipt', async () => {
    let resolveRequest;
    const w = mount(() => new Promise(resolve => { resolveRequest = resolve; }));
    const form = fill(w), button = form.querySelector('button[type="submit"]');
    submit(w, form); submit(w, form);
    expect(w.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = w.fetch.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/contact');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({ name: 'Jane Doe', email: 'jane@example.test', phone: '+91 98765 43210', message: 'Please contact me.\nThank you.' });
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Sending…');
    resolveRequest(success());
    await waitFor(() => expect(button.disabled).toBe(false));
    expect(form.elements.namedItem('name').value).toBe('');
    expect(w.document.getElementById('contact-form-status').textContent).toContain('received');
    expect(button.textContent).toBe('Send Message');
  });

  it('does not submit empty or invalid fields', () => {
    const w = mount(success), form = w.document.getElementById('contact-form');
    submit(w, form);
    expect(w.fetch).not.toHaveBeenCalled();
    fill(w); form.elements.namedItem('email').value = 'invalid'; submit(w, form);
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it('preserves values and allows retry after a network error', async () => {
    const w = mount(() => Promise.reject(new w.TypeError('Failed to fetch'))), form = fill(w);
    submit(w, form);
    const status = w.document.getElementById('contact-form-status');
    await waitFor(() => expect(status.textContent).toContain('Unable to connect'));
    expect(form.elements.namedItem('message').value).toContain('Thank you.');
    expect(status.getAttribute('role')).toBe('alert');
    w.fetch.mockImplementation(success);
    submit(w, form);
    await waitFor(() => expect(status.textContent).toContain('received'));
  });

  it('shows server errors without clearing the form or claiming mail was delivered', async () => {
    const w = mount(() => ({ ok: false, status: 503, json: async () => ({ success: false, error: { message: 'Please try again later.' } }) })), form = fill(w);
    submit(w, form);
    await waitFor(() => expect(w.document.getElementById('contact-form-status').textContent).toBe('Please try again later.'));
    expect(form.elements.namedItem('email').value).toBe('jane@example.test');
    expect(form.querySelector('button').disabled).toBe(false);
  });

  it('attaches server validation to the corresponding field and clears it when edited', async () => {
    const w = mount(() => ({ ok: false, status: 400, json: async () => ({ success: false, error: {
      message: 'Validation failed', details: [{ field: 'phone', message: 'Please enter a valid phone number.' }],
    } }) })), form = fill(w);
    submit(w, form);
    const phone = form.elements.namedItem('phone');
    await waitFor(() => expect(phone.validationMessage).toBe('Please enter a valid phone number.'));
    phone.dispatchEvent(new w.Event('input', { bubbles: true }));
    expect(phone.validationMessage).toBe('');
  });
});
