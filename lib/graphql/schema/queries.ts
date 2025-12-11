// GraphQL Query type definitions

export const queryTypes = `
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
`;
