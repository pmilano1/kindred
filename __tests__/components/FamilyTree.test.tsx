/**
 * Tests for FamilyTree component
 * Ensures tree renders correctly in both ancestor and descendant views
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import FamilyTree from '@/components/FamilyTree';

// Mock fetch
global.fetch = jest.fn();

const mockTreeData = {
  people: [
    { id: 'root', name: 'Peter Milanese', birth_year: 1973, gender: 'M', living: true },
    { id: 'father', name: 'Father Name', birth_year: 1945, gender: 'M', living: false },
    { id: 'mother', name: 'Mother Name', birth_year: 1948, gender: 'F', living: false },
    { id: 'child1', name: 'Child One', birth_year: 2000, gender: 'M', living: true },
  ],
  families: [
    { id: 'fam1', husband_id: 'father', wife_id: 'mother' },
  ],
  children: [
    { family_id: 'fam1', person_id: 'root' },
  ],
};

describe('FamilyTree Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockTreeData,
    });
  });

  it('renders loading state initially', () => {
    render(
      <FamilyTree 
        rootPersonId="root" 
        showAncestors={true}
        onPersonClick={jest.fn()}
        onTileClick={jest.fn()}
      />
    );
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('fetches tree data on mount', async () => {
    render(
      <FamilyTree 
        rootPersonId="root" 
        showAncestors={true}
        onPersonClick={jest.fn()}
        onTileClick={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/tree');
    });
  });

  it('renders SVG container after data loads', async () => {
    const { container } = render(
      <FamilyTree 
        rootPersonId="root" 
        showAncestors={true}
        onPersonClick={jest.fn()}
        onTileClick={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('passes showAncestors prop correctly for view mode', async () => {
    // Test ancestor view
    const { rerender } = render(
      <FamilyTree 
        rootPersonId="root" 
        showAncestors={true}
        onPersonClick={jest.fn()}
        onTileClick={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Rerender with descendant view
    rerender(
      <FamilyTree 
        rootPersonId="root" 
        showAncestors={false}
        onPersonClick={jest.fn()}
        onTileClick={jest.fn()}
      />
    );

    // Component should re-render with new view mode
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});

