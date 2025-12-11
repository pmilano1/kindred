// Media-related GraphQL type definitions

export const mediaTypes = `
  # ===========================================
  # MEDIA TYPE
  # ===========================================

  type Media {
    id: ID!
    person_id: String!
    filename: String!
    original_filename: String!
    mime_type: String!
    file_size: Int!
    storage_path: String!
    thumbnail_path: String
    media_type: String!
    caption: String
    date_taken: String
    source_attribution: String
    uploaded_by: String
    created_at: String!
    url: String!
  }

  input MediaInput {
    filename: String!
    original_filename: String!
    mime_type: String!
    file_size: Int!
    storage_path: String!
    thumbnail_path: String
    media_type: String!
    caption: String
    date_taken: String
    source_attribution: String
  }

  input MediaUpdateInput {
    caption: String
    date_taken: String
    source_attribution: String
    media_type: String
  }
`;
