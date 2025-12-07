export const typeDefs = `#graphql
  # ===========================================
  # CORE TYPES
  # ===========================================

  type Person {
    id: ID!
    familysearch_id: String
    name_given: String
    name_surname: String
    name_full: String!
    sex: String
    birth_date: String
    birth_year: Int
    birth_place: String
    death_date: String
    death_year: Int
    death_place: String
    burial_date: String
    burial_place: String
    christening_date: String
    christening_place: String
    immigration_date: String
    immigration_place: String
    naturalization_date: String
    naturalization_place: String
    religion: String
    description: String
    living: Boolean!
    source_count: Int
    research_status: String
    research_priority: Int
    last_researched: String
    is_notable: Boolean
    notable_description: String

    # Relationships (batched via DataLoader)
    parents: [Person!]!
    siblings: [Person!]!
    spouses: [Person!]!
    children: [Person!]!
    families: [Family!]!

    # Life details (batched via DataLoader)
    lifeEvents: [LifeEvent!]!
    facts: [Fact!]!
    sources: [Source!]!
    coatOfArms: String

    # Notable relatives connected through ancestry
    notableRelatives: [NotableRelative!]!
  }

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

  # Unified life event type (replaces Residence, Occupation, Event)
  type LifeEvent {
    id: Int!
    person_id: String!
    event_type: String!
    event_date: String
    event_year: Int
    event_place: String
    event_value: String
  }

  type Fact {
    id: Int!
    person_id: String!
    fact_type: String
    fact_value: String
  }

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

  # ===========================================
  # SURNAME CRESTS (Coat of Arms by surname)
  # ===========================================

  type SurnameCrest {
    id: ID!
    surname: String!
    coat_of_arms: String!
    description: String
    origin: String
    motto: String
    created_at: String
    updated_at: String
  }

  # ===========================================
  # STATS
  # ===========================================

  type Stats {
    total_people: Int!
    total_families: Int!
    living_count: Int!
    male_count: Int!
    female_count: Int!
    earliest_birth: Int
    latest_birth: Int
    with_familysearch_id: Int!
  }

  # ===========================================
  # TIMELINE
  # ===========================================

  type TimelineEvent {
    type: String!
    person: Person!
  }

  type TimelineYear {
    year: Int!
    events: [TimelineEvent!]!
  }

  # ===========================================
  # ADMIN
  # ===========================================

  type User {
    id: ID!
    email: String!
    name: String
    role: String!
    created_at: String!
    last_login: String
    last_accessed: String
    api_key: String
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

  # ===========================================
  # SETTINGS
  # ===========================================

  type Setting {
    key: String!
    value: String
    description: String
    category: String!
    updated_at: String
  }

  type SiteSettings {
    site_name: String!
    family_name: String!
    site_tagline: String!
    theme_color: String!
    logo_url: String
    require_login: Boolean!
    show_living_details: Boolean!
    living_cutoff_years: Int!
    date_format: String!
    default_tree_generations: Int!
    show_coats_of_arms: Boolean!
    admin_email: String
    footer_text: String
  }

  type MigrationResult {
    success: Boolean!
    results: [String!]!
    message: String
  }

  type MigrationStatus {
    tables: [String!]!
    missingTables: [String!]!
    migrationNeeded: Boolean!
  }

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

  input EmailPreferencesInput {
    research_updates: Boolean
    tree_changes: Boolean
    weekly_digest: Boolean
    birthday_reminders: Boolean
  }

  input SettingsInput {
    site_name: String
    family_name: String
    site_tagline: String
    theme_color: String
    logo_url: String
    require_login: String
    show_living_details: String
    living_cutoff_years: String
    date_format: String
    default_tree_generations: String
    show_coats_of_arms: String
    admin_email: String
    footer_text: String
  }

  # ===========================================
  # PAGINATION (Relay-style cursors)
  # ===========================================

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    totalCount: Int!
  }

  type PersonEdge {
    node: Person!
    cursor: String!
  }

  type PersonConnection {
    edges: [PersonEdge!]!
    pageInfo: PageInfo!
  }

  # ===========================================
  # NOTABLE RELATIVES
  # ===========================================

  type NotableRelative {
    person: Person!
    generation: Int!
  }

  # ===========================================
  # QUERIES
  # ===========================================

  type Query {
    # Single lookups
    person(id: ID!): Person
    family(id: ID!): Family

    # Paginated lists (cursor-based for large datasets)
    people(first: Int, after: String, last: Int, before: String): PersonConnection!
    families: [Family!]!

    # Search with pagination
    search(query: String!, first: Int, after: String): PersonConnection!

    # Convenience queries (legacy offset-based, limited to 100)
    peopleList(limit: Int, offset: Int): [Person!]!
    recentPeople(limit: Int): [Person!]!

    # Notable people
    notablePeople: [Person!]!

    # Stats & Research
    stats: Stats!
    researchQueue(limit: Int): [Person!]!

    # Ancestry traversal (optimized single query)
    ancestors(personId: ID!, generations: Int): [Person!]!
    descendants(personId: ID!, generations: Int): [Person!]!

    # Timeline
    timeline: [TimelineYear!]!

    # Surname crests (coat of arms by surname)
    surnameCrests: [SurnameCrest!]!
    surnameCrest(surname: String!): SurnameCrest

    # Current user (authenticated user info)
    me: User

    # Admin (requires admin role)
    users: [User!]!
    invitations: [Invitation!]!

    # Settings (public settings for site display, admin for all)
    siteSettings: SiteSettings!
    settings: [Setting!]!
    migrationStatus: MigrationStatus!

    # Email (admin only)
    emailLogs(limit: Int, offset: Int): [EmailLog!]!
    emailStats: EmailStats!

    # Email preferences (current user)
    myEmailPreferences: EmailPreferences
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

  input PersonInput {
    name_full: String
    name_given: String
    name_surname: String
    sex: String
    birth_date: String
    birth_year: Int
    birth_place: String
    death_date: String
    death_year: Int
    death_place: String
    living: Boolean
    description: String
    research_status: String
    research_priority: Int
    is_notable: Boolean
    notable_description: String
  }

  input SourceInput {
    source_type: String
    source_name: String
    source_url: String
    action: String!
    content: String
    confidence: String
  }

  type Mutation {
    # Person mutations
    createPerson(input: PersonInput!): Person!
    updatePerson(id: ID!, input: PersonInput!): Person
    deletePerson(id: ID!): Boolean!

    # Source mutations
    addSource(personId: ID!, input: SourceInput!): Source
    updateResearchStatus(personId: ID!, status: String!): Person
    updateResearchPriority(personId: ID!, priority: Int!): Person

    # Surname crest mutations (requires editor role)
    setSurnameCrest(surname: String!, coatOfArms: String!, description: String, origin: String, motto: String): SurnameCrest
    removeSurnameCrest(surname: String!): Boolean

    # Person coat of arms override (requires editor role)
    setPersonCoatOfArms(personId: ID!, coatOfArms: String!): String
    removePersonCoatOfArms(personId: ID!): Boolean

    # Admin mutations (requires admin role)
    createInvitation(email: String!, role: String!): Invitation
    deleteInvitation(id: ID!): Boolean
    updateUserRole(userId: ID!, role: String!): User
    deleteUser(userId: ID!): Boolean

    # Settings mutations (requires admin role)
    updateSettings(input: SettingsInput!): SiteSettings!
    runMigrations: MigrationResult!

    # API Key mutations (user can manage their own key)
    generateApiKey: String!
    revokeApiKey: Boolean!

    # Email preferences mutations (current user)
    updateEmailPreferences(input: EmailPreferencesInput!): EmailPreferences!

    # Local auth mutations (public - no auth required)
    registerWithInvitation(token: String!, password: String!, name: String): AuthResult!
    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): AuthResult!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
  }

  type AuthResult {
    success: Boolean!
    message: String
    userId: String
  }
`;

