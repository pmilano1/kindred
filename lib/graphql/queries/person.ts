import { gql } from '@apollo/client';
import {
  PERSON_CARD_FIELDS,
  PERSON_FULL_FIELDS,
  PERSON_SEARCH_FIELDS,
  SOURCE_FIELDS,
} from './fragments';

// =====================================================
// PERSON QUERIES
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

// Get full person details with relationships (detail page)
export const GET_PERSON = gql`
  ${PERSON_FULL_FIELDS}
  ${PERSON_CARD_FIELDS}
  ${SOURCE_FIELDS}
  query GetPerson($id: ID!) {
    person(id: $id) {
      ...PersonFullFields
      parents {
        ...PersonCardFields
      }
      siblings {
        ...PersonCardFields
      }
      spouses {
        ...PersonCardFields
      }
      children {
        ...PersonCardFields
      }
      families {
        id
        husband_id
        wife_id
        marriage_date
        marriage_year
        marriage_place
        husband {
          ...PersonCardFields
        }
        wife {
          ...PersonCardFields
        }
        children {
          ...PersonCardFields
        }
      }
      sources {
        ...SourceFields
      }
      lifeEvents {
        id
        event_type
        event_date
        event_year
        event_place
        event_value
      }
      facts {
        id
        fact_type
        fact_value
      }
      media {
        id
        filename
        original_filename
        mime_type
        media_type
        caption
        url
      }
    }
  }
`;

// Search people - minimal fields for list
export const SEARCH_PEOPLE = gql`
  ${PERSON_SEARCH_FIELDS}
  query SearchPeople($query: String!, $first: Int, $after: String) {
    search(query: $query, first: $first, after: $after) {
      edges {
        node {
          ...PersonSearchFields
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

// Get paginated people list - for people page cards
export const GET_PEOPLE = gql`
  ${PERSON_CARD_FIELDS}
  query GetPeople($first: Int, $after: String) {
    people(first: $first, after: $after) {
      edges {
        node {
          ...PersonCardFields
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

// Get people list (legacy offset-based)
export const GET_PEOPLE_LIST = gql`
  ${PERSON_CARD_FIELDS}
  query GetPeopleList($limit: Int, $offset: Int) {
    peopleList(limit: $limit, offset: $offset) {
      ...PersonCardFields
    }
  }
`;

// Get recent people
export const GET_RECENT_PEOPLE = gql`
  ${PERSON_CARD_FIELDS}
  query GetRecentPeople($limit: Int) {
    recentPeople(limit: $limit) {
      ...PersonCardFields
    }
  }
`;

// Get notable people
export const GET_NOTABLE_PEOPLE = gql`
  ${PERSON_CARD_FIELDS}
  query GetNotablePeople {
    notablePeople {
      ...PersonCardFields
      notable_description
    }
  }
`;

// =====================================================
// PERSON MUTATIONS
// =====================================================

export const CREATE_PERSON = gql`
  ${PERSON_FULL_FIELDS}
  mutation CreatePerson($input: PersonInput!) {
    createPerson(input: $input) {
      ...PersonFullFields
    }
  }
`;

export const UPDATE_PERSON = gql`
  ${PERSON_FULL_FIELDS}
  mutation UpdatePerson($id: ID!, $input: PersonInput!) {
    updatePerson(id: $id, input: $input) {
      ...PersonFullFields
    }
  }
`;

export const DELETE_PERSON = gql`
  mutation DeletePerson($id: ID!) {
    deletePerson(id: $id)
  }
`;

export const UPDATE_NOTABLE_STATUS = gql`
  mutation UpdateNotableStatus($id: ID!, $isNotable: Boolean!, $notableDescription: String) {
    updatePerson(id: $id, input: { is_notable: $isNotable, notable_description: $notableDescription }) {
      id
      is_notable
      notable_description
    }
  }
`;

// =====================================================
// LIFE EVENT MUTATIONS
// =====================================================

export const ADD_LIFE_EVENT = gql`
  mutation AddLifeEvent($personId: ID!, $input: LifeEventInput!) {
    addLifeEvent(personId: $personId, input: $input) {
      id
      person_id
      event_type
      event_date
      event_year
      event_place
      event_value
    }
  }
`;

export const UPDATE_LIFE_EVENT = gql`
  mutation UpdateLifeEvent($id: Int!, $input: LifeEventInput!) {
    updateLifeEvent(id: $id, input: $input) {
      id
      event_type
      event_date
      event_year
      event_place
      event_value
    }
  }
`;

export const DELETE_LIFE_EVENT = gql`
  mutation DeleteLifeEvent($id: Int!) {
    deleteLifeEvent(id: $id)
  }
`;

// =====================================================
// FACT MUTATIONS
// =====================================================

export const ADD_FACT = gql`
  mutation AddFact($personId: ID!, $input: FactInput!) {
    addFact(personId: $personId, input: $input) {
      id
      person_id
      fact_type
      fact_value
    }
  }
`;

export const UPDATE_FACT = gql`
  mutation UpdateFact($id: Int!, $input: FactInput!) {
    updateFact(id: $id, input: $input) {
      id
      fact_type
      fact_value
    }
  }
`;

export const DELETE_FACT = gql`
  mutation DeleteFact($id: Int!) {
    deleteFact(id: $id)
  }
`;
