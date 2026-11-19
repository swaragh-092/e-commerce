import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useCategoryAttributes from '../../hooks/useCategoryAttributes';
import attributeService from '../../services/attributeService';

vi.mock('../../services/attributeService', () => ({ default: { getCategoryAttributes: vi.fn() } }));
const response = (attributes) => ({ data: { data: attributes } });
const inherited = { id: 'height', name: 'Height', sources: [{ id: 'parent', name: 'Vegetables', isDirect: false }] };
beforeEach(() => vi.resetAllMocks());

describe('category attribute suggestions', () => {
  it('includes inherited attributes and treats reordered or repeated category selections as the same request', async () => {
    attributeService.getCategoryAttributes.mockResolvedValue(response([inherited]));
    const { result, rerender } = renderHook(({ ids }) => useCategoryAttributes(ids), { initialProps: { ids: ['second', 'first', 'second'] } });
    await waitFor(() => expect(result.current.attributes).toEqual([inherited]));
    expect(attributeService.getCategoryAttributes).toHaveBeenCalledWith(['first', 'second'], true);
    rerender({ ids: ['first', 'second'] });
    expect(attributeService.getCategoryAttributes).toHaveBeenCalledTimes(1);
  });

  it('exposes a request failure and recovers through retry', async () => {
    attributeService.getCategoryAttributes.mockRejectedValueOnce({ response: { data: { error: { message: 'Service temporarily unavailable.' } } } }).mockResolvedValueOnce(response([inherited]));
    const { result } = renderHook(() => useCategoryAttributes(['child']));
    await waitFor(() => expect(result.current.error).toBe('Service temporarily unavailable.'));
    expect(result.current.attributes).toEqual([]);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.attributes).toEqual([inherited]));
    expect(result.current.error).toBeNull();
  });

  it('clears previous suggestions and ignores late responses after a category change or removal', async () => {
    let finishOld;
    attributeService.getCategoryAttributes.mockImplementation(([id]) => id === 'old'
      ? new Promise((resolve) => { finishOld = resolve; }) : Promise.resolve(response([inherited])));
    const { result, rerender } = renderHook(({ ids }) => useCategoryAttributes(ids), { initialProps: { ids: ['old'] } });
    rerender({ ids: ['new'] });
    await waitFor(() => expect(result.current.attributes).toEqual([inherited]));
    await act(async () => finishOld(response([{ id: 'outdated', name: 'Outdated' }])));
    expect(result.current.attributes).toEqual([inherited]);
    rerender({ ids: [] });
    expect(result.current).toMatchObject({ attributes: [], error: null, loading: false, hasCategories: false });
  });

  it('does not present a malformed response as an empty category', async () => {
    attributeService.getCategoryAttributes.mockResolvedValue({ data: { data: {} } });
    const { result } = renderHook(() => useCategoryAttributes('child'));
    await waitFor(() => expect(result.current.error).toContain('could not be loaded'));
    expect(result.current.loading).toBe(false);
  });

  it('loads again when a closed category dialog is reopened', async () => {
    attributeService.getCategoryAttributes.mockResolvedValue(response([inherited]));
    const { result, rerender } = renderHook(({ enabled }) => useCategoryAttributes('child', enabled), { initialProps: { enabled: false } });
    expect(attributeService.getCategoryAttributes).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.attributes).toEqual([inherited]));
    rerender({ enabled: false });
    expect(result.current.attributes).toEqual([]);
    attributeService.getCategoryAttributes.mockResolvedValue(response([]));
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.attributes).toEqual([]));
    expect(attributeService.getCategoryAttributes).toHaveBeenCalledTimes(2);
  });
});
