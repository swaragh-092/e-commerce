import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MenuChildrenMore from '../../components/layout/MenuChildrenMore';
import MenuService from '../../services/menuService';
import { appendMenuChildren } from '../../utils/menuPagination';
vi.mock('../../services/menuService', () => ({ default: { getPublicMenuChildren: vi.fn() } }));
const item = { id: 'parent', menuId: 'menu', label: 'Products', children: [{ id: 'one' }], childrenPagination: { limit: 1, nextOffset: 1, hasMore: true } };
const page = { items: [{ id: 'two' }], pagination: { limit: 1, offset: 1, hasMore: false, nextOffset: null } };
beforeEach(() => vi.clearAllMocks());
describe('Show more menu children', () => {
  it('fetches only on click, disables repeated requests, and delivers the next page', async () => {
    let resolve;
    MenuService.getPublicMenuChildren.mockReturnValue(new Promise(done => { resolve = done; }));
    const onLoaded = vi.fn();
    render(<MenuChildrenMore item={item} onLoaded={onLoaded} />);
    expect(MenuService.getPublicMenuChildren).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Show more Products' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(MenuService.getPublicMenuChildren).toHaveBeenCalledTimes(1);
    expect(MenuService.getPublicMenuChildren).toHaveBeenCalledWith('menu', 'parent', { limit: 1, offset: 1 });
    resolve({ data: page });
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith('menu', 'parent', page));
  });
  it('offers retry after failure and disappears when all children are loaded', async () => {
    MenuService.getPublicMenuChildren.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ data: page });
    const onLoaded = vi.fn();
    const { rerender } = render(<MenuChildrenMore item={item} onLoaded={onLoaded} />);
    fireEvent.click(screen.getByRole('button'));
    await screen.findByText('Could not load. Try again');
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    rerender(<MenuChildrenMore item={{ ...item, childrenPagination: page.pagination }} onLoaded={onLoaded} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('appends in place without modifying siblings or accepting duplicate/stale pages', () => {
    const menu = { id: 'menu', items: [{ id: 'root', children: [item, { id: 'sibling' }] }] };
    const result = appendMenuChildren(menu, 'menu', 'parent', page);
    expect(result.items[0].children[0].children.map(child => child.id)).toEqual(['one', 'two']);
    expect(result.items[0].children[1].id).toBe('sibling');
    expect(menu.items[0].children[0].children).toHaveLength(1);
    expect(appendMenuChildren(result, 'menu', 'parent', page)).toEqual(result);
    expect(appendMenuChildren(menu, 'different-menu', 'parent', page)).toBe(menu);
  });
});
