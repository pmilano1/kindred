// Admin-related GraphQL type definitions

export const adminTypes = `
  # ===========================================
  # USER & AUTH TYPES
  # ===========================================

  type User {
    id: ID!
    email: String!
    name: String
    role: String!
    image: String
    created_at: String!
    last_login: String
    last_accessed: String
    api_key: String
    person_id: String
    linked_person: Person
    account_type: String
    description: String
  }

  type ClientError {
    id: ID!
    user_id: String
    user: User
    error_message: String!
    stack_trace: String
    url: String
    user_agent: String
    component_stack: String
    error_info: String
    created_at: String!
  }

  type ClientErrorStats {
    total: Int!
    last24Hours: Int!
    last7Days: Int!
    uniqueErrors: Int!
  }

  type Invitation {
    id: ID!
    email: String!
    role: String!
    token: String!
    created_at: String!
    expires_at: String!
    accepted_at: String
    created_by: String
  }

  # Service account creation result (includes API key shown once)
  type ServiceAccountResult {
    user: User!
    apiKey: String!
  }

  type AuthResult {
    success: Boolean!
    message: String
    userId: String
  }

  # ===========================================
  # EMAIL TYPES
  # ===========================================

  type EmailLog {
    id: ID!
    email_type: String!
    recipient: String!
    subject: String
    success: Boolean!
    error_message: String
    sent_at: String!
  }

  type EmailPreferences {
    user_id: ID!
    research_updates: Boolean!
    tree_changes: Boolean!
    weekly_digest: Boolean!
    birthday_reminders: Boolean!
  }

  type EmailTestResult {
    success: Boolean!
    message: String!
    recipient: String
  }

  type EmailStats {
    total_sent: Int!
    successful: Int!
    failed: Int!
    by_type: [EmailTypeStat!]!
  }

  type EmailTypeStat {
    email_type: String!
    count: Int!
  }

  input EmailPreferencesInput {
    research_updates: Boolean
    tree_changes: Boolean
    weekly_digest: Boolean
    birthday_reminders: Boolean
  }

  # ===========================================
  # STORAGE TYPES
  # ===========================================

  type StorageTestResult {
    success: Boolean!
    message: String!
    provider: String!
  }
`;
