/**
 * TreeLink Component Tests
 */
import { render, screen, fireEvent } from '@testing-library/react';
import TreeLink from '@/components/TreeLink';

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, className, title, onClick }: { 
    children: React.ReactNode; 
    href: string; 
    className?: string;
    title?: string;
    onClick?: (e: React.MouseEvent) => void;
  }) {
    return <a href={href} className={className} title={title} onClick={onClick}>{children}</a>;
  };
});

describe('TreeLink', () => {
  it('renders tree emoji link', () => {
    render(<TreeLink personId="person-123" />);
    
    expect(screen.getByText('🌳')).toBeInTheDocument();
  });

  it('links to tree page with person and view params', () => {
    render(<TreeLink personId="person-123" />);
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/tree?person=person-123&view=ancestors');
  });

  it('has View in Tree title', () => {
    render(<TreeLink personId="test-id" />);
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('title', 'View in Tree');
  });

  it('applies custom className', () => {
    render(<TreeLink personId="test-id" className="custom-class" />);
    
    const link = screen.getByRole('link');
    expect(link.className).toContain('custom-class');
  });

  it('has default styling classes', () => {
    render(<TreeLink personId="test-id" />);
    
    const link = screen.getByRole('link');
    expect(link.className).toContain('text-gray-400');
    expect(link.className).toContain('hover:text-green-600');
  });

  it('stops event propagation on click', () => {
    const parentClickHandler = jest.fn();
    
    render(
      <div onClick={parentClickHandler}>
        <TreeLink personId="test-id" />
      </div>
    );
    
    const link = screen.getByRole('link');
    fireEvent.click(link);
    
    expect(parentClickHandler).not.toHaveBeenCalled();
  });
});

