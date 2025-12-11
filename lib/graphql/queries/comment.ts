// =====================================================
// GraphQL Queries - Comment Operations
// =====================================================
// Queries and mutations for person comments (Issue #181)

import { gql } from '@apollo/client';

// =====================================================
// COMMENT FRAGMENTS
// =====================================================

export const COMMENT_FIELDS = gql`
  fragment CommentFields on Comment {
    id
    person_id
    user_id
    parent_comment_id
    content
    created_at
    updated_at
    user {
      id
      name
      email
    }
  }
`;

// =====================================================
// COMMENT QUERIES
// =====================================================

export const GET_PERSON_COMMENTS = gql`
  ${COMMENT_FIELDS}
  query GetPersonComments($personId: ID!) {
    personComments(personId: $personId) {
      ...CommentFields
      replies {
        ...CommentFields
      }
    }
  }
`;

// =====================================================
// COMMENT MUTATIONS
// =====================================================

export const ADD_COMMENT = gql`
  ${COMMENT_FIELDS}
  mutation AddComment($personId: ID!, $content: String!, $parentCommentId: ID) {
    addComment(personId: $personId, content: $content, parentCommentId: $parentCommentId) {
      ...CommentFields
    }
  }
`;

export const UPDATE_COMMENT = gql`
  ${COMMENT_FIELDS}
  mutation UpdateComment($id: ID!, $content: String!) {
    updateComment(id: $id, content: $content) {
      ...CommentFields
    }
  }
`;

export const DELETE_COMMENT = gql`
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`;
