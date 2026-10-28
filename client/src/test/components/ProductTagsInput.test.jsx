import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductTagsInput from '../../components/admin/ProductTagsInput';
import { getTags } from '../../services/tagService';
vi.mock('../../services/tagService', () => ({ getTags: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); getTags.mockResolvedValue({ data: [{ name: 'Home Gardening' }] }); });

describe('product tag entry', () => {
  it('loads suggestions and attaches a selected reusable tag', async () => {
    const onChange = vi.fn();
    render(<ProductTagsInput value={[]} onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Tags' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Home' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Home Gardening' }));
    expect(onChange).toHaveBeenCalledWith(['Home Gardening']);
  });
  it('creates a label with Enter and ignores case/whitespace duplicates', () => {
    const onChange = vi.fn();
    render(<ProductTagsInput value={['Summer']} onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Tags' });
    fireEvent.change(input, { target: { value: ' summer ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['Summer']);
    fireEvent.change(input, { target: { value: ' Beginner   Friendly ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['Summer', 'Beginner Friendly']);
  });
  it('commits typed text on blur so saving does not drop the last tag', () => {
    const onChange = vi.fn();
    render(<ProductTagsInput value={[]} onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Tags' });
    fireEvent.change(input, { target: { value: 'Summer' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(['Summer']);
  });
  it('keeps manual entry available when suggestions fail', async () => {
    getTags.mockRejectedValue(new Error('offline'));
    render(<ProductTagsInput value={[]} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Suggestions could not load/)).toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Tags' })).toBeEnabled();
  });
});
