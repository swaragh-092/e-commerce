import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MenuBuilderPage from '../../../pages/admin/MenuBuilderPage';
import MenuService from '../../../services/menuService';
const { notify, confirm } = vi.hoisted(() => ({ notify: vi.fn(), confirm: vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify, confirm }) }));
vi.mock('../../../services/menuService', () => ({ default: { adminGetMenus: vi.fn(), adminGetMenuById: vi.fn(), adminUpdateMenuItem: vi.fn() } }));
vi.mock('../../../services/pageService', () => ({ default: { adminGetPages: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('../../../services/categoryService', () => ({ getCategories: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../services/productService', () => ({ getProducts: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../../pages/admin/menu/MenuSelector', () => ({ default: () => null }));
vi.mock('../../../pages/admin/menu/MenuDialog', () => ({ default: () => null }));
vi.mock('../../../pages/admin/menu/MenuSettings', () => ({ default: () => null }));
vi.mock('../../../pages/admin/menu/MenuItemGrid', () => ({ default: ({ rows, openItemDialog }) => <>{rows.map(item => <button key={item.id} onClick={() => openItemDialog(item)}>Edit {item.label}</button>)}</> }));
const menu = { id: 'menu', location: 'header', items: [{ id: 'parent', label: 'Products', targetType: 'none', placement: 'center', childDisplayLimit: 10, children: [] }] };
beforeEach(() => {
  vi.clearAllMocks();
  confirm.mockResolvedValue(true);
  MenuService.adminGetMenus.mockResolvedValue({ data: [menu] });
  MenuService.adminGetMenuById.mockResolvedValue({ data: menu });
  MenuService.adminUpdateMenuItem.mockResolvedValue({});
});
describe('Menu Builder child display limits', () => {
  it.each([['30 items', 30], ['Show all', null]])('saves the %s setting on the parent', async (option, expected) => {
    render(<MenuBuilderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Products' }));
    const select = screen.getByRole('combobox', { name: 'Children per batch' });
    expect(select).toHaveTextContent('10 items');
    fireEvent.mouseDown(select);
    fireEvent.click(await screen.findByRole('option', { name: option }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(MenuService.adminUpdateMenuItem).toHaveBeenCalledWith('menu', 'parent', expect.objectContaining({ childDisplayLimit: expected })));
  });

  it('accepts and saves a custom child batch size', async () => {
    render(<MenuBuilderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Products' }));
    const select = screen.getByRole('combobox', { name: 'Children per batch' });
    fireEvent.mouseDown(select);
    fireEvent.click(await screen.findByRole('option', { name: 'Custom number…' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Custom children per batch' }), { target: { value: '37' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(MenuService.adminUpdateMenuItem).toHaveBeenCalledWith('menu', 'parent', expect.objectContaining({ childDisplayLimit: 37 })));
  });

  it('does not save when the custom child batch size is empty', async () => {
    render(<MenuBuilderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Products' }));
    const select = screen.getByRole('combobox', { name: 'Children per batch' });
    fireEvent.mouseDown(select);
    fireEvent.click(await screen.findByRole('option', { name: 'Custom number…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Enter a custom child batch size before saving.', 'error'));
    expect(MenuService.adminUpdateMenuItem).not.toHaveBeenCalled();
  });
});
