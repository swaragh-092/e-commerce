import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ContentGridSection from '../../../components/storefront/sections/ContentGridSection';

const logoSection = (link) => ({
  type: 'logo-cloud',
  title: 'Partners',
  items: [{ title: 'Acme', image: 'https://example.com/logo.png', link }],
});

const testimonialSection = (variant) => ({
  type: 'testimonials',
  title: 'Customer stories',
  variant,
  items: [
    { title: 'Great fit', text: 'The product exceeded expectations.', author: 'Alex', role: 'Customer' },
    { title: 'Fast delivery', text: 'It arrived sooner than expected.', author: 'Sam' },
  ],
});

describe('ContentGridSection variants and links', () => {
  it('renders internal Logo Cloud links as app links', () => {
    render(<MemoryRouter><ContentGridSection section={logoSection('/brands/acme')} kind="logo" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Acme' })).toHaveAttribute('href', '/brands/acme');
  });

  it('opens external Logo Cloud links safely in a new tab', () => {
    render(<MemoryRouter><ContentGridSection section={logoSection('https://acme.example')} kind="logo" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Acme' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Acme' })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('normalizes protocol-relative logo links to secure HTTPS links', () => {
    render(<MemoryRouter><ContentGridSection section={logoSection('//acme.example')} kind="logo" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Acme' })).toHaveAttribute('href', 'https://acme.example');
  });

  it('does not render unsafe link schemes as clickable links', () => {
    render(<MemoryRouter><ContentGridSection section={logoSection('javascript:alert(1)')} kind="logo" /></MemoryRouter>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not make a logo link navigate while editing the preview', () => {
    render(<MemoryRouter><ContentGridSection section={logoSection('/brands/acme')} kind="logo" mode="preview" /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'Acme' })).not.toBeInTheDocument();
  });

  it('renders Quote Wall testimonials as quoted, multi-column content', () => {
    render(<ContentGridSection section={testimonialSection('quote-wall')} />);
    expect(screen.getAllByRole('blockquote')).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'Customer quotes' })).toBeInTheDocument();
  });

  it('keeps Quote Wall text editable in the Designer canvas', () => {
    const section = { ...testimonialSection('quote-wall'), id: 'testimonials' };
    render(<ContentGridSection section={section} mode="preview" onInlineFieldCommit={vi.fn()} />);
    expect(screen.getByText('The product exceeded expectations.')).toHaveAttribute('contenteditable', 'true');
  });

  it('omits carousel controls for a single testimonial', () => {
    const section = testimonialSection('carousel');
    render(<ContentGridSection section={{ ...section, items: section.items.slice(0, 1) }} />);
    expect(screen.queryByRole('button', { name: 'Next testimonials' })).not.toBeInTheDocument();
  });

  it('renders the default Cards layout as a grid', () => {
    const { container } = render(<ContentGridSection section={testimonialSection('cards')} />);
    expect(container.querySelector('.MuiGrid-container')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Customer testimonials' })).not.toBeInTheDocument();
  });

  it('renders a scrollable carousel with working arrow controls', () => {
    const scrollBy = vi.fn();
    const original = HTMLElement.prototype.scrollBy;
    HTMLElement.prototype.scrollBy = scrollBy;
    try {
      render(<ContentGridSection section={testimonialSection('carousel')} />);
      const carousel = screen.getByRole('region', { name: 'Customer testimonials' });
      Object.defineProperty(carousel, 'clientWidth', { configurable: true, value: 1000 });
      expect(carousel).toHaveStyle({ overflowX: 'auto' });
      fireEvent.click(screen.getByRole('button', { name: 'Next testimonials' }));
      expect(scrollBy).toHaveBeenCalledWith({ left: 1000, behavior: 'smooth' });
    } finally {
      if (original) HTMLElement.prototype.scrollBy = original;
      else delete HTMLElement.prototype.scrollBy;
    }
  });
});
