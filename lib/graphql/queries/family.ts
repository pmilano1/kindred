import { gql } from '@apollo/client';

// =====================================================
// FAMILY QUERIES
// =====================================================

export const GET_FAMILIES = gql`
  query GetFamilies {
    families {
      id
      husband_id
      wife_id
      marriage_year
      marriage_place
      children {
        id
      }
    }
  }
`;

// =====================================================
// FAMILY MUTATIONS
// =====================================================

export const CREATE_FAMILY = gql`
  mutation CreateFamily($input: FamilyInput!) {
    createFamily(input: $input) {
      id
      husband_id
      wife_id
      marriage_date
      marriage_year
      marriage_place
    }
  }
`;

export const UPDATE_FAMILY = gql`
  mutation UpdateFamily($id: ID!, $input: FamilyInput!) {
    updateFamily(id: $id, input: $input) {
      id
      husband_id
      wife_id
      marriage_date
      marriage_year
      marriage_place
    }
  }
`;

export const DELETE_FAMILY = gql`
  mutation DeleteFamily($id: ID!) {
    deleteFamily(id: $id)
  }
`;

export const ADD_CHILD_TO_FAMILY = gql`
  mutation AddChildToFamily($familyId: ID!, $personId: ID!) {
    addChildToFamily(familyId: $familyId, personId: $personId)
  }
`;

export const REMOVE_CHILD_FROM_FAMILY = gql`
  mutation RemoveChildFromFamily($familyId: ID!, $personId: ID!) {
    removeChildFromFamily(familyId: $familyId, personId: $personId)
  }
`;

// High-level family mutations (Issue #283)
export const ADD_SPOUSE = gql`
  mutation AddSpouse(
    $personId: ID!
    $spouseId: ID!
    $marriageDate: String
    $marriageYear: Int
    $marriagePlace: String
  ) {
    addSpouse(
      personId: $personId
      spouseId: $spouseId
      marriageDate: $marriageDate
      marriageYear: $marriageYear
      marriagePlace: $marriagePlace
    ) {
      id
      husband_id
      wife_id
      marriage_date
      marriage_year
      marriage_place
    }
  }
`;

export const ADD_CHILD = gql`
  mutation AddChild($personId: ID!, $childId: ID!, $otherParentId: ID) {
    addChild(personId: $personId, childId: $childId, otherParentId: $otherParentId) {
      id
      husband_id
      wife_id
    }
  }
`;

export const REMOVE_SPOUSE = gql`
  mutation RemoveSpouse($personId: ID!, $spouseId: ID!) {
    removeSpouse(personId: $personId, spouseId: $spouseId)
  }
`;

export const REMOVE_CHILD = gql`
  mutation RemoveChild($personId: ID!, $childId: ID!) {
    removeChild(personId: $personId, childId: $childId)
  }
`;

// Duplicate detection (Issue #287)
export const CHECK_DUPLICATES = gql`
  query CheckDuplicates($nameFull: String!, $birthYear: Int, $surname: String) {
    checkDuplicates(nameFull: $nameFull, birthYear: $birthYear, surname: $surname) {
      id
      name_full
      birth_year
      death_year
      living
      matchReason
    }
  }
`;

// Create and add in one step (Issue #287)
export const CREATE_AND_ADD_SPOUSE = gql`
  mutation CreateAndAddSpouse(
    $personId: ID!
    $newPerson: PersonInput!
    $marriageDate: String
    $marriageYear: Int
    $marriagePlace: String
    $skipDuplicateCheck: Boolean
  ) {
    createAndAddSpouse(
      personId: $personId
      newPerson: $newPerson
      marriageDate: $marriageDate
      marriageYear: $marriageYear
      marriagePlace: $marriagePlace
      skipDuplicateCheck: $skipDuplicateCheck
    ) {
      person { id name_full }
      family { id }
      duplicatesSkipped
    }
  }
`;

export const CREATE_AND_ADD_CHILD = gql`
  mutation CreateAndAddChild(
    $personId: ID!
    $newPerson: PersonInput!
    $otherParentId: ID
    $skipDuplicateCheck: Boolean
  ) {
    createAndAddChild(
      personId: $personId
      newPerson: $newPerson
      otherParentId: $otherParentId
      skipDuplicateCheck: $skipDuplicateCheck
    ) {
      person { id name_full }
      family { id }
      duplicatesSkipped
    }
  }
`;
