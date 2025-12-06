/**
 * PersonCard Component Tests
 */
import { render, screen } from '@testing-library/react';
import PersonCard from '@/components/PersonCard';
import { Person } from '@/lib/types';

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

const createMockPerson = (overrides: Partial<Person> = {}): Person => ({
  id: 'test-person-id',
  familysearch_id: null,
  name_given: 'John',
  name_surname: 'Doe',
  name_full: 'John Doe',
  sex: 'M',
  birth_date: null,
  birth_year: 1950,
  birth_place: 'New York, NY',
  death_date: null,
  death_year: 2020,
  death_place: 'Los Angeles, CA',
  burial_date: null,
  burial_place: 'Rose Hills Cemetery',
  christening_date: null,
  christening_place: null,
  immigration_date: null,
  immigration_place: null,
  naturalization_date: null,
  naturalization_place: null,
  religion: null,
  description: null,
  living: false,
  source_count: 0,
  research_status: null,
  research_priority: null,
  last_researched: null,
  is_notable: false,
  notable_description: null,
  ...overrides,
});

describe('PersonCard', () => {
  it('renders person name with link', () => {
    const person = createMockPerson();
    render(<PersonCard person={person} />);
    
    const link = screen.getByRole('link', { name: 'John Doe' });
    expect(link).toHaveAttribute('href', '/person/test-person-id');
  });

  it('shows Male badge for male person', () => {
    const person = createMockPerson({ sex: 'M' });
    render(<PersonCard person={person} />);
    
    expect(screen.getByText('Male')).toBeInTheDocument();
  });

  it('shows Female badge for female person', () => {
    const person = createMockPerson({ sex: 'F', name_full: 'Jane Doe' });
    render(<PersonCard person={person} />);
    
    expect(screen.getByText('Female')).toBeInTheDocument();
  });

  it('shows Living badge for living person', () => {
    const person = createMockPerson({ living: true, death_year: null });
    render(<PersonCard person={person} />);
    
    expect(screen.getByText('Living')).toBeInTheDocument();
  });

  it('does not show Living badge for deceased person', () => {
    const person = createMockPerson({ living: false });
    render(<PersonCard person={person} />);
    
    expect(screen.queryByText('Living')).not.toBeInTheDocument();
  });

  describe('with showDetails=true', () => {
    it('shows birth information', () => {
      const person = createMockPerson();
      render(<PersonCard person={person} showDetails />);
      
      expect(screen.getByText(/Born:/)).toBeInTheDocument();
      expect(screen.getByText(/1950/)).toBeInTheDocument();
    });

    it('shows death information for deceased', () => {
      const person = createMockPerson();
      render(<PersonCard person={person} showDetails />);
      
      expect(screen.getByText(/Died:/)).toBeInTheDocument();
      expect(screen.getByText(/2020/)).toBeInTheDocument();
    });

    it('does not show death for living person', () => {
      const person = createMockPerson({ living: true, death_year: null });
      render(<PersonCard person={person} showDetails />);
      
      expect(screen.queryByText(/Died:/)).not.toBeInTheDocument();
    });

    it('shows burial place', () => {
      const person = createMockPerson();
      render(<PersonCard person={person} showDetails />);
      
      expect(screen.getByText(/Burial:/)).toBeInTheDocument();
      expect(screen.getByText(/Rose Hills Cemetery/)).toBeInTheDocument();
    });
  });

  describe('with showDetails=false (default)', () => {
    it('does not show birth/death details', () => {
      const person = createMockPerson();
      render(<PersonCard person={person} />);
      
      expect(screen.queryByText(/Born:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Died:/)).not.toBeInTheDocument();
    });
  });
});

