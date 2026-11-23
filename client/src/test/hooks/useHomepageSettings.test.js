import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useHomepageSettings from '../../hooks/useHomepageSettings';

describe('published homepage sections', () => {
  it('preserves a deliberately empty section list', () => {
    const { result } = renderHook(() => useHomepageSettings({ form: { 'homepage.sections': [] }, set: vi.fn() }));
    expect(result.current.homepageSections).toEqual([]);
  });
  it('uses all published sections, including disabled ones, without injecting defaults', () => {
    const sections = [{ id: 'hero' }, { id: 'products', enabled: false }];
    const { result } = renderHook(() => useHomepageSettings({ form: { 'homepage.sections': sections }, set: vi.fn() }));
    expect(result.current.homepageSections).toBe(sections);
  });
});
