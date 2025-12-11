// Common GraphQL type definitions (pagination, stats, dashboard, timeline, tree)

export const commonTypes = `
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
  # DASHBOARD
  # ===========================================

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
`;
