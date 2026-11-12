import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LiveStorefrontPreview from '../../../components/admin/settings/LiveStorefrontPreview';

describe('real storefront inspector', () => {
  it('selects real sections and components without following their links', () => {
    const onSelectSection = vi.fn();
    const onSelectComponent = vi.fn();
    const { unmount } = render(<LiveStorefrontPreview settings={{ theme: {} }} onSelectSection={onSelectSection} onSelectComponent={onSelectComponent} />);
    const iframe = screen.getByTitle('Live storefront preview');
    const doc = document.implementation.createHTMLDocument('Storefront');
    Object.defineProperty(doc, 'defaultView', { value: window });
    Object.defineProperty(iframe, 'contentDocument', { value: doc });
    doc.body.innerHTML = '<header data-store-component="headerLayout"><a href="/products">Shop</a></header><section data-store-section="hero"><button>Hero</button></section>';
    fireEvent.load(iframe);
    expect(fireEvent.click(doc.querySelector('a'))).toBe(false);
    expect(onSelectComponent).toHaveBeenCalledWith('headerLayout');
    fireEvent.click(doc.querySelector('button'));
    expect(onSelectSection).toHaveBeenCalledWith('hero');
    unmount();
    fireEvent.click(doc.querySelector('button'));
    expect(onSelectSection).toHaveBeenCalledTimes(1);
  });

  it('leaves normal preview interactions untouched when inspection is off', () => {
    render(<LiveStorefrontPreview settings={{ theme: {} }} />);
    const iframe = screen.getByTitle('Live storefront preview');
    const doc = document.implementation.createHTMLDocument('Storefront');
    Object.defineProperty(doc, 'defaultView', { value: window });
    Object.defineProperty(iframe, 'contentDocument', { value: doc });
    doc.body.innerHTML = '<section data-store-section="hero"><button>Hero</button></section>';
    fireEvent.load(iframe);
    expect(fireEvent.click(doc.querySelector('button'))).toBe(true);
    expect(doc.querySelector('style')).toBeNull();
  });
});
