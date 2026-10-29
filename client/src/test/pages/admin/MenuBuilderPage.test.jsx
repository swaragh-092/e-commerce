import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MenuBuilderPage from '../../../pages/admin/MenuBuilderPage';
import MenuService from '../../../services/menuService';
const { notify, confirm } = vi.hoisted(() => ({ notify: vi.fn(), confirm: vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify, confirm }) }));
vi.mock('../../../services/menuService', () => ({ default: { adminGetMenus: vi.fn(), adminGetMenuById: vi.fn(), adminDeleteMenuItem: vi.fn(), adminBulkDeleteMenuItems: vi.fn(), adminDeleteMenu: vi.fn() } }));
vi.mock('../../../services/pageService', () => ({ default: { adminGetPages: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('../../../services/categoryService', () => ({ getCategories: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../services/productService', () => ({ getProducts: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../../pages/admin/menu/MenuSelector', () => ({ default: () => null }));
vi.mock('../../../pages/admin/menu/MenuDialog', () => ({ default: () => null }));
vi.mock('../../../pages/admin/menu/MenuItemDialog', () => ({ default: () => null }));
vi.mock('../../../pages/admin/menu/MenuSettings', () => ({ default: ({ deleteSelectedMenu }) => <button onClick={deleteSelectedMenu}>Delete menu</button> }));
vi.mock('../../../pages/admin/menu/MenuItemGrid', () => ({ default: ({ rows, deleteItem, setSelectedIds, bulkDeleteItems }) => <>
  {rows.map((item) => <button key={item.id} onClick={() => deleteItem(item)}>Delete {item.label}</button>)}
  <button onClick={() => setSelectedIds(rows.map((item) => item.id))}>Select all</button>
  <button onClick={bulkDeleteItems}>Delete selection</button>
</> }));
const menu = { id: 'menu', name: 'Header', items: [{ id: 'parent', label: 'Categories', children: [{ id: 'child', parentId: 'parent', label: 'Fruit' }] }] };
beforeEach(() => {
  vi.clearAllMocks();
  confirm.mockResolvedValue(true);
  MenuService.adminGetMenus.mockResolvedValue({ data: [menu] });
  MenuService.adminGetMenuById.mockResolvedValue({ data: menu });
  MenuService.adminDeleteMenuItem.mockResolvedValue({});
});

describe('Menu Builder deletion messages', () => {
  it('shows a clear block instead of cascade confirmation for a parent', async () => {
    render(<MenuBuilderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Categories' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Cannot delete yet' }));
    expect(dialog.getByText(/Delete the child items first/)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(MenuService.adminDeleteMenuItem).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('blocks bulk selections containing a parent even when its children are selected', async () => {
    render(<MenuBuilderPage />);
    await screen.findByRole('button', { name: 'Delete Categories' });
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selection' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete the child items first');
    expect(MenuService.adminBulkDeleteMenuItems).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
  it('confirms deletion of a leaf only', async () => {
    render(<MenuBuilderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Fruit' }));
    await waitFor(() => expect(MenuService.adminDeleteMenuItem).toHaveBeenCalledWith('menu', 'child'));
    expect(confirm).toHaveBeenCalledWith('Delete Menu Item', 'Delete "Fruit"?', 'danger');
  });
  it('shows server rejection if a child was added after the page loaded', async () => {
    MenuService.adminDeleteMenuItem.mockRejectedValue({ response: { data: { error: { message: 'Delete the child items first, then delete the parent item.' } } } });
    render(<MenuBuilderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Fruit' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete the child items first');
  });
  it('blocks deleting a menu which still contains items', async () => {
    render(<MenuBuilderPage />);
    await screen.findByRole('button', { name: 'Delete Categories' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete menu' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete its menu items first');
    expect(MenuService.adminDeleteMenu).not.toHaveBeenCalled();
  });
  it('explains how to handle generated category children', async () => {
    MenuService.adminGetMenuById.mockResolvedValue({ data: { ...menu, items: [{ id: 'parent', label: 'Categories', children: [{ id: 'generated', parentId: 'parent', label: 'Fruit', generatedFromCategory: true }] }] } });
    render(<MenuBuilderPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Categories' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('turn off category syncing');
    expect(MenuService.adminDeleteMenuItem).not.toHaveBeenCalled();
  });
});
