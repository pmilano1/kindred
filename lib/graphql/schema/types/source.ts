// Source-related GraphQL type definitions

export const sourceTypes = `
  # ===========================================
  # SOURCE TYPE
  # ===========================================

  type Source {
    id: String!
    person_id: String!
    source_type: String
    source_name: String
    source_url: String
    action: String!
    content: String
    confidence: String
    validated: Boolean
    validated_date: String
    created_at: String!
    updated_at: String
  }

  input SourceInput {
    source_type: String
    source_name: String
    source_url: String
    action: String!
    content: String
    confidence: String
  }
`;
