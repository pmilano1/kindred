import { gql } from '@apollo/client';
import { PERSON_CARD_FIELDS } from './fragments';

// =====================================================
// TREE QUERIES
// =====================================================

export const GET_ANCESTORS = gql`
  ${PERSON_CARD_FIELDS}
  query GetAncestors($personId: ID!, $generations: Int) {
    ancestors(personId: $personId, generations: $generations) {
      id
      person {
        ...PersonCardFields
      }
      father {
        id
        person {
          ...PersonCardFields
        }
        father {
          id
          person {
            ...PersonCardFields
          }
          father {
            id
            person {
              ...PersonCardFields
            }
            hasMoreAncestors
          }
          mother {
            id
            person {
              ...PersonCardFields
            }
            hasMoreAncestors
          }
          hasMoreAncestors
        }
        mother {
          id
          person {
            ...PersonCardFields
          }
          father {
            id
            person {
              ...PersonCardFields
            }
            hasMoreAncestors
          }
          mother {
            id
            person {
              ...PersonCardFields
            }
            hasMoreAncestors
          }
          hasMoreAncestors
        }
        hasMoreAncestors
      }
      mother {
        id
        person {
          ...PersonCardFields
        }
        father {
          id
          person {
            ...PersonCardFields
          }
          father {
            id
            person {
              ...PersonCardFields
            }
            hasMoreAncestors
          }
          mother {
            id
            person {
              ...PersonCardFields
            }
            hasMoreAncestors
          }
          hasMoreAncestors
        }
        mother {
          id
          person {
            ...PersonCardFields
          }
          father {
            id
            person {
              ...PersonCardFields
            }
            hasMoreAncestors
          }
          mother {
            id
            person {
              ...PersonCardFields
            }
            hasMoreAncestors
          }
          hasMoreAncestors
        }
        hasMoreAncestors
      }
      generation
      hasMoreAncestors
    }
  }
`;

export const GET_DESCENDANTS = gql`
  ${PERSON_CARD_FIELDS}
  query GetDescendants($personId: ID!, $generations: Int) {
    descendants(personId: $personId, generations: $generations) {
      id
      person {
        ...PersonCardFields
      }
      spouse {
        ...PersonCardFields
      }
      marriageYear
      children {
        id
        person {
          ...PersonCardFields
        }
        spouse {
          ...PersonCardFields
        }
        marriageYear
        children {
          id
          person {
            ...PersonCardFields
          }
          spouse {
            ...PersonCardFields
          }
          marriageYear
          hasMoreDescendants
        }
        hasMoreDescendants
      }
      generation
      hasMoreDescendants
    }
  }
`;
