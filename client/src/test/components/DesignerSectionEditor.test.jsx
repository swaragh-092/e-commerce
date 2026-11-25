import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignerSectionEditor from '../../components/admin/themes/designer/DesignerSectionEditor';

vi.mock('../../services/adminService', () => ({
  getSaleLabels: vi.fn().mockResolvedValue({ data: { data: [{ id: 'summer-sale', name: 'Summer Sale' }] } }),
}));

vi.mock('../../components/common/MediaPicker', () => ({ default: () => <div data-testid="media-picker" /> }));
vi.mock('../../services/categoryService', async (importOriginal) => ({
  ...await importOriginal(),
  getCategories: vi.fn().mockResolvedValue([{ id: 'a', slug: 'grocery', name: 'Grocery', children: [
    { id: 'b', slug: 'produce', name: 'Produce' },
  ] }]),
}));
vi.mock('../../services/brandService', async (importOriginal) => ({
  ...await importOriginal(),
  getBrands: vi.fn().mockResolvedValue({ data: { data: [{ slug: 'craft', name: 'Craft' }] } }),
}));

describe('DesignerSectionEditor BlockListEditor', () => {
  it('commits a nested heading typography choice without changing other blocks', async () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const textBlock = { id: 'text', type: 'text', text: 'Seasonal produce' };
    const heading = { id: 'heading', type: 'heading', text: 'Fresh from the market' };
    const group = { id: 'group', type: 'group', children: [heading, textBlock] };
    render(<DesignerSectionEditor section={{ id: 'hero', type: 'composed-hero', heroBlocks: [group] }}
      activeBlockKey="heroBlocks" activeBlockIndex="heading" onChange={onChange} onBlur={onBlur} />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Text alignment' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Center' }));
    expect(onChange).toHaveBeenCalledWith('heroBlocks', [{ ...group, children: [{ ...heading, textAlign: 'center' }, textBlock] }]);
    expect(onBlur).toHaveBeenCalledOnce();
  });
  it('filters a Product Row by a live brand while preserving its other query fields', async () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const row = { id: 'row', type: 'product-row', source: 'combo', query: { category: 'grocery' } };
    const { rerender } = render(<DesignerSectionEditor section={row} brandsEnabled onChange={onChange} onBlur={onBlur} />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter by brand' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Craft' }));
    expect(onChange).toHaveBeenCalledWith('query', { category: 'grocery', brand: 'craft' });
    rerender(<DesignerSectionEditor section={{ ...row, query: { ...row.query, brand: 'craft' } }} brandsEnabled onChange={onChange} onBlur={onBlur} />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter by brand' }));
    fireEvent.click(await screen.findByRole('option', { name: 'All brands' }));
    expect(onChange).toHaveBeenLastCalledWith('query', { category: 'grocery' });
    expect(onBlur).toHaveBeenCalledTimes(2);
  });
  it('lets Brand Showcase switch from automatic to curated brands', async () => {
    const onChange = vi.fn();
    render(<DesignerSectionEditor section={{ id: 'brands', type: 'brand-showcase' }}
      onChange={onChange} onBlur={vi.fn()} />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Brand source' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Choose brands' }));
    expect(onChange).toHaveBeenCalledWith('selectedBrandSlugs', []);
  });

  it('lets merchants add a nested category and reorder the curated shortcuts', async () => {
    const onChange = vi.fn();
    const row = { id: 'shortcuts', type: 'category-shortcuts', selectedCategorySlugs: ['grocery'] };
    const { rerender } = render(<DesignerSectionEditor section={row} onChange={onChange} onBlur={vi.fn()} />);
    const picker = screen.getByRole('combobox', { name: 'Add category' });
    await screen.findByText('Grocery', { selector: 'p' });
    fireEvent.mouseDown(picker);
    fireEvent.click(await screen.findByRole('option', { name: 'Grocery / Produce' }));
    expect(onChange).toHaveBeenCalledWith('selectedCategorySlugs', ['grocery', 'produce']);
    rerender(<DesignerSectionEditor section={{ ...row, selectedCategorySlugs: ['grocery', 'produce'] }} onChange={onChange} onBlur={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Grocery / Produce up' }));
    expect(onChange).toHaveBeenLastCalledWith('selectedCategorySlugs', ['produce', 'grocery']);
  });
  it.each(['composed-hero', 'editorial-image-text', 'product-info'])('previews blocks without insertion in %s', (type) => {
    const onChange = vi.fn();
    render(<DesignerSectionEditor section={{ id: 'preview', type }} onChange={onChange}
      onBlur={vi.fn()} onBlockFocus={vi.fn()} blockInsertion={{}} />);
    const pane = screen.getByRole('complementary', { name: 'Block preview' });
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Heading', exact: true }));
    expect(pane).toHaveTextContent('Introduce your story');
    fireEvent.focus(screen.getByRole('button', { name: 'Text', exact: true }));
    expect(pane).toHaveTextContent('Share a few details');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('inserts a block directly after the selected sibling in the requested placement', () => {
    const first = { id: 'first', type: 'text', text: 'First' };
    const last = { id: 'last', type: 'text', text: 'Last' };
    const section = { id: 'info', type: 'product-info', heroBlocks: [first, last] };
    const onChange = vi.fn();
    render(<DesignerSectionEditor section={section} onChange={onChange} onBlur={vi.fn()}
      onBlockFocus={vi.fn()} blockInsertion={{ placement: 'before-specifications', afterId: 'first' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Newsletter signup', exact: true }));
    expect(onChange).toHaveBeenCalledWith('heroBlocks', [
      first, expect.objectContaining({ type: 'newsletter', productPlacement: 'before-specifications' }), last,
    ]);
  });

  it('inserts a product information preset bound to a product attribute', () => {
    const onChange = vi.fn();
    render(<DesignerSectionEditor section={{ id: 'info', type: 'product-info' }}
      onChange={onChange} onBlur={vi.fn()} onBlockFocus={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add block before variant options' }));
    expect(screen.getByRole('button', { name: 'Delivery information' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Care instructions' }));
    expect(onChange).toHaveBeenCalledWith('heroBlocks', [{
      id: expect.any(String), type: 'product-attribute', attributeName: 'Care instructions', text: 'Care instructions', productPlacement: 'before-options',
    }]);
  });

  it('shows only the section actions provided by the layout', () => {
    const section = { id: 'faq', type: 'faq' };
    const onDelete = vi.fn();
    const { rerender } = render(<DesignerSectionEditor section={section} onDelete={onDelete} />);

    expect(screen.queryByTitle('Duplicate')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Delete'));
    expect(onDelete).toHaveBeenCalledWith(section);

    rerender(<DesignerSectionEditor section={section} />);
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  it('offers "Customize existing content" and copies inherited blocks when section is uncustomized', () => {
    const section = { id: 'hero-1', type: 'hero-carousel', title: 'Main Hero' };
    const inheritedBlocks = [
      { eyebrow: 'Eyebrow 1', title: 'Default Slide 1', subtitle: 'Desc 1' },
      { eyebrow: 'Eyebrow 2', title: 'Default Slide 2', subtitle: 'Desc 2' },
    ];
    const onChange = vi.fn();

    render(
      <DesignerSectionEditor
        section={section}
        inheritedBlocks={inheritedBlocks}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/using default store content/i)).toBeInTheDocument();
    expect(screen.getByText(/2 items active/i)).toBeInTheDocument();

    const customizeBtn = screen.getByRole('button', { name: 'Customize existing content' });
    expect(customizeBtn).toBeInTheDocument();

    fireEvent.click(customizeBtn);

    expect(onChange).toHaveBeenCalledWith('slides', [
      { eyebrow: 'Eyebrow 1', title: 'Default Slide 1', subtitle: 'Desc 1' },
      { eyebrow: 'Eyebrow 2', title: 'Default Slide 2', subtitle: 'Desc 2' },
    ]);
  });

  it('renders "Reset to default content" and calls onChange with undefined when customized blocks exist', () => {
    const section = {
      id: 'hero-1',
      type: 'hero-carousel',
      title: 'Main Hero',
      slides: [{ title: 'Custom Slide 1' }],
    };
    const onChange = vi.fn();

    render(
      <DesignerSectionEditor
        section={section}
        inheritedBlocks={[]}
        onChange={onChange}
      />
    );

    const resetBtn = screen.getByRole('button', { name: 'Reset to default content' });
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);

    expect(onChange).toHaveBeenCalledWith('slides', undefined);
  });

  it('distinguishes explicitly empty content from default content and offers reset', () => {
    const section = {
      id: 'hero-1',
      type: 'hero-carousel',
      title: 'Main Hero',
      slides: [],
    };
    const onChange = vi.fn();

    render(
      <DesignerSectionEditor
        section={section}
        inheritedBlocks={[{ title: 'Inherited Slide' }]}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/No blocks in this section. This section will render empty on the storefront./i)).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: 'Reset to default content' });
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);

    expect(onChange).toHaveBeenCalledWith('slides', undefined);
  });

  it('labels section title as "Section Name" with helper text for hero-carousel', () => {
    const section = { id: 'hero-1', type: 'hero-carousel', title: 'Main Hero' };
    render(
      <DesignerSectionEditor
        section={section}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Section Name')).toHaveValue('Main Hero');
    expect(screen.getByText(/Name shown in the designer sidebar. Slide headings are configured under Slides below./i)).toBeInTheDocument();
  });
});

it('stores the sale label ID when a merchant selects a campaign', async () => {
  const onChange = vi.fn();
  const onBlur = vi.fn();
  render(<DesignerSectionEditor section={{ id: 'sale-row', type: 'product-row', source: 'sale' }} onChange={onChange} onBlur={onBlur} />);
  expect(screen.getByRole('button', { name: 'Content source' })).toHaveAttribute('aria-expanded', 'true');
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sale label' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Summer Sale' }));
  expect(onChange).toHaveBeenCalledWith('saleLabel', 'summer-sale');
  expect(onBlur).toHaveBeenCalled();
});

it('shows visibility and layout controls immediately for a selected Product Row', () => {
  const onChange = vi.fn();
  const onBlur = vi.fn();
  render(<DesignerSectionEditor section={{ id: 'row', type: 'product-row', enabled: true }}
    onDelete={vi.fn()} onChange={onChange} onBlur={onBlur} />);
  expect(screen.getByRole('button', { name: 'Layout' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('combobox', { name: 'Product layout' })).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Desktop columns' })).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Tablet columns' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Smart Preset' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch', { name: 'Show section' }));
  expect(onChange).toHaveBeenCalledWith('enabled', false);
  fireEvent.click(screen.getByRole('switch', { name: 'Hide on mobile' }));
  expect(onChange).toHaveBeenCalledWith('hideOnMobile', true);
  expect(onBlur).toHaveBeenCalledTimes(2);
});

it('allows a one-column mobile grid and hides grid columns for carousel rows', () => {
  const onChange = vi.fn();
  const onBlur = vi.fn();
  const row = { id: 'responsive', type: 'product-row', variant: 'grid' };
  const { rerender } = render(<DesignerSectionEditor section={row} onChange={onChange} onBlur={onBlur} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Mobile columns' }));
  fireEvent.click(screen.getByRole('option', { name: '1' }));
  expect(onChange).toHaveBeenCalledWith('columnsMobile', 1);
  expect(onBlur).toHaveBeenCalled();
  rerender(<DesignerSectionEditor section={{ ...row, variant: 'carousel' }} onChange={onChange} onBlur={onBlur} />);
  expect(screen.queryByRole('combobox', { name: 'Mobile columns' })).not.toBeInTheDocument();
});

it('accepts zero spacing and ignores out-of-range Product Row spacing', () => {
  const onChange = vi.fn();
  render(<DesignerSectionEditor section={{ id: 'grid', type: 'product-row', variant: 'grid' }} onChange={onChange} onBlur={vi.fn()} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Horizontal gap' }), { target: { value: '0' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Vertical gap' }), { target: { value: '65' } });
  expect(onChange.mock.calls).toEqual([['horizontalGap', 0]]);
});

it('offers mobile swiping for grids and keeps their tablet and desktop column controls', () => {
  const onChange = vi.fn();
  const row = { id: 'mobile', type: 'product-row', variant: 'grid' };
  const { rerender } = render(<DesignerSectionEditor section={row} onChange={onChange} onBlur={vi.fn()} />);
  fireEvent.click(screen.getByRole('switch', { name: 'Carousel on mobile' }));
  expect(onChange).toHaveBeenCalledWith('mobileCarousel', true);
  rerender(<DesignerSectionEditor section={{ ...row, mobileCarousel: true }} onChange={onChange} onBlur={vi.fn()} />);
  expect(screen.queryByRole('combobox', { name: 'Mobile columns' })).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Tablet columns' })).toBeVisible();
});

it('names the selected block and offers a way back to the section settings', () => {
  const onBackToSection = vi.fn();
  render(<DesignerSectionEditor section={{ id: 'hero', type: 'hero-carousel', title: 'Main Hero', slides: [{ title: 'Welcome' }] }}
    activeBlockKey="slides" activeBlockIndex={0} activeBlockLabel="Welcome slide"
    onBackToSection={onBackToSection} onDelete={vi.fn()} onChange={vi.fn()} onBlur={vi.fn()} />);
  expect(screen.getByText('Welcome slide')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to section settings' }));
  expect(onBackToSection).toHaveBeenCalledOnce();
});
