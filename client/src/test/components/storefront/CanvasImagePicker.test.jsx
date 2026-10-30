import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasEditableImage } from '../../../components/storefront/sections/SectionFallback';

const { media, notify } = vi.hoisted(() => ({ media: { list: vi.fn(), uploadMedia: vi.fn() }, notify: vi.fn() }));
vi.mock('../../../services/mediaService', () => ({ mediaService: media }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify }) }));

beforeEach(() => {
  vi.clearAllMocks();
  media.list.mockResolvedValue({ data: [], meta: { page: 1, totalPages: 1 } });
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

const mount = () => {
  const onCommit = vi.fn();
  const onParentClick = vi.fn();
  render(<div onClick={onParentClick}>
    <CanvasEditableImage section={{ id: 'hero' }} field="image" preview onInlineFieldCommit={onCommit}>
      <img src="/hero.jpg" alt="Hero image" />
    </CanvasEditableImage>
  </div>);
  fireEvent.click(screen.getByAltText('Hero image'));
  return { onCommit, onParentClick };
};

describe('Canvas image picker dismissal', () => {
  it.each(['Cancel', 'Close', 'Escape', 'Backdrop'])('keeps the picker closed after %s without changing the image', async (action) => {
    const { onCommit, onParentClick } = mount();
    const dialog = await screen.findByRole('dialog');
    if (action === 'Cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    if (action === 'Close') fireEvent.click(screen.getByRole('button', { name: 'Close media picker' }));
    if (action === 'Escape') fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    if (action === 'Backdrop') {
      fireEvent.mouseDown(dialog.parentElement);
      fireEvent.click(dialog.parentElement);
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onCommit).not.toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByAltText('Hero image'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('does not apply an upload that completes after cancellation', async () => {
    let finishUpload;
    media.uploadMedia.mockImplementationOnce(() => new Promise((resolve) => { finishUpload = resolve; }));
    const { onCommit } = mount();
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(dialog.querySelector('input[type="file"]'), { target: { files: [new File(['image'], 'hero.png', { type: 'image/png' })] } });
    await waitFor(() => expect(media.uploadMedia).toHaveBeenCalledTimes(1));
    const signal = media.uploadMedia.mock.calls[0][2];
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(signal.aborted).toBe(true);
    await act(async () => finishUpload({ success: true, data: { media: { id: 'new', url: '/new.png' } } }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('selects an image once without leaking selection clicks to the canvas', async () => {
    media.list.mockResolvedValueOnce({ data: [{ id: 'chosen', url: '/chosen.jpg', originalName: 'Chosen image' }], meta: { page: 1, totalPages: 1 } });
    const { onCommit, onParentClick } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Select Chosen image' }));
    expect(screen.getByRole('button', { name: 'Select Chosen image' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Select', exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('hero', 'image', '/chosen.jpg', undefined);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('supports reopening the image picker with the keyboard', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.keyDown(screen.getByRole('button', { name: 'Change image', exact: true }), { key: 'Enter' });
    expect(await screen.findByRole('dialog', { name: 'Select Image' })).toBeInTheDocument();
  });
});
