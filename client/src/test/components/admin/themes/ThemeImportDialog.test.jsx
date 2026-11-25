import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ThemeImportDialog from '../../../../components/admin/themes/ThemeImportDialog';
import themeService from '../../../../services/themeService';

vi.mock('../../../../services/themeService', () => ({ default: { validateTheme: vi.fn() } }));

it('rechecks the replacement and imports it at the original reference path', async () => {
  const pkg = { schemaVersion: 3, meta: { slug: 'test' }, layout: { homepageSections: [{ selectedCategorySlugs: ['missing'] }] } };
  const path = ['layout', 'homepageSections', 0, 'selectedCategorySlugs', 0];
  themeService.validateTheme.mockResolvedValueOnce({ package: pkg, references: [{ path, value: 'missing', resource: 'category', resolved: false }] });
  themeService.validateTheme.mockImplementationOnce(async (data) => ({
    package: data, references: [{ path, value: 'fruit', resource: 'category', resolved: true }],
  }));
  const onImport = vi.fn();
  const { baseElement } = render(<ThemeImportDialog open onImport={onImport} />);
  fireEvent.change(baseElement.querySelector('input[type="file"]'), {
    target: { files: [new File([JSON.stringify(pkg)], 'test.theme.json', { type: 'application/json' })] },
  });
  fireEvent.change(await screen.findByRole('textbox', { name: 'Replace missing category: missing' }), { target: { value: 'fruit' } });
  expect(screen.getByRole('button', { name: /Save to Library/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply replacements and recheck' }));
  await screen.findByText('1 of 1 references found in this store.');
  fireEvent.click(screen.getByRole('button', { name: /Save to Library/i }));
  expect(onImport.mock.calls[0][0].layout.homepageSections[0].selectedCategorySlugs).toEqual(['fruit']);
});
