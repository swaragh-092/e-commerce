import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LiveStorefrontPreview from '../../../components/admin/settings/LiveStorefrontPreview';

describe('real storefront inspector', () => {
  it('highlights only the owning nested block, restores highlight after DOM replacement, and runs its action', async () => {
    const onSelectBlock = vi.fn();
    const onClick = vi.fn();
    render(<LiveStorefrontPreview selectedSectionId="hero" selectedBlockId="heading" onSelectBlock={onSelectBlock}
      inspectorActions={[{ label: 'Duplicate block', onClick }]} />);
    const iframe = screen.getByTitle('Storefront design preview');
    const doc = document.implementation.createHTMLDocument('Storefront');
    Object.defineProperty(doc, 'defaultView', { value: window });
    Object.defineProperty(iframe, 'contentDocument', { value: doc });
    doc.body.innerHTML = '<section data-store-section="other"><span data-store-owner="other" data-store-block="heading">Other</span></section><section data-store-section="hero"><div data-store-owner="hero" data-store-block="group"><span data-store-owner="hero" data-store-block="heading">Target</span></div></section>';
    fireEvent.load(iframe);
    expect(doc.querySelectorAll('[data-designer-selected]')).toHaveLength(1);
    expect(doc.querySelector('[data-designer-selected]').textContent).toBe('Target');
    fireEvent.click(doc.querySelector('[data-designer-actions] button'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onSelectBlock).not.toHaveBeenCalled();
    const target = doc.querySelector('[data-designer-selected]');
    const replacement = target.cloneNode(true);
    replacement.removeAttribute('data-designer-selected');
    target.replaceWith(replacement);
    await waitFor(() => expect(replacement).toHaveAttribute('data-designer-selected'));
    fireEvent.click(replacement);
    expect(onSelectBlock).toHaveBeenCalledWith('hero', 'heading');
  });
  it('selects real sections and components without following their links', () => {
    const onSelectSection = vi.fn();
    const onSelectComponent = vi.fn();
    const { unmount } = render(<LiveStorefrontPreview settings={{ theme: {} }} selectedSectionId="hero" onSelectSection={onSelectSection} onSelectComponent={onSelectComponent} />);
    const iframe = screen.getByTitle('Storefront design preview');
    const doc = document.implementation.createHTMLDocument('Storefront');
    Object.defineProperty(doc, 'defaultView', { value: window });
    Object.defineProperty(iframe, 'contentDocument', { value: doc });
    doc.body.innerHTML = '<header data-store-component="headerLayout"><a href="/products">Shop</a></header><section data-store-section="hero"><button>Hero</button></section>';
    const section = doc.querySelector('section');
    section.scrollIntoView = vi.fn();
    fireEvent.load(iframe);
    expect(section.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
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
    const iframe = screen.getByTitle('Storefront design preview');
    const doc = document.implementation.createHTMLDocument('Storefront');
    Object.defineProperty(doc, 'defaultView', { value: window });
    Object.defineProperty(iframe, 'contentDocument', { value: doc });
    doc.body.innerHTML = '<section data-store-section="hero"><button>Hero</button></section>';
    fireEvent.load(iframe);
    expect(fireEvent.click(doc.querySelector('button'))).toBe(true);
    expect(doc.querySelector('style')).toBeNull();
  });
});
