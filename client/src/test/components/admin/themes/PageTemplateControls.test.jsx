import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { getCategoryTree } from '../../../../services/categoryService';
import { getProducts } from '../../../../services/productService';
import PageTemplateControls from '../../../../components/admin/themes/designer/PageTemplateControls';

vi.mock('../../../../services/productService', () => ({ getProducts: vi.fn() }));

vi.mock('../../../../services/categoryService', () => ({ getCategoryTree: vi.fn() }));

it.each([
  ['product', 'productSlugs', 'Basil seeds', 'basil-seeds'],
  ['category', 'categorySlugs', 'Basil varieties', 'basil-varieties'],
])('duplicates the default and reassigns the selected %s', async (page, assignmentKey, name, slug) => {
  const defaultSettings = { templateLayout: 'gallery-top-details-below' };
  const previous = { id: 'old', name: 'Previous layout', [assignmentKey]: [slug], settings: {} };
  getProducts.mockResolvedValue({ data: [{ name, slug }] });
  getCategoryTree.mockResolvedValue({ data: [{ slug: 'herbs', name: 'Herbs', children: [{ name, slug }] }] });
  const observeTemplates = vi.fn();
  function Harness() {
    const [templates, setTemplates] = useState([previous]);
    const [selectedId, setSelectedId] = useState('');
    return <PageTemplateControls
      page={page}
      templates={templates}
      defaultSettings={defaultSettings}
      selectedTemplate={templates.find(({ id }) => id === selectedId)}
      onSelect={setSelectedId}
      onChange={(next) => { setTemplates(next); observeTemplates(next); }}
    />;
  }

  render(<Harness />);
  fireEvent.change(screen.getByLabelText('New template name'), { target: { value: 'Seeds' } });
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate default template' }));
  const search = screen.getByRole('combobox', { name: `Assign a ${page}` });
  fireEvent.focus(search);
  fireEvent.change(search, { target: { value: 'basil' } });
  fireEvent.click(await screen.findByRole('option', { name }));

  expect(observeTemplates).toHaveBeenLastCalledWith([
    { ...previous, [assignmentKey]: [] },
    { id: expect.any(String), name: 'Seeds', [assignmentKey]: [slug], settings: defaultSettings },
  ]);
  expect(screen.getByText(slug)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Rename template' }));
  const rename = within(screen.getByRole('dialog', { name: 'Rename template' }));
  fireEvent.change(rename.getByRole('textbox', { name: 'Template name' }), { target: { value: 'Herbs' } });
  fireEvent.click(rename.getByRole('button', { name: 'Save name' }));
  expect(observeTemplates.mock.lastCall[0][1]).toMatchObject({ name: 'Herbs', [assignmentKey]: [slug] });

  fireEvent.click(await screen.findByRole('button', { name: 'Remove template', exact: true }));
  const remove = within(screen.getByRole('dialog', { name: 'Remove template?' }));
  expect(remove.getByText(/all 1 assigned pages will use the default template/)).toBeInTheDocument();
  fireEvent.click(remove.getByRole('button', { name: 'Remove from draft' }));
  expect(observeTemplates).toHaveBeenLastCalledWith([{ ...previous, [assignmentKey]: [] }]);
});
