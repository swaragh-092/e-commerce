import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeGalleryPage from '../../../pages/admin/ThemeGalleryPage';
import { PERMISSIONS } from '../../../utils/permissions';

const perms = vi.hoisted(() => ({ current: {} }));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission) => Boolean(perms.current[permission]),
  }),
}));

vi.mock('../../../services/themeService', () => ({
  default: {
    getBuiltinThemes: vi.fn(),
    getLibraryThemes: vi.fn(),
    getActivations: vi.fn(),
  },
}));

vi.mock('../../../services/adminService', () => ({ updateSettings: vi.fn() }));

vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify: vi.fn() }) }));
vi.mock('../../../context/ThemeContext', () => ({ SettingsContext: { Provider: ({ children }) => children } }));

// Render only the open state so the tests can assert open/closed without the
// real dialog internals.
vi.mock('../../../components/admin/themes/ThemeCard', () => ({
  default: ({ theme, onApply }) => (
    <div>
      <span>{theme?.meta?.name || 'theme'}</span>
      {onApply && <button onClick={() => onApply(theme)}>Install</button>}
    </div>
  ),
}));
vi.mock('../../../components/admin/themes/ThemePreviewModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/themes/ThemeDetailModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/themes/ThemeHistoryPanel', () => ({ default: () => null }));
vi.mock('../../../components/admin/themes/ThemeApplyDialog', () => ({
  default: ({ open }) => (open ? <div>apply-dialog-open</div> : null),
}));
vi.mock('../../../components/admin/themes/ThemeImportDialog', () => ({
  default: ({ open }) => (open ? <div>import-dialog-open</div> : null),
}));
vi.mock('../../../components/admin/themes/SaveAsTemplateDialog', () => ({
  default: ({ open }) => (open ? <div>save-template-dialog-open</div> : null),
}));

const themeService = await import('../../../services/themeService').then((m) => m.default);

const BUILTIN = { id: 't1', meta: { slug: 'aurora', name: 'Aurora' } };
const ACTIVE_ACTIVATION = {
  id: 'a1',
  themeName: 'Aurora',
  rolledBackAt: null,
  createdAt: new Date().toISOString(),
  appliedScopes: ['theme'],
  afterSnapshot: {},
};

const grant = (manage = true) => ({
  [PERMISSIONS.SETTINGS_READ]: true,
  [PERMISSIONS.SETTINGS_MANAGE]: manage,
});

describe('ThemeGalleryPage permission gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    perms.current = grant(true);
    themeService.getBuiltinThemes.mockResolvedValue([BUILTIN]);
    themeService.getLibraryThemes.mockResolvedValue([]);
    themeService.getActivations.mockResolvedValue([ACTIVE_ACTIVATION]);
  });

  it('shows the draft-tab write controls to a settings manager', async () => {
    render(<MemoryRouter><ThemeGalleryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Theme Drafts/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: /Theme Drafts/ }));
    expect(await screen.findByText('Save as Custom Theme')).toBeInTheDocument();
    expect(screen.getByText('Reset All Drafts')).toBeInTheDocument();
    expect(screen.getByText('Export Custom Package')).toBeInTheDocument();
  });

  it('hides the draft-tab write controls from a read-only viewer', async () => {
    perms.current = grant(false);
    render(<MemoryRouter><ThemeGalleryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Theme Drafts/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: /Theme Drafts/ }));
    expect(await screen.findByText('Export Custom Package')).toBeInTheDocument();
    expect(screen.queryByText('Save as Custom Theme')).not.toBeInTheDocument();
    expect(screen.queryByText('Reset All Drafts')).not.toBeInTheDocument();
  });

  it('closes the import dialog when settings.manage is revoked', async () => {
    const { rerender } = render(<MemoryRouter><ThemeGalleryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: /Import Template/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Import Template/ }));
    expect(await screen.findByText('import-dialog-open')).toBeInTheDocument();

    perms.current = grant(false);
    rerender(<MemoryRouter><ThemeGalleryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText('import-dialog-open')).not.toBeInTheDocument());
  });

  it('closes the apply dialog when settings.manage is revoked', async () => {
    const { rerender } = render(<MemoryRouter><ThemeGalleryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Install/ }).length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: /Install/ })[0]);
    expect(await screen.findByText('apply-dialog-open')).toBeInTheDocument();

    perms.current = grant(false);
    rerender(<MemoryRouter><ThemeGalleryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText('apply-dialog-open')).not.toBeInTheDocument());
  });

  it('closes the save-template dialog when settings.manage is revoked', async () => {
    const { rerender } = render(<MemoryRouter><ThemeGalleryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: /Save as Template/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Save as Template/ }));
    expect(await screen.findByText('save-template-dialog-open')).toBeInTheDocument();

    perms.current = grant(false);
    rerender(<MemoryRouter><ThemeGalleryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText('save-template-dialog-open')).not.toBeInTheDocument());
  });
});
