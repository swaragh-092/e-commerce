import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CartPage from '../../../pages/storefront/CartPage';
import { CartProvider } from '../../../context/CartContext';
import { AuthContext } from '../../../context/AuthContext';
import cartService from '../../../services/cartService';
import { useCart } from '../../../hooks/useCart';

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../../../services/cartService', () => ({ default: {
  getCart: vi.fn(), addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn(), clearCart: vi.fn(),
} }));
vi.mock('../../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: {} }),
  useFeature: () => true,
  useFeatureVisible: () => true,
  useFeaturesResolved: () => true,
  useComponentStyles: () => ({}),
  useCurrency: () => ({ formatPrice: value => `$${value}` }),
}));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify }) }));
vi.mock('../../../components/common/PageSEO', () => ({ default: () => null }));
vi.mock('../../../components/storefront/EnquiryModal', () => ({ default: () => null }));

const item = {
  id: 'item-1', quantity: 2,
  product: { id: 'product-1', name: 'Test product', slug: 'test-product', price: 10, quantity: 10 },
};
const response = items => ({ data: { data: { items } } });
const AddProduct = () => {
  const { addItem } = useCart();
  return <button onClick={() => addItem('product-1')}>Add product</button>;
};
const mount = () => render(
  <MemoryRouter><AuthContext.Provider value={{ user: null }}>
    <CartProvider><AddProduct /><CartPage /></CartProvider>
  </AuthContext.Provider></MemoryRouter>
);

beforeEach(() => {
  vi.resetAllMocks();
  cartService.getCart.mockResolvedValue(response([item]));
});

describe('cart failure recovery', () => {
  it('clears a previous load error when adding a product succeeds', async () => {
    cartService.getCart.mockRejectedValueOnce(new Error('Offline'));
    cartService.addItem.mockResolvedValue(response([item]));
    mount();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(await screen.findByText('Test product')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('distinguishes a failed load from an empty cart and retries', async () => {
    cartService.getCart.mockRejectedValueOnce(new Error('Offline'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load your cart');
    expect(screen.queryByText('Your cart is empty')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Test product')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(cartService.getCart).toHaveBeenCalledTimes(2);
  });

  it('still shows the empty state after a successful empty response', async () => {
    cartService.getCart.mockResolvedValue(response([]));
    mount();
    expect(await screen.findByRole('link', { name: 'Browse Products' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['Increase quantity', 'updateItem', ['item-1', 3]],
    ['Remove', 'removeItem', ['item-1']],
    ['Clear all items', 'clearCart', []],
  ])('explains a failed %s and restores usable controls', async (label, method, args) => {
    cartService[method].mockRejectedValue({ response: { data: { error: { message: 'Please try again later.' } } } });
    mount();
    const button = await screen.findByRole('button', { name: label });
    fireEvent.click(button);
    await waitFor(() => expect(cartService[method]).toHaveBeenCalledWith(...args));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Please try again later.', 'error'));
    await waitFor(() => expect(screen.getByRole('button', { name: label })).toBeEnabled());
    expect(screen.getByText('Test product')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decrease quantity' }).nextElementSibling).toHaveTextContent('2');
  });
});
