/**
 * StatsCard Component Tests
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatsCard from '@/components/StatsCard';

describe('StatsCard', () => {
  it('renders label and value', () => {
    render(<StatsCard label="Total People" value={500} />);

    expect(screen.getByText('Total People')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<StatsCard label="Status" value="Active" />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<StatsCard label="Families" value={200} icon="👨‍👩‍👧‍👦" />);

    expect(screen.getByText('👨‍👩‍👧‍👦')).toBeInTheDocument();
  });

  it('does not render icon container when icon not provided', () => {
    const { container } = render(<StatsCard label="Test" value={0} />);

    // Should only have stat-number and stat-label divs
    const cardContent = container.querySelector('.stat-card');
    expect(cardContent?.children.length).toBe(2);
  });

  it('renders with correct CSS classes', () => {
    const { container } = render(<StatsCard label="Test" value={100} />);

    expect(container.querySelector('.card')).toBeInTheDocument();
    expect(container.querySelector('.stat-card')).toBeInTheDocument();
    expect(container.querySelector('.stat-number')).toBeInTheDocument();
    expect(container.querySelector('.stat-label')).toBeInTheDocument();
  });

  it('renders zero value correctly', () => {
    render(<StatsCard label="Empty" value={0} />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders large numbers', () => {
    render(<StatsCard label="Big Number" value={1000000} />);

    expect(screen.getByText('1000000')).toBeInTheDocument();
  });
});
