import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignerTreePanel from '../../components/admin/themes/designer/DesignerTreePanel';
const dnd = vi.hoisted(() => ({ end: null }));
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ onDragEnd, children }) => { dnd.end = onDragEnd; return children; },
  Droppable: ({ children }) => children({ innerRef: () => {}, droppableProps: {}, placeholder: null }),
  Draggable: ({ children }) => children({ innerRef: () => {}, draggableProps: {}, dragHandleProps: { role: 'button', tabIndex: 0 } }),
}));
const sections = [{ id: 'one', type: 'hero-carousel' }, { id: 'footer', type: 'trust-badges', placement: 'footer' }, { id: 'two', type: 'product-row' }];
const setup = (activePage = 'home') => { const reorder = vi.fn(); const select = vi.fn(); render(<DesignerTreePanel sections={activePage === 'home' ? sections : []} activePage={activePage} pageSettings={{}} onSectionClick={select} onReorderSection={reorder} />); return { reorder, select }; };
describe('store designer section navigation', () => {
  it('translates visible section indices to original insertion indices', () => {
    const { reorder } = setup();
    act(() => dnd.end({ source: { droppableId: 'template', index: 0 }, destination: { droppableId: 'template', index: 1 } }));
    expect(reorder).toHaveBeenCalledWith(0, 3, 'template');
    act(() => dnd.end({ source: { droppableId: 'template', index: 1 }, destination: { droppableId: 'template', index: 0 } }));
    expect(reorder).toHaveBeenLastCalledWith(2, 0, 'template');
  });
  it('ignores cancelled and cross-area drops', () => {
    const { reorder } = setup();
    act(() => dnd.end({ source: { droppableId: 'template', index: 0 }, destination: null }));
    act(() => dnd.end({ source: { droppableId: 'template', index: 0 }, destination: { droppableId: 'footer', index: 0 } }));
    expect(reorder).not.toHaveBeenCalled();
  });
  it('reveals header elements on demand and exposes section edit buttons', () => {
    const { select } = setup();
    expect(screen.queryByText('Announcement bar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Header elements' }));
    expect(screen.getByText('Announcement bar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Hero carousel' }));
    expect(select).toHaveBeenCalledWith(sections[0]);
    expect(screen.getAllByRole('button', { name: 'Add section', exact: true })).toHaveLength(1);
  });
  it('keeps shared layout controls and offers template sections without editable items', () => {
    setup('product');
    expect(screen.getByText('Page Settings')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Header' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Footer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reorder/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add section above page content' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add section below page content' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  });
  it('displays custom section title and section type sublabel', () => {
    const customSections = [{ id: 'hero', type: 'hero-carousel', title: 'Summer Sale 2026' }];
    render(<DesignerTreePanel sections={customSections} activePage="home" pageSettings={{}} />);
    expect(screen.getByText('Summer Sale 2026')).toBeInTheDocument();
    expect(screen.getByText('Hero carousel')).toBeInTheDocument();
  });

  it('edits shared sections from Cart and reorders only the target template group', () => {
    const shared = { id: 'shared', type: 'composed-hero', placement: 'header' };
    const first = { id: 'first', type: 'product-row' };
    const above = { id: 'above', type: 'product-row', pagePosition: 'above' };
    const second = { id: 'second', type: 'product-row' };
    const onAddSection = vi.fn();
    const onSectionClick = vi.fn();
    const onChangePageSections = vi.fn();
    const onPageContentClick = vi.fn();
    render(<DesignerTreePanel sections={[]} sharedSections={[shared]} activePage="cart"
      pageSettings={{ cart: { productRows: [first, above, second] } }} onAddSection={onAddSection}
      onSectionClick={onSectionClick} onChangePageSections={onChangePageSections} onPageContentClick={onPageContentClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Cart blocks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cart products' }));
    expect(onPageContentClick).toHaveBeenLastCalledWith('cartItem');
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    expect(onPageContentClick).toHaveBeenLastCalledWith('checkoutBlock');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Composable hero' }));
    expect(onSectionClick).toHaveBeenCalledWith(shared);
    const add = screen.getByRole('button', { name: 'Add section to header' });
    fireEvent.click(add);
    expect(onAddSection).toHaveBeenCalledWith(1, 'header', add);
    act(() => dnd.end({ source: { droppableId: 'page-template-below', index: 0 }, destination: { droppableId: 'page-template-below', index: 1 } }));
    expect(onChangePageSections).toHaveBeenCalledWith([second, above, first]);
  });

  it('can put a legacy supplemental block directly after a built-in product block', () => {
    const info = { id: 'info', type: 'product-info', heroBlocks: [{ id: 'care', type: 'text', text: 'Care instructions' }] };
    const onProductDetailsOrderChange = vi.fn();
    render(<DesignerTreePanel sections={[info]} activePage="product" pageSettings={{}}
      onProductDetailsOrderChange={onProductDetailsOrderChange} />);
    fireEvent.click(screen.getByRole('button', { name: /expand product information/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Care instructions down' }));
    const [section, order] = onProductDetailsOrderChange.mock.calls[0];
    expect(section).toBe(info);
    expect(order.slice(-3)).toEqual(['specifications', 'custom:care', 'description']);
    expect(order).toContain('purchase');
  });
});
