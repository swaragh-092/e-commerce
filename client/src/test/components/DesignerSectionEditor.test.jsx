import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignerSectionEditor from '../../components/admin/themes/designer/DesignerSectionEditor';

vi.mock('../../components/common/MediaPicker', () => ({ default: () => <div data-testid="media-picker" /> }));

describe('DesignerSectionEditor BlockListEditor', () => {
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
