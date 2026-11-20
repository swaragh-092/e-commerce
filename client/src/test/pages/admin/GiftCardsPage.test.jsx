import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import GiftCardsPage from '../../../pages/admin/GiftCardsPage';
import { PERMISSIONS } from '../../../utils/permissions';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), hasPermission: vi.fn() }));
vi.mock('../../../services/api', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: mocks.hasPermission }) }));

beforeEach(() => {
    vi.resetAllMocks();
    mocks.get.mockImplementation(async (url) => ({ data: { data:
        url.endsWith('/policy') ? { enabled: false, minimum: 500, maximum: 5000, issuanceAvailable: true } :
            url.endsWith('/cards') ? [] : null,
    } }));
    mocks.post.mockResolvedValue({ data: { data: { id: 'issued-reference' } } });
});

it('lets permitted staff issue a gift card even when new sales are paused', async () => {
    mocks.hasPermission.mockImplementation((permission) => permission === PERMISSIONS.GIFT_CARDS_ISSUE);
    render(<GiftCardsPage />);
    const create = screen.getByRole('button', { name: 'Create gift card' });
    await waitFor(() => expect(create).toBeEnabled());
    fireEvent.click(create);
    fireEvent.change(await screen.findByRole('spinbutton', { name: /amount/i }), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/recipient email/i), { target: { value: 'recipient@example.org' } });
    fireEvent.change(screen.getByLabelText(/internal reason/i), { target: { value: 'Customer goodwill' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create and email' }));
    await screen.findByText(/queued for email/i);
    expect(mocks.post).toHaveBeenCalledWith('/gift-cards/admin/issue', expect.objectContaining({
        id: expect.any(String), amount: 500, recipientEmail: 'recipient@example.org', reason: 'Customer goodwill',
    }));
});

it('hides manual issuance from staff without gift card issuance permission', async () => {
    mocks.hasPermission.mockReturnValue(false);
    render(<GiftCardsPage />);
    await screen.findByRole('button', { name: 'Save policy' });
    expect(screen.queryByRole('button', { name: 'Create gift card' })).toBeNull();
});

it('blocks new staff issuance when Platform Features pauses it', async () => {
    mocks.hasPermission.mockImplementation((permission) => permission === PERMISSIONS.GIFT_CARDS_ISSUE);
    mocks.get.mockImplementation(async (url) => ({ data: { data:
        url.endsWith('/policy') ? { enabled: true, minimum: 500, maximum: 5000, issuanceAvailable: false } :
            url.endsWith('/cards') ? [] : null,
    } }));
    render(<GiftCardsPage />);
    await screen.findByText(/paused in Platform Features/i);
    expect(screen.getByRole('button', { name: 'Create gift card' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled();
});
