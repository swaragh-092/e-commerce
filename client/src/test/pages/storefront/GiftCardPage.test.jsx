import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GiftCardPage from '../../../pages/storefront/GiftCardPage';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), open: vi.fn() }));
vi.mock('../../../services/api', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('../../../utils/loadPaymentScript', () => ({
    default: async () => class Razorpay {
        open = mocks.open;
    },
}));

const response = (data) => ({ data: { data } });

describe('GiftCardPage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        sessionStorage.clear();
        window.history.replaceState(null, '', '/gift-cards');
    });

    it('shows the paused state without a purchase form', async () => {
        mocks.get.mockResolvedValue(response({ enabled: false }));
        render(<GiftCardPage />);
        expect(await screen.findByText('Gift card sales are currently paused.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Review gift' })).toBeNull();
    });

    it('reviews the custom amount and expiry before opening Razorpay', async () => {
        mocks.get.mockResolvedValue(response({ enabled: true, minimum: 500, maximum: 5000, validity_days: 365 }));
        mocks.post.mockImplementation(async (url) => response(url === '/gift-cards/purchases'
            ? { id: 'purchase', token: 'token', providerOrder: 'order_test', keyId: 'rzp_test', amount: 85000 }
            : { payment: 'pending' }));
        render(<GiftCardPage />);
        fireEvent.change(await screen.findByLabelText(/amount in inr/i), { target: { value: '850' } });
        fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: 'buyer@example.org' } });
        fireEvent.change(screen.getByLabelText(/recipient email/i), { target: { value: 'recipient@example.org' } });
        fireEvent.click(screen.getByRole('button', { name: 'Review gift' }));
        expect(screen.getByText(/valid for 365 days/i)).toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /pay.*850/i }));
        await waitFor(() => expect(mocks.open).toHaveBeenCalledOnce());
        expect(mocks.post).toHaveBeenCalledWith('/gift-cards/purchases', expect.objectContaining({
            amount: 850, expectedValidityDays: 365, recipientEmail: 'recipient@example.org',
        }));
    });
});
