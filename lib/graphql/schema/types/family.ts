// Family-related GraphQL type definitions

export const familyTypes = `
  # ===========================================
  # FAMILY TYPE
  # ===========================================

  type Family {
    id: ID!
    husband_id: String
    wife_id: String
    marriage_date: String
    marriage_year: Int
    marriage_place: String
    husband: Person
    wife: Person
    children: [Person!]!
  }

  input FamilyInput {
    husband_id: ID
    wife_id: ID
    marriage_date: String
    marriage_year: Int
    marriage_place: String
  }

  # ===========================================
  # DUPLICATE DETECTION (Issue #287)
  # ===========================================

  type DuplicateMatch {
    id: ID!
    name_full: String!
    birth_year: Int
    death_year: Int
    living: Boolean
    matchReason: String!
  }

  # Result for createAndAdd mutations (Issue #287)
  type CreateAndAddResult {
    person: Person!
    family: Family!
    duplicatesSkipped: Boolean!
  }
`;
