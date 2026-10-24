import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ThemeHistoryPanel from '../../components/admin/themes/ThemeHistoryPanel';

const ACTIVATION = {
  id: 'a1',
  themeName: 'Aurora',
  themeVersion: '1.0',
  createdAt: new Date().toISOString(),
  appliedScopes: ['theme'],
  rolledBackAt: null,
  appliedByUser: { firstName: 'Admin' },
};

const CONFIRM_TITLE = 'Rollback this template installation?';

describe('ThemeHistoryPanel rollback revocation', () => {
  it('closes the pending confirmation when the rollback handler is revoked', async () => {
    const onRollback = vi.fn();
    const { rerender } = render(<ThemeHistoryPanel activations={[ACTIVATION]} onRollback={onRollback} />);

    fireEvent.click(screen.getByRole('button', { name: /Rollback/ }));
    expect(screen.getByText(CONFIRM_TITLE)).toBeInTheDocument();

    // Revoke settings.manage: the parent passes an undefined handler.
    rerender(<ThemeHistoryPanel activations={[ACTIVATION]} onRollback={undefined} />);

    // The confirmation must close and never throw by calling a missing handler.
    await waitFor(() => expect(screen.queryByText(CONFIRM_TITLE)).not.toBeInTheDocument());
    expect(onRollback).not.toHaveBeenCalled();
  });

  it('hides the rollback action when the handler is unavailable', () => {
    render(<ThemeHistoryPanel activations={[ACTIVATION]} onRollback={undefined} />);
    expect(screen.queryByRole('button', { name: /Rollback/ })).not.toBeInTheDocument();
  });

  it('calls onRollback with the activation id on confirm', async () => {
    const onRollback = vi.fn();
    render(<ThemeHistoryPanel activations={[ACTIVATION]} onRollback={onRollback} />);

    fireEvent.click(screen.getByRole('button', { name: /Rollback/ }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm rollback/ }));

    expect(onRollback).toHaveBeenCalledWith('a1');
    await waitFor(() => expect(screen.queryByText(CONFIRM_TITLE)).not.toBeInTheDocument());
  });
});
