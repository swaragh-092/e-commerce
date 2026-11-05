import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignVersionHistoryDialog from '../../components/admin/themes/DesignVersionHistoryDialog';
import SaveAsTemplateDialog from '../../components/admin/themes/SaveAsTemplateDialog';
import AddSectionDialog from '../../components/admin/sections/AddSectionDialog';

const { theme } = vi.hoisted(() => ({ theme: { exportTheme: vi.fn(), importTheme: vi.fn() } }));
vi.mock('../../services/themeService', () => ({ default: theme }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Admin' } }) }));

describe('Designer dialog dismissal during requests', () => {
  it('labels the add-section control and supports cancellation by Escape', () => {
    const onClose = vi.fn();
    render(<AddSectionDialog open onClose={onClose} onAdd={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Section Type' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
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
