import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
});
