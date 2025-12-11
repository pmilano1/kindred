import { gql } from '@apollo/client';
import { MEDIA_FIELDS } from './fragments';

// =====================================================
// MEDIA MUTATIONS
// =====================================================

export const UPLOAD_MEDIA = gql`
  mutation UploadMedia($personId: ID!, $input: MediaInput!) {
    uploadMedia(personId: $personId, input: $input) {
      ...MediaFields
    }
  }
  ${MEDIA_FIELDS}
`;

export const UPDATE_MEDIA = gql`
  mutation UpdateMedia($id: ID!, $input: MediaUpdateInput!) {
    updateMedia(id: $id, input: $input) {
      ...MediaFields
    }
  }
  ${MEDIA_FIELDS}
`;

export const DELETE_MEDIA = gql`
  mutation DeleteMedia($id: ID!) {
    deleteMedia(id: $id)
  }
`;
