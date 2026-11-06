import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CategoryAttributesDialog from '../../components/admin/CategoryAttributesDialog';
import { NotificationProvider } from '../../context/NotificationContext';
import attributeService from '../../services/attributeService';

vi.mock('../../services/attributeService', () => ({ default: { getCategoryAttributes: vi.fn(), getAttributes: vi.fn(), linkAttributeToCategory: vi.fn(), unlinkAttributeFromCategory: vi.fn() } }));
const inherited = { id: 'height', name: 'Height', values: [], sources: [{ id: 'parent', name: 'Vegetables', isDirect: false }] };
const tree = (props = {}) => <NotificationProvider><CategoryAttributesDialog open onClose={() => {}} categoryId="child" categoryName="Carrots" {...props} /></NotificationProvider>;
beforeEach(() => {
  vi.resetAllMocks();
  attributeService.getAttributes.mockResolvedValue({ data: { data: { rows: [] } } });
});

describe('category attribute inheritance dialog', () => {
  it('shows inherited attributes and their parent category', async () => {
    attributeService.getCategoryAttributes.mockResolvedValue({ data: { data: [inherited] } });
    render(tree());
    expect(await screen.findByText('Height')).toBeInTheDocument();
    expect(screen.getByText('From Vegetables')).toBeInTheDocument();
    expect(attributeService.getCategoryAttributes).toHaveBeenCalledWith(['child'], true);
  });

  it('shows a retry after failure instead of claiming there are no linked attributes', async () => {
    attributeService.getCategoryAttributes.mockRejectedValueOnce(new Error('Connection lost.')).mockResolvedValueOnce({ data: { data: [inherited] } });
    render(tree());
    expect(await screen.findByText(/Category attributes could not be loaded.*Connection lost\./)).toBeInTheDocument();
    expect(screen.queryByText('No attributes linked to this category yet.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry category attributes' }));
    expect(await screen.findByText('From Vegetables')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Category attributes could not be loaded/)).not.toBeInTheDocument());
  });
});
