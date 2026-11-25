import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
vi.mock('../../../services/settingsService', () => ({ getSettingsGroup: vi.fn(), getDesignDraft: vi.fn(), getDesignState: vi.fn(), getDesignVersions: vi.fn(), publishDesignDraft: vi.fn(), restoreDesignVersion: vi.fn(), saveDesignDraft: vi.fn(), discardDesignDraft: vi.fn() }));
vi.mock('../../../components/admin/themes/StorefrontTemplatePreview', () => ({ default: ({ activePage, currentSettings, onSelectSection }) => <div>{(activePage === 'home' ? currentSettings.homepage.sections : currentSettings.productPage.sections)?.map((section) => <button key={section.id} onClick={() => onSelectSection(section)}>Preview {section.title}</button>)}</div> }));
vi.mock('../../../components/admin/themes/designer/DesignerTreePanel', () => ({
  default: ({ activePage, sections, onToggleSection, onFooterClick, onPageSettingChange, pageTemplateControls, onReorderSection }) => (
    <div>
      {pageTemplateControls}
      <button onClick={onFooterClick}>Edit footer</button>
      {sections.length > 1 && <button onClick={() => onReorderSection(1, 0, 'template')}>Drop second section first</button>}
      {activePage === 'product' && <button onClick={() => {
        onPageSettingChange('product', (current) => ({ ...current, showSKU: false }));
        onPageSettingChange('product', (current) => ({ ...current, showBreadcrumbs: false }));
      }}>Hide product details</button>}
      {sections.map((section, index) => <button key={section.id} onClick={() => onToggleSection(index)}>Hide {section.title}</button>)}
    </div>
  ),
}));
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
vi.mock('../../../components/admin/settings/LiveStorefrontPreview', () => ({ default: ({ path, device, settings, onSelectSection, onSelectBlock, selectedBlockId, inspectorActions }) => {
  const nestedSection = settings?.homepage?.sections?.find((section) => section.heroBlocks?.[0]?.children);
  const productInfo = onSelectBlock && settings?.productPage?.sections?.find((section) => section.type === 'product-info');
  return <div data-testid="live-preview" data-device={device}>Real storefront {path}
    {onSelectSection && settings?.homepage?.sections?.map((section) => (
      <button key={section.id} onClick={() => onSelectSection(section.id)}>Preview {section.title}</button>
    ))}
    {nestedSection && <>
      <output aria-label="Preview block order">{nestedSection.heroBlocks[0].children.filter((block) => block.enabled !== false).map((block) => block.text).join(', ')}</output>
      <button onClick={() => onSelectBlock(nestedSection.id, 'second')}>Select second nested block</button>
      {selectedBlockId && inspectorActions?.map(({ label, disabled, onClick }) => (
        <button key={label} disabled={disabled} onClick={onClick}>{label}</button>
      ))}
    </>}
    {productInfo && <>
      <button onClick={() => onSelectBlock(productInfo.id, 'care')}>Select care block</button>
      {selectedBlockId && inspectorActions?.map(({ label, disabled, onClick }) => (
        <button key={label} disabled={disabled} onClick={onClick}>{label}</button>
      ))}
    </>}
  </div>;
} }));
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
  it('duplicates an ordered product detail immediately after the original', async () => {
    const productPage = { sections: [{
      id: 'details', type: 'product-info', enabled: true, detailsBlockOrder: ['title', 'custom:care', 'variants'],
      heroBlocks: [{ id: 'care', type: 'text', text: 'Care instructions' }],
    }] };
    service.getDesignState.mockResolvedValue({ groups: { ...settings, productPage }, sources: {}, defaults: {} });
    mount();
    await screen.findByRole('button', { name: 'Preview Homepage hero' });
    fireEvent.click(screen.getByRole('button', { name: /^Home/ }));
    fireEvent.click(await screen.findByText('Product', { selector: '.MuiListItemText-primary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Interactive editor preview' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select care block' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicate block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(service.saveDesignDraft).toHaveBeenCalledOnce());
    const [payload] = service.saveDesignDraft.mock.calls[0];
    const [section] = payload.find(({ group, key }) => group === 'productPage' && key === 'sections').value;
    const [, copy] = section.heroBlocks;
    expect(copy.id).not.toBe('care');
    expect(section.detailsBlockOrder.slice(0, 4)).toEqual(['title', 'custom:care', `custom:${copy.id}`, 'variants']);
  });
  it('moves a nested block from the preview and persists it after undo and redo', async () => {
    const nested = { id: 'nested', title: 'Nested hero', type: 'composed-hero', enabled: true, heroBlocks: [{
      id: 'group', type: 'group', children: [
        { id: 'first', type: 'heading', text: 'First' },
        { id: 'second', type: 'text', text: 'Second' },
      ],
    }] };
    const homepage = { sections: [nested] };
    service.getDesignState.mockResolvedValue({ groups: { ...settings, homepage }, sources: {}, defaults: {} });
    service.getSettingsGroup.mockResolvedValue(homepage);
    const { unmount } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Select second nested block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move up', exact: true }));
    expect(screen.getByLabelText('Preview block order')).toHaveTextContent('Second, First');
    fireEvent.click(screen.getByRole('button', { name: 'Undo section change' }));
    expect(screen.getByLabelText('Preview block order')).toHaveTextContent('First, Second');
    fireEvent.click(screen.getByRole('button', { name: 'Redo section change' }));
    expect(screen.getByLabelText('Preview block order')).toHaveTextContent('Second, First');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(service.saveDesignDraft).toHaveBeenCalledOnce());
    const [payload] = service.saveDesignDraft.mock.calls[0];
    unmount();
    service.getDesignDraft.mockResolvedValue({ draft: { revision: 1, payload } });
    mount();
    expect(await screen.findByLabelText('Preview block order')).toHaveTextContent('Second, First');
    fireEvent.click(screen.getByRole('button', { name: 'Select second nested block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate block' }));
    expect(screen.getByLabelText('Preview block order')).toHaveTextContent('Second, Second, First');
    fireEvent.click(screen.getByRole('button', { name: 'Delete block' }));
    expect(screen.getByLabelText('Preview block order')).toHaveTextContent('Second, First');
    fireEvent.click(screen.getByRole('button', { name: 'Select second nested block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide block' }));
    expect(screen.getByLabelText('Preview block order')).toHaveTextContent(/^First$/);
    fireEvent.click(screen.getByRole('button', { name: 'Undo section change' }));
    expect(screen.getByLabelText('Preview block order')).toHaveTextContent('Second, First');
  });
  it('updates the preview order on drop and restores the order from the saved draft', async () => {
    const studio = { id: 'studio', type: 'product-row', title: 'Shop The Studio' };
    const initialLayout = { sections: [homeSection, studio] };
    service.getDesignState.mockResolvedValue({ groups: { ...settings, homepage: initialLayout }, sources: {}, defaults: {} });
    service.getSettingsGroup.mockResolvedValue(initialLayout);
    const { unmount } = mount();
    await screen.findByRole('button', { name: 'Preview Shop The Studio' });
    fireEvent.click(screen.getByRole('button', { name: 'Drop second section first' }));
    const previewTitles = () => within(screen.getByTestId('live-preview')).getAllByRole('button').map((button) => button.textContent);
    expect(previewTitles()).toEqual(['Preview Shop The Studio', 'Preview Homepage hero']);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(service.saveDesignDraft).toHaveBeenCalledOnce());
    const [payload] = service.saveDesignDraft.mock.calls[0];
    expect(payload).toContainEqual(expect.objectContaining({ group: 'homepage', key: 'sections', value: [studio, homeSection] }));
    unmount();
    service.getDesignDraft.mockResolvedValue({ draft: { revision: 1, payload } });
    mount();
    await screen.findByRole('button', { name: 'Preview Shop The Studio' });
    expect(previewTitles()).toEqual(['Preview Shop The Studio', 'Preview Homepage hero']);
  });

  it('opens the selected preview section inside the design controls sidebar', async () => {
    mount();
    const sidebar = await screen.findByRole('complementary', { name: 'Design controls' });
    expect(within(sidebar).queryByRole('textbox', { name: 'Section title' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Homepage hero' }));
    expect(within(sidebar).getByRole('textbox', { name: 'Section title' })).toHaveValue('Homepage hero');
    expect(within(sidebar).getByRole('button', { name: 'Hide Homepage hero' })).toBeVisible();
  });

  it('identifies the editable draft and its saved library template source', async () => {
    service.getDesignDraft.mockResolvedValueOnce({ draft: {
      revision: 2, payload: [], templateSource: { name: 'Fresh Harvest', kind: 'library' },
    } });
    mount();
    expect(await screen.findByText('Fresh Harvest')).toBeInTheDocument();
    expect(screen.getByText('Draft saved')).toBeInTheDocument();
    expect(screen.getByText('Based on a library template')).toBeInTheDocument();
  });
  it.each([
    ['Product', 'productPage', 'productSlugs', '/products'],
    ['Category', 'categoryPage', 'categorySlugs', '/category'],
  ])('reopens a saved alternate %s template and previews its assignment', async (page, group, assignmentKey, prefix) => {
    const template = {
      id: 'seeds', name: 'Seeds', [assignmentKey]: page === 'Product' ? ['basil-seeds', 'beet-seeds', 'plain-seeds'] : ['basil-seeds'],
      settings: { sections: [], productRows: [{ id: 'care', title: 'Care FAQ', type: 'faq' }] },
    };
    service.getDesignDraft.mockResolvedValueOnce({ draft: {
      revision: 4,
      payload: [{ group, key: 'alternateTemplates', value: [template] }],
    } });
    mount();
    await screen.findByRole('button', { name: 'Preview Homepage hero' });
    fireEvent.click(screen.getByRole('button', { name: /^Home/ }));
    fireEvent.click(await screen.findByText(page, { selector: '.MuiListItemText-primary' }));
    fireEvent.mouseDown(await screen.findByRole('combobox', { name: `${page} template` }));
    fireEvent.click(await screen.findByRole('option', { name: 'Seeds' }));

    expect(screen.getByTestId('live-preview')).toHaveTextContent(`${prefix}/basil-seeds`);
    expect(screen.getByRole('button', { name: 'Hide Care FAQ' })).toBeInTheDocument();
    if (page === 'Product') {
      for (const slug of ['beet-seeds', 'plain-seeds']) {
        fireEvent.mouseDown(screen.getByRole('combobox', { name: /Preview product/ }));
        fireEvent.click(await screen.findByRole('option', { name: slug }));
        expect(screen.getByTestId('live-preview')).toHaveTextContent(`/products/${slug}`);
      }
    }
  });

  const oldDraft = { revision: 46, payload: [{ group: 'homepage', key: 'sections', value: [{ ...homeSection, title: 'Old template hero' }] }] };
  const conflicts = [{ group: 'homepage', key: 'sections' }];

  it('warns about an outdated template draft, keeps it on cancel, then loads live only after confirmation', async () => {
    service.getDesignDraft.mockResolvedValueOnce({ draft: oldDraft, conflicts });
    mount();
    await screen.findByRole('button', { name: 'Preview Old template hero' });
    expect(screen.getByText(/editor is showing your draft, not the live design/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Publishing unavailable: resolve design conflicts.');
    fireEvent.click(await screen.findByRole('button', { name: 'Use live storefront' }));
    expect(await screen.findByRole('dialog', { name: 'Replace draft with live storefront?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(service.discardDesignDraft).not.toHaveBeenCalled();
    expect(await screen.findByText('Preview Old template hero')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Use live storefront' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Archive draft and load live' }));
    await waitFor(() => expect(service.discardDesignDraft).toHaveBeenCalledWith(46));
    expect(await screen.findByRole('button', { name: 'Preview Homepage hero' })).toBeInTheDocument();
    expect(screen.queryByText(/editor is showing your draft, not the live design/)).not.toBeInTheDocument();
    expect(service.publishDesignDraft).not.toHaveBeenCalled();
  });

  it.each([{ remainingConflicts: [] }, { remainingConflicts: conflicts }])('refreshes conflict status after saving revised settings: $remainingConflicts', async ({ remainingConflicts }) => {
    service.getDesignDraft.mockResolvedValueOnce({ draft: oldDraft, conflicts });
    service.getDesignDraft.mockResolvedValueOnce({ draft: { revision: 47 }, conflicts: remainingConflicts });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Old template hero' }));
    const title = await screen.findByRole('textbox', { name: 'Section title' });
    fireEvent.change(title, { target: { value: 'Homepage hero' } });
    fireEvent.blur(title);
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
    await waitFor(() => expect(service.getDesignDraft).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: /Save draft/i })).toBeDisabled());
    const publish = screen.getByRole('button', { name: 'Publish', exact: true });
    if (remainingConflicts.length) {
      expect(publish).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Use live storefront' })).toBeInTheDocument();
    } else {
      expect(publish).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Use live storefront' })).not.toBeInTheDocument();
    }
    expect(title).toHaveValue('Homepage hero');
  });

  it('blocks publishing if conflict refresh fails after a successful save', async () => {
    service.getDesignDraft.mockResolvedValueOnce({ draft: oldDraft, conflicts });
    service.getDesignDraft.mockRejectedValueOnce(new Error('Offline'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Hide Old template hero' }));
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
    expect(await screen.findByText('Draft saved, but conflict status could not be refreshed. Retry loading before publishing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  });

  it('preserves the draft when revision-checked discard fails', async () => {
    service.getDesignDraft.mockResolvedValueOnce({ draft: oldDraft, conflicts });
    service.discardDesignDraft.mockRejectedValueOnce(new Error('Conflict'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Use live storefront' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Archive draft and load live' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Could not load the live design. Please retry.', 'error'));
    expect(await screen.findByText('Preview Old template hero')).toBeInTheDocument();
  });

  it('does not silently ignore failure to load a saved draft', async () => {
    service.getDesignDraft.mockRejectedValueOnce(new Error('Draft load failed'));
    mount();
    expect(await screen.findByText('Draft load failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save draft/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Publishing unavailable: reload the design.');
  });

  it('labels the no-draft state as published and explains why publishing is unavailable', async () => {
    mount();
    expect(await screen.findByText('Published design')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('No draft to publish.');
  });

  it('explains that unsaved changes must be saved before publishing', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Hide Homepage hero' }));
    expect(screen.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Save your changes before publishing.');
  });

  it('shows recovery when the live design changes after the editor loads', async () => {
    service.getDesignDraft.mockResolvedValueOnce({ draft: oldDraft, conflicts: [] });
    service.publishDesignDraft.mockRejectedValueOnce({ response: { data: { error: { message: 'Live changed', details: { conflicts } } } } });
    mount();
    await screen.findByRole('button', { name: 'Preview Old template hero' });
    fireEvent.click(screen.getByRole('button', { name: 'Publish', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publish design', exact: true }));
    expect(await screen.findByRole('button', { name: 'Use live storefront' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Publish design draft?' })).not.toBeInTheDocument();
  });

  it('uses the real storefront for Product and preserves homepage sections when switching pages', async () => {
    mount();
    await screen.findByRole('button', { name: 'Preview Homepage hero' });
    fireEvent.click(screen.getByRole('button', { name: /^Home/ }));
    fireEvent.click(await screen.findByText('Product', { selector: '.MuiListItemText-primary' }));
    expect(await screen.findByText('Real storefront /products/sample-product')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Interactive editor preview' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Preview Product recommendations' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Interactive editor preview' }));
    expect(await screen.findByText(/with sample content/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Preview Product recommendations' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Read-only live storefront preview' }));
    expect(await screen.findByText('Real storefront /products/sample-product')).toBeInTheDocument();
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

  it('undoes and redoes footer visibility changes', async () => {
    mount();
    await screen.findByRole('button', { name: 'Preview Homepage hero' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit footer' }));
    const quickLinks = await screen.findByRole('checkbox', { name: 'Show quick links column' });
    expect(quickLinks).toBeChecked();
    fireEvent.click(quickLinks);
    expect(quickLinks).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Undo section change' }));
    expect(quickLinks).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Redo section change' }));
    expect(quickLinks).not.toBeChecked();
  });

  it('undoes and redoes a product template setting change', async () => {
    mount();
    await screen.findByRole('button', { name: 'Preview Homepage hero' });
    fireEvent.click(screen.getByRole('button', { name: /^Home/ }));
    fireEvent.click(await screen.findByText('Product', { selector: '.MuiListItemText-primary' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hide product details' }));

    const undo = screen.getByRole('button', { name: 'Undo section change' });
    const redo = screen.getByRole('button', { name: 'Redo section change' });
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    fireEvent.click(undo);
    expect(undo).toBeDisabled();
    expect(redo).toBeEnabled();
    fireEvent.click(redo);
    fireEvent.click(redo);
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
    await waitFor(() => expect(service.saveDesignDraft).toHaveBeenCalledWith(
      expect.arrayContaining([
        { group: 'productPage', key: 'showSKU', value: false },
        { group: 'productPage', key: 'showBreadcrumbs', value: false },
      ]), undefined,
    ));
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
