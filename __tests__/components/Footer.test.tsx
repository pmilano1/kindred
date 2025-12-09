/**
 * Footer Component Tests
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import Footer from '@/components/Footer';

// Mock SettingsProvider
vi.mock('@/components/SettingsProvider', () => ({
  useSettings: vi.fn(),
}));

import { useSettings } from '@/components/SettingsProvider';

const mockedUseSettings = useSettings as Mock;

describe('Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders copyright with family name only', () => {
    mockedUseSettings.mockReturnValue({
      family_name: 'Milanese',
      site_name: 'Family Tree',
      footer_text: null,
      admin_email: null,
    });

    render(<Footer />);

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(`© ${currentYear} Milanese`)).toBeInTheDocument();
  });

  it('renders footer text when provided', () => {
    mockedUseSettings.mockReturnValue({
      family_name: 'Test',
      site_name: 'Tree',
      footer_text: 'Preserving our heritage for future generations',
      admin_email: null,
    });

    render(<Footer />);

    expect(
      screen.getByText('Preserving our heritage for future generations'),
    ).toBeInTheDocument();
  });

  it('does not render footer text when not provided', () => {
    mockedUseSettings.mockReturnValue({
      family_name: 'Test',
      site_name: 'Tree',
      footer_text: null,
      admin_email: null,
    });

    render(<Footer />);

    // Only copyright should be present
    const footerElement = screen.getByRole('contentinfo');
    expect(footerElement.querySelectorAll('p').length).toBe(1);
  });

  it('renders admin email as mailto link when provided', () => {
    mockedUseSettings.mockReturnValue({
      family_name: 'Test',
      site_name: 'Tree',
      footer_text: null,
      admin_email: 'admin@example.com',
    });

    render(<Footer />);

    const emailLink = screen.getByRole('link', { name: 'admin@example.com' });
    expect(emailLink).toHaveAttribute('href', 'mailto:admin@example.com');
  });

  it('does not render admin email when not provided', () => {
    mockedUseSettings.mockReturnValue({
      family_name: 'Test',
      site_name: 'Tree',
      footer_text: null,
      admin_email: null,
    });

    render(<Footer />);

    expect(screen.queryByText(/Contact:/)).not.toBeInTheDocument();
  });

  it('renders all elements when all settings are provided', () => {
    mockedUseSettings.mockReturnValue({
      family_name: 'Milanese',
      site_name: 'Family History',
      footer_text: 'Generations of stories',
      admin_email: 'contact@milanese.life',
    });

    render(<Footer />);

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(`© ${currentYear} Milanese`)).toBeInTheDocument();
    expect(screen.getByText('Generations of stories')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'contact@milanese.life' }),
    ).toBeInTheDocument();
  });

  it('renders Kindred link to GitHub', () => {
    mockedUseSettings.mockReturnValue({
      family_name: 'Test',
      site_name: 'Tree',
      footer_text: null,
      admin_email: null,
    });

    render(<Footer />);

    const kindredLink = screen.getByRole('link', {
      name: /Powered by.*Kindred/i,
    });
    expect(kindredLink).toHaveAttribute(
      'href',
      'https://github.com/pmilano1/kindred',
    );
    expect(kindredLink).toHaveAttribute('target', '_blank');
    expect(kindredLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
