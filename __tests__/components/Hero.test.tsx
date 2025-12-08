/**
 * Hero Component Tests
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import Hero from '@/components/Hero';

// Mock SettingsProvider
vi.mock('@/components/SettingsProvider', () => ({
  useSettings: vi.fn(),
}));

import { useSettings } from '@/components/SettingsProvider';

const mockedUseSettings = useSettings as Mock;

describe('Hero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseSettings.mockReturnValue({
      family_name: 'Milanese Family',
      site_tagline: 'Preserving our heritage',
    });
  });

  it('renders title from settings when no prop provided', () => {
    render(<Hero />);

    expect(screen.getByText('Milanese Family')).toBeInTheDocument();
  });

  it('renders subtitle from settings when no prop provided', () => {
    render(<Hero />);

    expect(screen.getByText('Preserving our heritage')).toBeInTheDocument();
  });

  it('renders custom title when prop provided', () => {
    render(<Hero title="Custom Title" />);

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.queryByText('Milanese Family')).not.toBeInTheDocument();
  });

  it('renders custom subtitle when prop provided', () => {
    render(<Hero subtitle="Custom Subtitle" />);

    expect(screen.getByText('Custom Subtitle')).toBeInTheDocument();
    expect(
      screen.queryByText('Preserving our heritage'),
    ).not.toBeInTheDocument();
  });

  it('renders both custom props when both provided', () => {
    render(<Hero title="My Title" subtitle="My Subtitle" />);

    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My Subtitle')).toBeInTheDocument();
  });

  it('renders h1 with gradient-text class', () => {
    render(<Hero />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.querySelector('.gradient-text')).toBeInTheDocument();
  });
});
