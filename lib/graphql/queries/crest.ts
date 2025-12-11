import { gql } from '@apollo/client';

// =====================================================
// COAT OF ARMS / SURNAME CRESTS QUERIES
// =====================================================

export const GET_SURNAME_CRESTS = gql`
  query GetSurnameCrests {
    surnameCrests {
      id
      surname
      coat_of_arms
      description
      origin
      motto
      blazon
      source_url
      created_at
      peopleCount
    }
  }
`;

export const GET_SURNAME_CREST = gql`
  query GetSurnameCrest($surname: String!) {
    surnameCrest(surname: $surname) {
      id
      surname
      coat_of_arms
      description
      origin
      motto
      blazon
      source_url
    }
  }
`;

// =====================================================
// COAT OF ARMS / SURNAME CRESTS MUTATIONS
// =====================================================

export const SET_SURNAME_CREST = gql`
  mutation SetSurnameCrest($surname: String!, $coatOfArms: String!, $description: String, $origin: String, $motto: String, $blazon: String, $sourceUrl: String) {
    setSurnameCrest(surname: $surname, coatOfArms: $coatOfArms, description: $description, origin: $origin, motto: $motto, blazon: $blazon, sourceUrl: $sourceUrl) {
      id
      surname
      coat_of_arms
    }
  }
`;

export const UPDATE_SURNAME_CREST = gql`
  mutation UpdateSurnameCrest($id: ID!, $input: SurnameCrestInput!) {
    updateSurnameCrest(id: $id, input: $input) {
      id
      surname
      coat_of_arms
      description
      origin
      motto
      blazon
      source_url
      peopleCount
    }
  }
`;

export const REMOVE_SURNAME_CREST = gql`
  mutation RemoveSurnameCrest($surname: String!) {
    removeSurnameCrest(surname: $surname)
  }
`;

export const SET_PERSON_COAT_OF_ARMS = gql`
  mutation SetPersonCoatOfArms($personId: ID!, $coatOfArms: String!) {
    setPersonCoatOfArms(personId: $personId, coatOfArms: $coatOfArms)
  }
`;

export const REMOVE_PERSON_COAT_OF_ARMS = gql`
  mutation RemovePersonCoatOfArms($personId: ID!) {
    removePersonCoatOfArms(personId: $personId)
  }
`;
