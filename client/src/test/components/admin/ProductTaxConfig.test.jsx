import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProductTaxConfig from '../../../components/admin/ProductTaxConfig';

const formatPrice = (amount) => `₹${Number(amount).toFixed(2)}`;
const taxConfig = { isCustom: false, inclusive: false, sgst: 0.09, cgst: 0.09, igst: 0.18 };

describe('ProductTaxConfig preview', () => {
  it('uses the active store tax settings and excludes IGST from a same-state estimate', () => {
    render(
      <ProductTaxConfig
        taxConfig={taxConfig}
        basePrice={100}
        priceLabel="MRP"
        setTaxConfig={vi.fn()}
        globalSettings={{ enableSGST: true, enableCGST: true, enableIGST: true, sgstRate: 0.09, cgstRate: 0.09, igstRate: 0.18 }}
        formatPrice={formatPrice}
      />
    );

    expect(screen.getByText('₹118.00')).toBeInTheDocument();
    expect(screen.getByText('Buyer in another state: 18% IGST.')).toBeInTheDocument();
    expect(screen.queryByText('₹136.00')).not.toBeInTheDocument();
  });

  it('shows included tax without adding it to the customer total', () => {
    render(
      <ProductTaxConfig
        taxConfig={{ ...taxConfig, isCustom: true, inclusive: true }}
        basePrice={118}
        priceLabel="Active sale price"
        setTaxConfig={vi.fn()}
        globalSettings={{}}
        formatPrice={formatPrice}
      />
    );

    expect(screen.getByText('Price before tax')).toBeInTheDocument();
    expect(screen.getByText('₹100.00')).toBeInTheDocument();
    expect(screen.getByText('Tax included')).toBeInTheDocument();
    expect(screen.getByText('₹18.00')).toBeInTheDocument();
    expect(screen.getByText('₹118.00')).toBeInTheDocument();
  });

  it('lets admins enter a fractional custom tax rate without resetting the input', () => {
    const setTaxConfig = vi.fn();
    render(
      <ProductTaxConfig
        taxConfig={{ ...taxConfig, isCustom: true }}
        basePrice={100}
        priceLabel="MRP"
        setTaxConfig={setTaxConfig}
        globalSettings={{}}
        formatPrice={formatPrice}
      />
    );

    const sgst = screen.getByRole('spinbutton', { name: 'SGST (%)' });
    fireEvent.focus(sgst);
    fireEvent.change(sgst, { target: { value: '12.5' } });

    expect(sgst).toHaveValue(12.5);
    expect(setTaxConfig).toHaveBeenCalledWith(expect.objectContaining({ sgst: 0.125 }));
  });
});
