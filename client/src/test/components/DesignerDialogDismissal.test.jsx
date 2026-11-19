import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignVersionHistoryDialog from '../../components/admin/themes/DesignVersionHistoryDialog';
import SaveAsTemplateDialog from '../../components/admin/themes/SaveAsTemplateDialog';
import AddSectionDialog from '../../components/admin/sections/AddSectionDialog';
import DesignerTreePanel from '../../components/admin/themes/designer/DesignerTreePanel';

const { theme } = vi.hoisted(() => ({ theme: { exportTheme: vi.fn(), importTheme: vi.fn() } }));
vi.mock('../../services/themeService', () => ({ default: theme }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Admin' } }) }));

describe('Designer dialog dismissal during requests', () => {
  it('labels the add-section control and supports cancellation by Escape', () => {
    const onClose = vi.fn();
    render(<AddSectionDialog open onClose={onClose} onAdd={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Search sections' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['Most Viewed', 'mostViewed'],
    ['Trending This Week', 'trending'],
    ['Best Sellers', 'bestSellers'],
    ['Featured Products', 'featured'],
    ['New Arrivals', 'newest'],
    ['On Sale', 'sale'],
  ])('adds %s directly from the section picker', (label, source) => {
    const onAdd = vi.fn();
    render(<AddSectionDialog open onClose={vi.fn()} onAdd={onAdd}
      sectionPresets={{ 'product-row': { type: 'product-row', variant: 'grid', source: 'sale', dataSourceSlug: 'theme-feed', query: { sale: true } } }} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search sections' }), { target: { value: label } });
    fireEvent.click(screen.getByRole('button', { name: label, exact: true }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      type: 'product-row', source, title: label, dataSourceSlug: '', query: {},
    }));
  });

  it('keeps unavailable section types out of search results', () => {
    render(<AddSectionDialog open onClose={vi.fn()} onAdd={vi.fn()} allowedTypes={['composed-hero']} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search sections' }), { target: { value: 'Best Sellers' } });
    expect(screen.getByRole('status')).toHaveTextContent('No matching sections');
    expect(screen.queryByRole('complementary', { name: 'Section layout preview' })).not.toBeInTheDocument();
  });

  it('previews hovered and keyboard-focused sections without inserting them', () => {
    const onAdd = vi.fn();
    render(<AddSectionDialog open onClose={vi.fn()} onAdd={onAdd} allowedTypes={['product-row']} />);
    const pane = screen.getByRole('complementary', { name: 'Section layout preview' });
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Best Sellers', exact: true }));
    expect(pane).toHaveTextContent('Best Sellers');
    fireEvent.focus(screen.getByRole('button', { name: 'On Sale', exact: true }));
    expect(pane).toHaveTextContent('On Sale');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('opens block insertion at the sibling selected in the section tree', () => {
    const onAddProductBlock = vi.fn();
    const onSectionClick = vi.fn();
    const section = { id: 'hero', type: 'composed-hero', title: 'Hero', heroBlocks: [
      { id: 'headline', type: 'heading', text: 'Featured this week' },
    ] };
    render(<DesignerTreePanel activePage="home" pageSettings={{}} sections={[section]}
      onAddProductBlock={onAddProductBlock} onSectionClick={onSectionClick} />);
    expect(screen.queryByRole('button', { name: 'Heading – Featured this week' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Hero' }));
    expect(onSectionClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Heading – Featured this week' })).toBeVisible();
    const insert = screen.getByRole('button', { name: 'Add block below' });
    fireEvent.click(insert);
    expect(onAddProductBlock).toHaveBeenCalledWith(section, expect.objectContaining({ afterId: 'headline', anchorEl: insert }));
  });

  it('allows history to close while its read-only list is loading', () => {
    const onClose = vi.fn();
    render(<DesignVersionHistoryDialog open loading onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps dismissal consistent while a version restore is running', () => {
    const onClose = vi.fn();
    render(<DesignVersionHistoryDialog open restoringId="version-1" onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the template save visible until its write finishes', async () => {
    const onClose = vi.fn();
    let finishExport;
    theme.exportTheme.mockImplementationOnce(() => new Promise((resolve) => { finishExport = resolve; }));
    theme.importTheme.mockResolvedValueOnce({});
    render(<SaveAsTemplateDialog open onClose={onClose} />);
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /Template Name/ }), { target: { value: 'Saved theme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save to Library' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finishExport({ meta: {} }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(theme.importTheme).toHaveBeenCalledTimes(1);
  });
});
