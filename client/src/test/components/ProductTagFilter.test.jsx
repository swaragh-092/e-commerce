import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductTagFilter from '../../components/admin/ProductTagFilter';
import { getTags } from '../../services/tagService';
vi.mock('../../services/tagService', () => ({ getTags: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe('admin product tag filter', () => {
  it('searches the dictionary on the server and emits the selected slug', async () => {
    getTags.mockImplementation(async ({ search }) => ({ data: search === 'Rare' ? [{ id: 'rare', name: 'Rare Seeds', slug: 'rare-seeds' }] : [] }));
    const onChange = vi.fn();
    render(<ProductTagFilter value="uncached-tag" onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Tag' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Rare' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Rare Seeds' }));
    expect(getTags).toHaveBeenCalledWith({ search: 'Rare', limit: 20 });
    expect(onChange).toHaveBeenCalledWith('rare-seeds');
  });
  it('keeps the selected label while searching and permits clearing the filter', async () => {
    getTags.mockResolvedValue({ data: [{ name: 'Rare Seeds', slug: 'rare-seeds' }] });
    const onChange = vi.fn();
    const view = render(<ProductTagFilter value="rare-seeds" onChange={onChange} />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Tag' })).toHaveValue('Rare Seeds'));
    getTags.mockResolvedValue({ data: [] });
    fireEvent.focus(screen.getByRole('combobox', { name: 'Tag' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Tag' }), { target: { value: 'Different' } });
    await waitFor(() => expect(getTags).toHaveBeenCalledWith({ search: 'Different', limit: 20 }));
    fireEvent.click(screen.getByLabelText('Clear'));
    expect(onChange).toHaveBeenLastCalledWith('');
    view.rerender(<ProductTagFilter value="" onChange={onChange} />);
  });
  it('shows a recoverable suggestion error for an invalid response', async () => {
    getTags.mockResolvedValue(undefined);
    render(<ProductTagFilter value="" onChange={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'Tag' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Rare' } });
    expect(await screen.findByText('Could not load tags. Type to retry.')).toBeInTheDocument();
    getTags.mockResolvedValue({ data: [{ name: 'Rare Seeds', slug: 'rare-seeds' }] });
    fireEvent.change(input, { target: { value: 'Rare S' } });
    expect(await screen.findByRole('option', { name: 'Rare Seeds' })).toBeInTheDocument();
  });

});
