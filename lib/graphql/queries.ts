import { gql } from '@apollo/client';

// =====================================================
// FRAGMENTS - Reusable field selections
// =====================================================

export const SOURCE_FIELDS = gql`
  fragment SourceFields on Source {
    id
    person_id
    source_type
    source_name
    source_url
    action
    content
    confidence
    validated
    validated_date
    created_at
  }
`;

export const PERSON_BASIC_FIELDS = gql`
  fragment PersonBasicFields on Person {
    id
    name_full
    name_given
    name_surname
    sex
    birth_year
    birth_date
    birth_place
    death_year
    death_date
    death_place
    burial_date
    burial_place
    christening_date
    christening_place
    immigration_date
    immigration_place
    naturalization_date
    naturalization_place
    religion
    familysearch_id
    living
    description
    source_count
    research_status
    research_priority
    last_researched
  }
`;

// =====================================================
// QUERIES
// =====================================================

// Get person with sources (for ResearchPanel)
export const GET_PERSON_SOURCES = gql`
  ${SOURCE_FIELDS}
  query GetPersonSources($id: ID!) {
    person(id: $id) {
      id
      name_full
      research_status
      research_priority
      sources {
        ...SourceFields
      }
    }
  }
`;

// Get full person details with relationships
export const GET_PERSON = gql`
  ${PERSON_BASIC_FIELDS}
  ${SOURCE_FIELDS}
  query GetPerson($id: ID!) {
    person(id: $id) {
      ...PersonBasicFields
      parents {
        ...PersonBasicFields
      }
      siblings {
        ...PersonBasicFields
      }
      spouses {
        ...PersonBasicFields
      }
      children {
        ...PersonBasicFields
      }
      families {
        id
        husband_id
        wife_id
        marriage_date
        marriage_year
        marriage_place
        husband {
          ...PersonBasicFields
        }
        wife {
          ...PersonBasicFields
        }
        children {
          ...PersonBasicFields
        }
      }
      sources {
        ...SourceFields
      }
      residences {
        id
        residence_date
        residence_year
        residence_place
      }
      occupations {
        id
        title
        occupation_date
        occupation_place
      }
      events {
        id
        event_type
        event_date
        event_place
      }
      facts {
        id
        fact_type
        fact_value
      }
    }
  }
`;

// Search people
export const SEARCH_PEOPLE = gql`
  ${PERSON_BASIC_FIELDS}
  query SearchPeople($query: String!, $first: Int, $after: String) {
    search(query: $query, first: $first, after: $after) {
      edges {
        node {
          ...PersonBasicFields
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
        totalCount
      }
    }
  }
`;

// Get paginated people list
export const GET_PEOPLE = gql`
  ${PERSON_BASIC_FIELDS}
  query GetPeople($first: Int, $after: String) {
    people(first: $first, after: $after) {
      edges {
        node {
          ...PersonBasicFields
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
        totalCount
      }
    }
  }
`;

// Get stats
export const GET_STATS = gql`
  query GetStats {
    stats {
      total_people
      total_families
      living_count
      male_count
      female_count
      earliest_birth
      latest_birth
      with_familysearch_id
    }
  }
`;

// Get research queue
export const GET_RESEARCH_QUEUE = gql`
  ${PERSON_BASIC_FIELDS}
  query GetResearchQueue($limit: Int) {
    researchQueue(limit: $limit) {
      ...PersonBasicFields
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

export const ADD_SOURCE = gql`
  ${SOURCE_FIELDS}
  mutation AddSource($personId: ID!, $input: ResearchLogInput!) {
    addResearchLog(personId: $personId, input: $input) {
      ...SourceFields
    }
  }
`;

export const UPDATE_RESEARCH_STATUS = gql`
  mutation UpdateResearchStatus($personId: ID!, $status: String!) {
    updateResearchStatus(personId: $personId, status: $status) {
      id
      research_status
    }
  }
`;

export const UPDATE_RESEARCH_PRIORITY = gql`
  mutation UpdateResearchPriority($personId: ID!, $priority: Int!) {
    updateResearchPriority(personId: $personId, priority: $priority) {
      id
      research_priority
    }
  }
`;

export const UPDATE_PERSON = gql`
  ${PERSON_BASIC_FIELDS}
  mutation UpdatePerson($id: ID!, $input: PersonInput!) {
    updatePerson(id: $id, input: $input) {
      ...PersonBasicFields
    }
  }
`;

