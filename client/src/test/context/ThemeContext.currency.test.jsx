import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { SettingsProvider } from '../../context/ThemeContext';
import { useCurrency, useSettings } from '../../hooks/useSettings';

const service = vi.hoisted(() => ({ getAllSettings: vi.fn(), getPublicSettings: vi.fn(), getFeatures: vi.fn() }));
vi.mock('../../services/settingsService', () => ({ default: service }));

const Probe = () => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { settings } = useSettings();
  return <>
    <span data-testid="price">{formatPrice(590)}</span>
    <span data-testid="store">{settings?.general?.storeName}</span>
    <button onClick={() => navigate('/admin')}>Enter admin</button>
    <button onClick={() => navigate('/admin/orders')}>Orders</button>
  </>;
};
const renderAt = path => render(<MemoryRouter initialEntries={[path]}><SettingsProvider><Probe /></SettingsProvider></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  service.getPublicSettings.mockResolvedValue({ general: { currency: 'INR', storeName: 'ORBI' } });
  service.getAllSettings.mockResolvedValue({ general: { currency: 'INR', storeName: 'ORBI admin' } });
  service.getFeatures.mockResolvedValue({ mode: 'ecommerce', features: {} });
});

describe('settings across admin login', () => {
  it('uses public currency before login and reloads admin settings without refreshing', async () => {
    renderAt('/admin/login');
    expect(await screen.findByTestId('price')).toHaveTextContent('₹590.00');
    expect(service.getPublicSettings).toHaveBeenCalledOnce();
    expect(service.getAllSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enter admin' }));
    await waitFor(() => expect(screen.getByTestId('store')).toHaveTextContent('ORBI admin'));
    expect(screen.getByTestId('price')).toHaveTextContent('₹590.00');
    expect(service.getAllSettings).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Orders' }));
    expect(service.getAllSettings).toHaveBeenCalledOnce();
  });

  it('loads configured currency on a direct admin visit', async () => {
    renderAt('/admin');
    expect(await screen.findByTestId('price')).toHaveTextContent('₹590.00');
    expect(service.getAllSettings).toHaveBeenCalledOnce();
    expect(service.getPublicSettings).not.toHaveBeenCalled();
  });

  it('falls back to public currency for staff without private settings access', async () => {
    service.getAllSettings.mockRejectedValueOnce({ response: { status: 403 } });
    renderAt('/admin');
    expect(await screen.findByTestId('price')).toHaveTextContent('₹590.00');
    expect(service.getPublicSettings).toHaveBeenCalledOnce();
  });
});
