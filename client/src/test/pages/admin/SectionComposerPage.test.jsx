import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SectionComposerPage from '../../../pages/admin/SectionComposerPage';
import { SettingsContext } from '../../../context/ThemeContext';
import * as service from '../../../services/settingsService';
const { notify, previewResult } = vi.hoisted(() => ({ notify: vi.fn(), previewResult: { current: null } }));
vi.mock('../../../hooks/useDesignerPreviewPath', () => ({ useDesignerPreviewPath: (page, fallbackPath) => previewResult.current || { path: page === 'product' ? '/products/sample-product' : fallbackPath, loading: false, error: null } }));
vi.mock('../../../context/ThemeContext', async () => ({ SettingsContext: (await import('react')).createContext(null) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../services/settingsService', () => ({ getSettingsGroup: vi.fn(), getDesignDraft: vi.fn(), getDesignState: vi.fn(), getDesignVersions: vi.fn(), publishDesignDraft: vi.fn(), restoreDesignVersion: vi.fn(), saveDesignDraft: vi.fn() }));
vi.mock('../../../components/admin/themes/StorefrontTemplatePreview', () => ({ default: ({ activePage, currentSettings, onSelectSection }) => <div>{(activePage === 'home' ? currentSettings.homepage.sections : currentSettings.productPage.sections)?.map((section) => <button key={section.id} onClick={() => onSelectSection(section)}>Preview {section.title}</button>)}</div> }));
vi.mock('../../../components/admin/themes/designer/DesignerTreePanel', () => ({ default: ({ sections, onToggleSection }) => <div>{sections.map((section, index) => <button key={section.id} onClick={() => onToggleSection(index)}>Hide {section.title}</button>)}</div> }));
vi.mock('../../../components/admin/themes/designer/DesignerSectionEditor', () => ({ default: ({ section, onChange, onBlur }) => (
  <div>
    <input aria-label="Section title" value={section.title} onChange={(event) => onChange('title', event.target.value)} onBlur={onBlur} />
    <button type="button" onClick={() => { onChange('slides', [{ title: 'Added slide' }]); onBlur(); }}>Customize blocks</button>
    <span>Slide blocks: {section.slides?.length || 0}</span>
  </div>
) }));
vi.mock('../../../components/admin/themes/DesignVersionHistoryDialog', () => ({ default: () => null }));
vi.mock('../../../components/admin/themes/SaveAsTemplateDialog', () => ({ default: () => null }));
vi.mock('../../../components/admin/sections/AddSectionDialog', () => ({ default: () => null }));
vi.mock('../../../components/admin/settings/LiveStorefrontPreview', () => ({ default: ({ path, device }) => <div data-testid="live-preview" data-device={device}>Real storefront {path}</div> }));
const homeSection = { id: 'home-hero', type: 'hero-carousel', title: 'Homepage hero' };
const productSection = { id: 'product-recommendations', type: 'product-row', title: 'Product recommendations', enabled: true };
const settings = { homepage: { sections: [homeSection] }, productPage: { sections: [productSection] } };
const mount = () => render(<MemoryRouter><SettingsContext.Provider value={{ settings, refreshSettings: vi.fn() }}><SectionComposerPage /></SettingsContext.Provider></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks();
  previewResult.current = null;
  service.getSettingsGroup.mockResolvedValue(settings.homepage);
  service.getDesignDraft.mockResolvedValue({ draft: null });
  service.getDesignState.mockResolvedValue({ groups: settings, sources: {}, defaults: {} });
  service.saveDesignDraft.mockImplementation(async (payload) => ({ revision: 1, payload }));
});
describe('Store Designer section editing', () => {
  it('uses the real storefront for Product and preserves homepage sections when switching pages', async () => {
    mount();
    await screen.findByRole('button', { name: 'Preview Homepage hero' });
    fireEvent.click(screen.getByRole('button', { name: /^Home/ }));
    fireEvent.click(await screen.findByText('Product', { selector: '.MuiListItemText-primary' }));
    expect(await screen.findByText('Real storefront /products/sample-product')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Interactive editor preview' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Preview Product recommendations' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save draft/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^Product/ }));
    fireEvent.click(await screen.findByText('Home', { selector: '.MuiListItemText-primary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Interactive editor preview' }));
    expect(await screen.findByRole('button', { name: 'Preview Homepage hero' })).toBeInTheDocument();
    expect(service.saveDesignDraft).not.toHaveBeenCalled();
  });
  it('uses the real responsive storefront for device previews and returns to editing on desktop', async () => {
    mount();
    await screen.findByRole('button', { name: 'Preview Homepage hero' });
    fireEvent.click(screen.getByRole('button', { name: 'Mobile', exact: true }));
    expect(await screen.findByTestId('live-preview')).toHaveAttribute('data-device', 'mobile');
    expect(screen.getByRole('button', { name: 'Interactive editor preview' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Preview Homepage hero' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desktop', exact: true }));
    expect(await screen.findByRole('button', { name: 'Preview Homepage hero' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save draft/i })).toBeDisabled();
    expect(service.saveDesignDraft).not.toHaveBeenCalled();
  });

  it('explains a missing preview record without showing an unrelated storefront page', async () => {
    previewResult.current = { path: null, loading: false, error: 'Add a published product to preview a product page.' };
    mount();
    await screen.findByRole('button', { name: 'Preview Homepage hero' });
    fireEvent.click(screen.getByRole('button', { name: /^Home/ }));
    fireEvent.click(await screen.findByText('Product', { selector: '.MuiListItemText-primary' }));
    expect(await screen.findByText('Add a published product to preview a product page.')).toBeInTheDocument();
    expect(screen.queryByText(/^Real storefront/)).not.toBeInTheDocument();
  });
  it('keeps edits made during an in-flight save dirty', async () => {
    let resolveSave;
    service.saveDesignDraft.mockImplementationOnce((payload) => new Promise((resolve) => {
      resolveSave = () => resolve({ revision: 1, payload });
    }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Homepage hero' }));
    const title = await screen.findByRole('textbox', { name: 'Section title' });
    fireEvent.change(title, { target: { value: 'First edit' } });
    fireEvent.blur(title);
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
    await waitFor(() => expect(service.saveDesignDraft).toHaveBeenCalledTimes(1));
    fireEvent.change(title, { target: { value: 'Newer edit' } });
    fireEvent.blur(title);
    await act(async () => { resolveSave(); });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save draft/i })).toBeEnabled();
    expect(title).toHaveValue('Newer edit');
  });
  it('hides an implicitly enabled section on the first click', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Hide Homepage hero' }));
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
    await waitFor(() => expect(service.saveDesignDraft).toHaveBeenCalledTimes(1));
    const payload = service.saveDesignDraft.mock.calls[0][0];
    expect(payload.find((entry) => entry.group === 'homepage' && entry.key === 'sections').value[0].enabled).toBe(false);
  });
  it('keeps changes dirty and allows retry when draft saving fails', async () => {
    service.saveDesignDraft.mockRejectedValueOnce(new Error('Offline'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Hide Homepage hero' }));
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to save design draft', 'error'));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save draft/i })).toBeEnabled();
  });
  it('supports undo and redo without pushing duplicate states on unchanged blur', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Homepage hero' }));
    const title = await screen.findByRole('textbox', { name: 'Section title' });

    expect(screen.getByRole('button', { name: 'Undo section change' })).toBeDisabled();

    fireEvent.change(title, { target: { value: 'Updated Hero' } });
    fireEvent.blur(title);
    fireEvent.blur(title);

    const undoBtn = screen.getByRole('button', { name: 'Undo section change' });
    expect(undoBtn).toBeEnabled();
    fireEvent.click(undoBtn);

    expect(title).toHaveValue('Homepage hero');
    expect(undoBtn).toBeDisabled();

    const redoBtn = screen.getByRole('button', { name: 'Redo section change' });
    expect(redoBtn).toBeEnabled();
    fireEvent.click(redoBtn);

    expect(title).toHaveValue('Updated Hero');
    expect(redoBtn).toBeDisabled();
    expect(undoBtn).toBeEnabled();
  });
  it('records synchronous block changes in undo history immediately', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Homepage hero' }));
    const undo = screen.getByRole('button', { name: 'Undo section change' });
    expect(undo).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Customize blocks' }));
    expect(screen.getByText('Slide blocks: 1')).toBeInTheDocument();
    expect(undo).toBeEnabled();

    fireEvent.click(undo);
    expect(screen.getByText('Slide blocks: 0')).toBeInTheDocument();
    expect(undo).toBeDisabled();
  });

  it('blocks saving and shows retry when initial homepage sections load fails', async () => {
    service.getSettingsGroup.mockRejectedValueOnce(new Error('Network error'));
    mount();
    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save draft/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Publish/i })).toBeDisabled();

    // Now click Retry
    service.getSettingsGroup.mockResolvedValueOnce(settings.homepage);
    const retryBtn = screen.getByRole('button', { name: 'Retry Loading Sections' });
    fireEvent.click(retryBtn);

    expect(await screen.findByRole('button', { name: 'Preview Homepage hero' })).toBeInTheDocument();
  });
});
