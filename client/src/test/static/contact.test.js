import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = resolve(import.meta.dirname, '../../../../demo-orbis-seeds-v1-html');
let dom;
const mount = (fetchImpl, page) => {
  dom = new JSDOM(readFileSync(resolve(root, page), 'utf8'), { url: `http://localhost/${page}`, runScripts: 'outside-only' });
  const w = dom.window;
  w.API_URL = 'https://api.example.test/api/';
  w.fetch = vi.fn(fetchImpl);
  w.customAlert = vi.fn();
  w.alert = vi.fn();
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

describe.each(['index.html', 'contact-us.html'])('%s contact form submission', page => {
  it('posts all fields to the public endpoint, blocks duplicate clicks and confirms receipt', async () => {
    let resolveRequest;
    const w = mount(() => new Promise(resolve => { resolveRequest = resolve; }), page);
    const form = fill(w), button = form.querySelector('button[type="submit"]');
    const originalLabel = button.textContent;
    expect(submit(w, form)).toBe(false);
    submit(w, form);
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
    expect(w.customAlert).toHaveBeenCalledWith('Message Sent', 'Your message has been received.', 'success', 4000);
    expect(w.document.getElementById('contact-form-status')).toBeNull();
    expect(button.textContent).toBe(originalLabel);
    expect(w.location.pathname).toBe(`/${page}`);
  });

  it('does not submit empty or invalid fields', () => {
    const w = mount(success, page), form = w.document.getElementById('contact-form');
    submit(w, form);
    expect(w.fetch).not.toHaveBeenCalled();
    fill(w); form.elements.namedItem('email').value = 'invalid'; submit(w, form);
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it('preserves values and allows retry after a network error', async () => {
    const w = mount(() => Promise.reject(new w.TypeError('Failed to fetch')), page), form = fill(w);
    submit(w, form);
    await waitFor(() => expect(w.customAlert).toHaveBeenCalledWith('Submission Failed', expect.stringContaining('Unable to connect'), 'error', undefined));
    expect(form.elements.namedItem('message').value).toContain('Thank you.');
    w.fetch.mockImplementation(success);
    submit(w, form);
    await waitFor(() => expect(w.customAlert).toHaveBeenCalledWith('Message Sent', expect.stringContaining('received'), 'success', 4000));
  });

  it('shows server errors without clearing the form or claiming mail was delivered', async () => {
    const w = mount(() => ({ ok: false, status: 503, json: async () => ({ success: false, error: { message: 'Please try again later.' } }) }), page), form = fill(w);
    submit(w, form);
    await waitFor(() => expect(w.customAlert).toHaveBeenCalledWith('Submission Failed', 'Please try again later.', 'error', undefined));
    expect(form.elements.namedItem('email').value).toBe('jane@example.test');
    expect(form.querySelector('button').disabled).toBe(false);
  });

  it('attaches server validation to the corresponding field and clears it when edited', async () => {
    const w = mount(() => ({ ok: false, status: 400, json: async () => ({ success: false, error: {
      message: 'Validation failed', details: [{ field: 'phone', message: 'Please enter a valid phone number.' }],
    } }) }), page), form = fill(w);
    submit(w, form);
    const phone = form.elements.namedItem('phone');
    await waitFor(() => expect(phone.validationMessage).toBe('Please enter a valid phone number.'));
    phone.dispatchEvent(new w.Event('input', { bubbles: true }));
    expect(phone.validationMessage).toBe('');
  });

  it('shows a failure alert for an unreadable response and preserves the form', async () => {
    const w = mount(() => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected response'); } }), page), form = fill(w);
    submit(w, form);
    await waitFor(() => expect(w.customAlert).toHaveBeenCalledWith('Submission Failed', 'We could not send your message. Please try again.', 'error', undefined));
    expect(form.elements.namedItem('name').value).toBe('Jane Doe');
    expect(form.querySelector('button').disabled).toBe(false);
  });

  it('aborts a stalled request and lets the user retry', async () => {
    const w = mount((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new w.DOMException('Aborted', 'AbortError')));
    }), page), form = fill(w);
    let expire;
    w.setTimeout = vi.fn(callback => { expire = callback; return 1; });
    submit(w, form);
    expire();
    await waitFor(() => expect(w.customAlert).toHaveBeenCalledWith('Submission Failed', expect.stringContaining('timed out'), 'error', undefined));
    expect(form.elements.namedItem('email').value).toBe('jane@example.test');
    expect(form.querySelector('button').disabled).toBe(false);
    expect(form.getAttribute('aria-busy')).toBe('false');
  });

  it('still displays an alert if the shared enquiry alerts are unavailable', async () => {
    const w = mount(success, page), form = fill(w);
    delete w.customAlert;
    submit(w, form);
    await waitFor(() => expect(w.alert).toHaveBeenCalledWith('Message Sent\nYour message has been received.'));
  });
});
