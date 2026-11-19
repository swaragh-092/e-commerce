import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DraftArchivesDialog from '../../../components/admin/themes/DraftArchivesDialog';
import DraftReviewDialog from '../../../components/admin/themes/DraftReviewDialog';
import { getDesignState, getDraftArchives, restoreDraftArchive } from '../../../services/settingsService';
vi.mock('../../../services/settingsService', () => ({ getDesignState: vi.fn(), getDraftArchives: vi.fn(), restoreDraftArchive: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });

describe('draft recovery controls', () => {
  it('compares saved and live values without writing changes', async () => {
    getDesignState.mockResolvedValue({ groups: { theme: { primaryColor: '#ffffff' } } });
    render(<DraftReviewDialog open draft={{ payload: [{ group: 'theme', key: 'primaryColor', value: '#000000' }] }} conflicts={[{ group: 'theme', key: 'primaryColor' }]} />);
    expect(await screen.findByText('theme.primaryColor — conflict')).toBeInTheDocument();
    expect(screen.getByText('"#ffffff"')).toBeInTheDocument();
    expect(screen.getByText('"#000000"')).toBeInTheDocument();
    expect(restoreDraftArchive).not.toHaveBeenCalled();
  });
  it('restores only after confirmation and refreshes the editor', async () => {
    getDraftArchives.mockResolvedValue({ archives: [{ id: 'archive', revision: 4, createdAt: '2026-11-12T09:00:00Z' }] });
    restoreDraftArchive.mockResolvedValue({});
    const onRestored = vi.fn();
    const onClose = vi.fn();
    render(<DraftArchivesDialog open draft={{ revision: 7 }} onRestored={onRestored} onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore draft' }));
    expect(restoreDraftArchive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(restoreDraftArchive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Restore draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm restore to draft' }));
    await waitFor(() => expect(restoreDraftArchive).toHaveBeenCalledWith('archive', 7));
    expect(onRestored).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('protects unsaved changes and reports archive fetch errors', async () => {
    getDraftArchives.mockResolvedValue({ archives: [{ id: 'a', revision: 4, createdAt: '2026-11-12' }] });
    const { unmount } = render(<DraftArchivesDialog open dirty />);
    expect(await screen.findByRole('button', { name: 'Restore draft' })).toBeDisabled();
    unmount();
    getDraftArchives.mockRejectedValue(new Error('Offline'));
    render(<DraftArchivesDialog open />);
    expect(await screen.findByText('Could not load archived drafts. Close and retry.')).toBeInTheDocument();
  });
});
