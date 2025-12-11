import { gql } from '@apollo/client';

// =====================================================
// ADMIN QUERIES
// =====================================================

export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      email
      name
      role
      image
      created_at
      last_login
      last_accessed
      person_id
      linked_person {
        id
        name_full
      }
    }
  }
`;

export const GET_INVITATIONS = gql`
  query GetInvitations {
    invitations {
      id
      email
      role
      token
      expires_at
      accepted_at
      created_by
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      name
      role
      api_key
    }
  }
`;

// =====================================================
// ADMIN MUTATIONS
// =====================================================

export const CREATE_INVITATION = gql`
  mutation CreateInvitation($email: String!, $role: String!) {
    createInvitation(email: $email, role: $role) {
      id
      email
      role
      token
      expires_at
    }
  }
`;

export const DELETE_INVITATION = gql`
  mutation DeleteInvitation($id: ID!) {
    deleteInvitation(id: $id)
  }
`;

export const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($userId: ID!, $role: String!) {
    updateUserRole(userId: $userId, role: $role) {
      id
      email
      role
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($userId: ID!) {
    deleteUser(userId: $userId)
  }
`;

export const CREATE_LOCAL_USER = gql`
  mutation CreateLocalUser($email: String!, $name: String!, $role: String!, $password: String!, $requirePasswordChange: Boolean) {
    createLocalUser(email: $email, name: $name, role: $role, password: $password, requirePasswordChange: $requirePasswordChange) {
      id
      email
      name
      role
      created_at
    }
  }
`;

export const LINK_USER_TO_PERSON = gql`
  mutation LinkUserToPerson($userId: ID!, $personId: ID) {
    linkUserToPerson(userId: $userId, personId: $personId) {
      id
      email
      person_id
      linked_person {
        id
        name_full
      }
    }
  }
`;

export const SET_MY_PERSON = gql`
  mutation SetMyPerson($personId: ID) {
    setMyPerson(personId: $personId) {
      id
      person_id
    }
  }
`;

// =====================================================
// SERVICE ACCOUNTS
// =====================================================

export const CREATE_SERVICE_ACCOUNT = gql`
  mutation CreateServiceAccount($name: String!, $description: String, $role: String!) {
    createServiceAccount(name: $name, description: $description, role: $role) {
      user {
        id
        name
        role
        account_type
        description
        created_at
      }
      apiKey
    }
  }
`;

export const REVOKE_SERVICE_ACCOUNT = gql`
  mutation RevokeServiceAccount($userId: ID!) {
    revokeServiceAccount(userId: $userId)
  }
`;

// =====================================================
// API KEY MANAGEMENT
// =====================================================

export const GENERATE_API_KEY = gql`
  mutation GenerateApiKey {
    generateApiKey
  }
`;

export const REVOKE_API_KEY = gql`
  mutation RevokeApiKey {
    revokeApiKey
  }
`;
