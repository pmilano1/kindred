import { gql } from '@apollo/client';
import { SOURCE_FIELDS } from './fragments';

// =====================================================
// SOURCE MUTATIONS
// =====================================================

export const ADD_SOURCE = gql`
  ${SOURCE_FIELDS}
  mutation AddSource($personId: ID!, $input: SourceInput!) {
    addSource(personId: $personId, input: $input) {
      ...SourceFields
    }
  }
`;

export const UPDATE_SOURCE = gql`
  ${SOURCE_FIELDS}
  mutation UpdateSource($id: ID!, $input: SourceInput!) {
    updateSource(id: $id, input: $input) {
      ...SourceFields
    }
  }
`;

export const DELETE_SOURCE = gql`
  mutation DeleteSource($id: ID!) {
    deleteSource(id: $id)
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
