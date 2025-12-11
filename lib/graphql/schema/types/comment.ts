// Comment-related GraphQL type definitions

export const commentTypes = `
  # ===========================================
  # COMMENTS (Issue #181 - Phase 1)
  # ===========================================

  type Comment {
    id: ID!
    person_id: String!
    user_id: String!
    parent_comment_id: String
    content: String!
    created_at: String!
    updated_at: String!
    # Resolved fields
    user: User
    replies: [Comment!]!
  }
`;
