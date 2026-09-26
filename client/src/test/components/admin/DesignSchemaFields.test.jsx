import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesignSchemaFields } from '../../../components/admin/themes/designer/DesignSchemaFields';
import { getDesignComponentControlSchema } from '../../../utils/designRegistry';

describe('DesignSchemaFields', () => {
  const schema = getDesignComponentControlSchema('announcementBar');

  it('shows conditional announcement fields only when enabled', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <DesignSchemaFields schema={schema} value={{ enabled: false }} onChange={onChange} />
    );

    expect(screen.getByRole('checkbox', { name: 'Show announcement bar' })).not.toBeChecked();
    expect(screen.queryByRole('textbox', { name: 'Message text' })).not.toBeInTheDocument();

    rerender(
      <DesignSchemaFields schema={schema} value={{ enabled: 'true' }} onChange={onChange} />
    );

    expect(screen.getByRole('textbox', { name: 'Message text' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Link URL' })).toBeVisible();
  });

  it('enforces the schema text limit and reports the current count', () => {
    const onChange = vi.fn();
    render(
      <DesignSchemaFields schema={schema} value={{ enabled: true, text: '' }} onChange={onChange} />
    );

    const message = screen.getByRole('textbox', { name: 'Message text' });
    expect(message).toHaveAttribute('maxlength', '200');
    expect(screen.getByText('0/200')).toBeInTheDocument();

    fireEvent.change(message, { target: { value: 'A'.repeat(230) } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'A'.repeat(200) }));
  });
});
