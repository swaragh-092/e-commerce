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
const setup = (activePage = 'home') => { const reorder = vi.fn(); const select = vi.fn(); render(<DesignerTreePanel sections={sections} activePage={activePage} pageSettings={{}} onSectionClick={select} onReorderSection={reorder} />); return { reorder, select }; };
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
    fireEvent.click(screen.getByRole('button', { name: 'Header elements' }));
    expect(screen.getByText('Announcement bar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Hero carousel' }));
    expect(select).toHaveBeenCalledWith(sections[0]);
    expect(screen.getAllByRole('button', { name: 'Add section', exact: true })).toHaveLength(1);
  });
  it('keeps fixed page controls without offering ineffective section edits', () => {
    setup('product');
    expect(screen.getByText('Page Settings')).toBeInTheDocument();
    expect(screen.getByText('This page uses a fixed layout. Use Page Settings above to change its appearance.')).toBeInTheDocument();
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reorder/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add section/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  });
  it('displays custom section title and section type sublabel', () => {
    const customSections = [{ id: 'hero', type: 'hero-carousel', title: 'Summer Sale 2026' }];
    render(<DesignerTreePanel sections={customSections} activePage="home" pageSettings={{}} />);
    expect(screen.getByText('Summer Sale 2026')).toBeInTheDocument();
    expect(screen.getByText('Hero carousel')).toBeInTheDocument();
  });
});
