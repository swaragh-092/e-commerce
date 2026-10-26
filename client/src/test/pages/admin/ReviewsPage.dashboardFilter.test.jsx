import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReviewsPage from '../../../pages/admin/ReviewsPage';
import { getAdminReviews } from '../../../services/adminService';

vi.mock('@mui/x-data-grid', () => ({ DataGrid: () => <div data-testid="reviews-grid" /> }));
vi.mock('../../../services/adminService', () => ({
  getAdminReviews: vi.fn(),
  updateReviewStatus: vi.fn(),
  deleteReview: vi.fn(),
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) }),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));

describe('ReviewsPage dashboard filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminReviews.mockResolvedValue({
      data: { data: { rows: [], counts: { pending: 1, approved: 0, rejected: 0, total: 1 } }, meta: { total: 1 } },
    });
  });

  it('applies the Pending Reviews dashboard filter from the URL', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/reviews?status=pending']}>
        <ReviewsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(getAdminReviews).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'pending' })));
    expect(screen.getByRole('button', { name: /Pending Approval/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
