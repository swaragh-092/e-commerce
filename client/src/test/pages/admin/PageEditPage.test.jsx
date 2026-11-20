import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../../context/NotificationContext';
import PageEditPage from '../../../pages/admin/PageEditPage';
import PageService from '../../../services/pageService';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));
vi.mock('../../../components/common/MediaPicker', () => ({ default: () => null }));
vi.mock('../../../services/pageService', () => ({
  default: { adminGetPageById: vi.fn(), adminUpdatePage: vi.fn() },
}));

const renderEditor = () => render(
  <MemoryRouter initialEntries={['/admin/pages/privacy/edit']}>
    <NotificationProvider>
      <Routes>
        <Route path="/admin/pages/:id/edit" element={<PageEditPage />} />
      </Routes>
    </NotificationProvider>
  </MemoryRouter>,
);

const openHtmlTab = () => {
  fireEvent.click(screen.getByRole('tab', { name: 'HTML Code' }));
  return screen.getByRole('textbox', { name: 'Raw HTML Content' });
};

it('keeps saved HTML after reloading and switching through the visual editor', async () => {
  const html = '<section class="policy">\n  <p>How we handle your information.</p>\n</section>';
  let savedPage = { id: 'privacy', slug: 'privacy-policy', title: 'Privacy Policy', content: '<p>Old text</p>' };
  PageService.adminGetPageById.mockImplementation(async () => ({ data: savedPage }));
  PageService.adminUpdatePage.mockImplementation(async (_, changes) => {
    savedPage = { ...savedPage, ...changes };
    return { data: savedPage };
  });

  const editor = renderEditor();
  await screen.findByRole('heading', { name: 'Edit: Privacy Policy' });
  fireEvent.change(openHtmlTab(), { target: { value: html } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Page' }));
  await waitFor(() => expect(PageService.adminUpdatePage).toHaveBeenCalledWith(
    'privacy', expect.objectContaining({ content: html }),
  ));
  await screen.findByText('Page updated successfully.');

  editor.unmount();
  renderEditor();
  await screen.findByRole('heading', { name: 'Edit: Privacy Policy' });
  expect(openHtmlTab()).toHaveValue(html);

  fireEvent.click(screen.getByRole('tab', { name: 'Visual' }));
  expect(screen.getByText('How we handle your information.')).toBeInTheDocument();
  expect(openHtmlTab()).toHaveValue(html);
});
