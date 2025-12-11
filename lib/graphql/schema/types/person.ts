// Person-related GraphQL type definitions

export const personTypes = `
  # ===========================================
  # PERSON TYPE
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

  # Notable relatives connected through ancestry
  type NotableRelative {
    person: Person!
    generation: Int!
  }

  # ===========================================
  # PERSON INPUT
  # ===========================================

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

  # ===========================================
  # LIFE EVENTS & FACTS
  # ===========================================

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
`;
