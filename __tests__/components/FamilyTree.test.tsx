/**
 * Tests for FamilyTree component
 * Ensures tree renders correctly with Apollo GraphQL
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { gql } from '@apollo/client/core';
import FamilyTree from '@/components/FamilyTree';

// The query used by FamilyTree component
const TREE_DATA_QUERY = gql`
  query TreeData($rootPersonId: ID!) {
    peopleList(limit: 10000) {
      id
      name_full
      sex
      birth_year
      death_year
      birth_place
      death_place
      living
      familysearch_id
      is_notable
      research_status
      research_priority
      last_researched
      coatOfArms
    }
    families {
      id
      husband_id
      wife_id
      marriage_year
      marriage_place
      children { id }
    }
    person(id: $rootPersonId) {
      notableRelatives {
        person { id name_full }
        generation
      }
    }
  }
`;

const mockQueryResult = {
  peopleList: [
    { id: 'root', name_full: 'Peter Milanese', sex: 'M', birth_year: 1973, death_year: null, birth_place: 'NY', death_place: null, living: true, familysearch_id: null, is_notable: false, research_status: null, research_priority: null, last_researched: null, coatOfArms: null },
    { id: 'father', name_full: 'Father Name', sex: 'M', birth_year: 1945, death_year: 2020, birth_place: 'NY', death_place: 'NY', living: false, familysearch_id: null, is_notable: false, research_status: null, research_priority: null, last_researched: null, coatOfArms: null },
  ],
  families: [
    { id: 'fam1', husband_id: 'father', wife_id: null, marriage_year: null, marriage_place: null, children: [{ id: 'root' }] },
  ],
  person: {
    notableRelatives: [],
  },
};

const mocks = [
  {
    request: {
      query: TREE_DATA_QUERY,
      variables: { rootPersonId: 'root' },
    },
    result: {
      data: mockQueryResult,
    },
  },
];

const renderWithApollo = (ui: React.ReactElement, apolloMocks = mocks) => {
  return render(
    <MockedProvider mocks={apolloMocks} addTypename={false}>
      {ui}
    </MockedProvider>
  );
};

describe('FamilyTree Component', () => {
  it('renders loading state initially', () => {
    renderWithApollo(
      <FamilyTree
        rootPersonId="root"
        showAncestors={true}
        onPersonClick={jest.fn()}
        onTileClick={jest.fn()}
      />
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders SVG container after data loads', async () => {
    const { container } = renderWithApollo(
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

  it('shows loading initially then renders tree', async () => {
    renderWithApollo(
      <FamilyTree
        rootPersonId="root"
        showAncestors={true}
        onPersonClick={jest.fn()}
        onTileClick={jest.fn()}
      />
    );

    // Initially shows loading
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // After data loads, loading disappears
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });
});

