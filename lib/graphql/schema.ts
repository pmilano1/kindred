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

    # Estimated dates and placeholder support (Issue #195)
    birth_date_accuracy: String
    birth_year_min: Int
    birth_year_max: Int
    death_date_accuracy: String
    death_year_min: Int
    death_year_max: Int
    is_placeholder: Boolean

    # Computed research tip for queue prioritization
    research_tip: String

    # Data completeness score (0-100)
    completeness_score: Int
    completeness_details: CompletenessDetails

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
    media: [Media!]!
    coatOfArms: String

    # Comments (Issue #181 - Phase 1)
    comments: [Comment!]!

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

  # Data completeness tracking
  type CompletenessDetails {
    score: Int!
    has_name: Boolean!
    has_birth_date: Boolean!
    has_birth_place: Boolean!
    has_death_date: Boolean!
    has_death_place: Boolean!
    has_parents: Boolean!
    has_sources: Boolean!
    has_media: Boolean!
    missing_fields: [String!]!
  }

  # ===========================================
  # SURNAME CRESTS (Coat of Arms by surname)
  # ===========================================

  type SurnameCrest {
    id: ID!
    surname: String!
    coat_of_arms: String!
    storage_path: String
    description: String
    origin: String
    motto: String
    blazon: String
    source_url: String
    created_at: String
    updated_at: String
    # Count of people with this surname (resolved via field resolver)
    peopleCount: Int!
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
    average_completeness: Int!
    complete_count: Int!
    partial_count: Int!
    incomplete_count: Int!
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
    image: String
    created_at: String!
    last_login: String
    last_accessed: String
    api_key: String
    person_id: String
    linked_person: Person
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

  type AppliedMigration {
    version: Int!
    name: String!
    applied_at: String!
  }

  type MigrationStatus {
    tables: [String!]!
    missingTables: [String!]!
    migrationNeeded: Boolean!
    currentVersion: Int!
    latestVersion: Int!
    pendingMigrations: Int!
    appliedMigrations: [AppliedMigration!]!
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

  type EmailTestResult {
    success: Boolean!
    message: String!
    recipient: String
  }

  type StorageTestResult {
    success: Boolean!
    message: String!
    provider: String!
  }

  # Dashboard types
  type ActivityEntry {
    id: ID!
    action: String!
    details: String
    user_name: String
    user_email: String
    created_at: String!
    person_id: String
    person_name: String
  }

  type IncompleteProfile {
    person: Person!
    missing_fields: [String!]!
    suggestion: String!
  }

  type DashboardStats {
    total_people: Int!
    total_families: Int!
    total_sources: Int!
    total_media: Int!
    earliest_birth: Int
    latest_birth: Int
    living_count: Int!
    incomplete_count: Int!
    average_completeness: Int!
    complete_count: Int!
    partial_count: Int!
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
    # Research queue scoring weights (Issue #195)
    research_weight_missing_core_dates: String
    research_weight_missing_places: String
    research_weight_estimated_dates: String
    research_weight_placeholder_parent: String
    research_weight_low_sources: String
    research_weight_manual_priority: String
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
  # TREE VIEW TYPES
  # ===========================================

  # Pedigree node for ancestor tree view (nested structure)
  type PedigreeNode {
    id: ID!
    person: Person!
    father: PedigreeNode
    mother: PedigreeNode
    generation: Int!
    hasMoreAncestors: Boolean!
  }

  # Descendant node for descendant tree view (nested structure)
  type DescendantNode {
    id: ID!
    person: Person!
    spouse: Person
    marriageYear: Int
    children: [DescendantNode!]!
    generation: Int!
    hasMoreDescendants: Boolean!
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
    dashboardStats: DashboardStats!
    researchQueue(first: Int, after: String): PersonConnection!

    # Dashboard
    recentActivity(limit: Int): [ActivityEntry!]!
    incompleteProfiles(limit: Int): [IncompleteProfile!]!

    # Ancestry traversal (returns nested tree structure)
    ancestors(personId: ID!, generations: Int): PedigreeNode
    descendants(personId: ID!, generations: Int): DescendantNode

    # Timeline (with optional year range filtering)
    timeline(startYear: Int, endYear: Int): [TimelineYear!]!

    # Surname crests (coat of arms by surname)
    surnameCrests: [SurnameCrest!]!
    surnameCrest(surname: String!): SurnameCrest

    # Comments (Issue #181 - Phase 1)
    personComments(personId: ID!): [Comment!]!

    # Current user (authenticated user info)
    me: User

    # Admin (requires admin role)
    users: [User!]!
    invitations: [Invitation!]!

    # Settings (public settings for site display, admin for all)
    siteSettings: SiteSettings!
    settings: [Setting!]!
    migrationStatus: MigrationStatus!

    # Client errors (admin only)
    clientErrors(limit: Int, offset: Int): [ClientError!]!
    clientErrorStats: ClientErrorStats!

    # Email (admin only)
    emailLogs(limit: Int, offset: Int): [EmailLog!]!
    emailStats: EmailStats!

    # Email preferences (current user)
    myEmailPreferences: EmailPreferences

    # GEDCOM export
    exportGedcom(includeLiving: Boolean, includeSources: Boolean): String!

    # Duplicate detection (Issue #287)
    checkDuplicates(nameFull: String!, birthYear: Int, surname: String): [DuplicateMatch!]!
  }

  # Duplicate detection result (Issue #287)
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
    # Estimated dates and placeholder support (Issue #195)
    birth_date_accuracy: String
    birth_year_min: Int
    birth_year_max: Int
    death_date_accuracy: String
    death_year_min: Int
    death_year_max: Int
    is_placeholder: Boolean
  }

  input SourceInput {
    source_type: String
    source_name: String
    source_url: String
    action: String!
    content: String
    confidence: String
  }

  input LifeEventInput {
    event_type: String!
    event_date: String
    event_year: Int
    event_place: String
    event_value: String
  }

  input FactInput {
    fact_type: String!
    fact_value: String
  }

  input FamilyInput {
    husband_id: ID
    wife_id: ID
    marriage_date: String
    marriage_year: Int
    marriage_place: String
  }

  input SurnameCrestInput {
    surname: String
    coat_of_arms: String
    storage_path: String
    description: String
    origin: String
    motto: String
    blazon: String
    source_url: String
  }

  type Mutation {
    # Person mutations
    createPerson(input: PersonInput!): Person!
    updatePerson(id: ID!, input: PersonInput!): Person
    deletePerson(id: ID!): Boolean!

    # Life event mutations (requires editor role)
    addLifeEvent(personId: ID!, input: LifeEventInput!): LifeEvent!
    updateLifeEvent(id: Int!, input: LifeEventInput!): LifeEvent
    deleteLifeEvent(id: Int!): Boolean!

    # Fact mutations (requires editor role)
    addFact(personId: ID!, input: FactInput!): Fact!
    updateFact(id: Int!, input: FactInput!): Fact
    deleteFact(id: Int!): Boolean!

    # Family mutations (requires editor role)
    createFamily(input: FamilyInput!): Family!
    updateFamily(id: ID!, input: FamilyInput!): Family
    deleteFamily(id: ID!): Boolean!
    addChildToFamily(familyId: ID!, personId: ID!): Boolean!
    removeChildFromFamily(familyId: ID!, personId: ID!): Boolean!

    # High-level family mutations (Issue #283 - streamlined UI)
    addSpouse(personId: ID!, spouseId: ID!, marriageDate: String, marriageYear: Int, marriagePlace: String): Family!
    addChild(personId: ID!, childId: ID!, otherParentId: ID): Family!
    removeSpouse(personId: ID!, spouseId: ID!): Boolean!
    removeChild(personId: ID!, childId: ID!): Boolean!

    # Create and add in one step (Issue #287 - dual-mode)
    createAndAddSpouse(personId: ID!, newPerson: PersonInput!, marriageDate: String, marriageYear: Int, marriagePlace: String, skipDuplicateCheck: Boolean): CreateAndAddResult!
    createAndAddChild(personId: ID!, newPerson: PersonInput!, otherParentId: ID, skipDuplicateCheck: Boolean): CreateAndAddResult!

    # Source mutations (requires editor role)
    addSource(personId: ID!, input: SourceInput!): Source!
    updateSource(id: ID!, input: SourceInput!): Source
    deleteSource(id: ID!): Boolean!
    updateResearchStatus(personId: ID!, status: String!): Person
    updateResearchPriority(personId: ID!, priority: Int!): Person

    # Surname crest mutations (requires editor role)
    setSurnameCrest(surname: String!, coatOfArms: String!, description: String, origin: String, motto: String, blazon: String, sourceUrl: String): SurnameCrest
    updateSurnameCrest(id: ID!, input: SurnameCrestInput!): SurnameCrest
    removeSurnameCrest(surname: String!): Boolean

    # Person coat of arms override (requires editor role)
    setPersonCoatOfArms(personId: ID!, coatOfArms: String!): String
    removePersonCoatOfArms(personId: ID!): Boolean

    # Admin mutations (requires admin role)
    createInvitation(email: String!, role: String!): Invitation
    deleteInvitation(id: ID!): Boolean
    createLocalUser(email: String!, name: String!, role: String!, password: String!, requirePasswordChange: Boolean): User!
    updateUserRole(userId: ID!, role: String!): User
    linkUserToPerson(userId: ID!, personId: ID): User
    deleteUser(userId: ID!): Boolean

    # Service account mutations (requires admin role)
    createServiceAccount(name: String!, description: String, role: String!): ServiceAccountResult!
    revokeServiceAccount(userId: ID!): Boolean!

    # Settings mutations (requires admin role)
    updateSettings(input: SettingsInput!): SiteSettings!
    runMigrations: MigrationResult!
    testEmail(recipientEmail: String): EmailTestResult!

    # Client error mutations (admin only)
    deleteClientError(id: ID!): Boolean!
    clearAllClientErrors: Boolean!
    testStorage: StorageTestResult!

    # User profile mutations (current user)
    setMyPerson(personId: ID): User

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

    # GEDCOM import (requires admin role)
    importGedcom(content: String!): GedcomImportResult!

    # Media mutations (requires editor role)
    uploadMedia(personId: ID!, input: MediaInput!): Media!
    updateMedia(id: ID!, input: MediaUpdateInput!): Media
    deleteMedia(id: ID!): Boolean!

    # Comment mutations (Issue #181 - Phase 1)
    addComment(personId: ID!, content: String!, parentCommentId: ID): Comment!
    updateComment(id: ID!, content: String!): Comment
    deleteComment(id: ID!): Boolean!
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

  type AuthResult {
    success: Boolean!
    message: String
    userId: String
  }

  type GedcomImportResult {
    peopleImported: Int!
    familiesImported: Int!
    errors: [String!]!
    warnings: [String!]!
  }
`;
