import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaticPageView from '../../../pages/storefront/StaticPageView';
import PageService from '../../../services/pageService';

vi.mock('../../../services/pageService', () => ({
  default: {
    getPageBySlug: vi.fn(),
  },
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter
        initialEntries={['/pages/about']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/pages/:slug" element={<StaticPageView />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );

describe('StaticPageView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
  });

  it('sanitizes CMS HTML before rendering it', async () => {
    PageService.getPageBySlug.mockResolvedValue({
      data: {
        title: 'About',
        content: '<p>Safe copy</p><img src="x" onerror="window.__xss = true" /><script>alert("xss")</script>',
      },
    });

    const { container } = renderPage();

    await screen.findByText('Safe copy');
    await waitFor(() => expect(PageService.getPageBySlug).toHaveBeenCalledWith('about'));

    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(container.querySelector('img')).not.toHaveAttribute('onerror');
  });
});
