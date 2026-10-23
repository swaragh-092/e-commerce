import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CouponsPage from '../../../pages/admin/CouponsPage';
import { getCoupons } from '../../../services/adminService';

vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns }) => (
    <div>
      {rows.map((row) => (
        <div key={row.id} role="row">
          {columns.map((column) => (
            <div key={column.field}>
              {column.renderCell ? column.renderCell({ row, value: row[column.field] }) : row[column.field]}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../../../services/adminService', () => ({
  getCoupons: vi.fn(),
  createCoupon: vi.fn(),
  updateCoupon: vi.fn(),
  deleteCoupon: vi.fn(),
}));
vi.mock('../../../services/productService', () => ({ getProducts: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../../services/categoryService', () => ({ getCategoryTree: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../../services/brandService', () => ({ default: { getBrands: vi.fn().mockResolvedValue({ data: { data: { brands: [] } } }) } }));
vi.mock('../../../hooks/useSettings', () => ({ useCurrency: () => ({ formatPrice: (value) => `₹${value}` }), useFeature: () => true }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify: vi.fn() }) }));

const baseCoupon = {
  id: 'coupon-1',
  name: 'Summer Sale',
  code: 'SUMMER',
  type: 'percentage',
  value: 10,
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2027-01-01T00:00:00.000Z',
  customerEligibility: 'all',
  visibility: 'public',
  applicationMode: 'manual',
  usedCount: 0,
};

describe('CouponsPage duplicate flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCoupons.mockImplementation(({ limit }) => Promise.resolve({
      data: {
        data: limit === 20
          ? [baseCoupon]
          : limit === 1000
            ? [baseCoupon]
            : [],
        meta: {
          total: limit === 20 ? 1 : 2,
          totalPages: limit === 20 ? 1 : 2,
        },
      },
    }));
  });

  it('checks every server page before choosing a duplicate coupon code', async () => {
    getCoupons.mockImplementation(({ page, limit }) => Promise.resolve({
      data: {
        data: limit === 20
          ? [baseCoupon]
          : page === 1
            ? [baseCoupon]
            : [{ id: 'coupon-2', name: 'Another', code: 'SUMMER_COPY' }],
        meta: { total: limit === 20 ? 1 : 2, totalPages: limit === 20 ? 1 : 2 },
      },
    }));

    render(<CouponsPage />);
    const couponRow = await screen.findByRole('row');
    fireEvent.click(within(couponRow).getByTestId('FileCopyIcon').closest('button'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByLabelText('Customer-facing code *')).toHaveValue('SUMMER_COPY_2');
    expect(screen.getByLabelText('Internal name *')).toHaveValue('Summer Sale Copy');
    await waitFor(() => expect(getCoupons).toHaveBeenCalledWith({ page: 2, limit: 1000 }));
  });
});
