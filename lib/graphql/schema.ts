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

    # Relationships (batched via DataLoader)
    parents: [Person!]!
    siblings: [Person!]!
    spouses: [Person!]!
    children: [Person!]!
    families: [Family!]!

    # Life details (batched via DataLoader)
    residences: [Residence!]!
    occupations: [Occupation!]!
    events: [Event!]!
    facts: [Fact!]!
    sources: [Source!]!
    researchLog: [ResearchLog!]!
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

  type Residence {
    id: Int!
    person_id: String!
    residence_date: String
    residence_year: Int
    residence_place: String
  }

  type Occupation {
    id: Int!
    person_id: String!
    title: String
    occupation_date: String
    occupation_place: String
  }

  type Event {
    id: Int!
    person_id: String!
    event_type: String
    event_date: String
    event_place: String
  }

  type Fact {
    id: Int!
    person_id: String!
    fact_type: String
    fact_value: String
  }

  type ResearchLog {
    id: String!
    person_id: String!
    created_at: String!
    action_type: String!
    source_checked: String
    content: String!
    confidence: String
    external_url: String
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

  type RelationshipPath {
    from: Person!
    to: Person!
    path: [Person!]!
    relationship: String!
    degrees: Int!
  }

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

    # Stats & Research
    stats: Stats!
    researchQueue(limit: Int): [Person!]!

    # Ancestry traversal (optimized single query)
    ancestors(personId: ID!, generations: Int): [Person!]!
    descendants(personId: ID!, generations: Int): [Person!]!
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
  }

  input ResearchLogInput {
    action_type: String!
    content: String!
    source_checked: String
    confidence: String
    external_url: String
  }

  type Mutation {
    # Person mutations
    updatePerson(id: ID!, input: PersonInput!): Person
    
    # Research mutations
    addResearchLog(personId: ID!, input: ResearchLogInput!): ResearchLog
    updateResearchStatus(personId: ID!, status: String!): Person
    updateResearchPriority(personId: ID!, priority: Int!): Person
  }
`;

