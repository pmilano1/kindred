export const typeDefs = `#graphql
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
    # Relationships
    parents: [Person!]!
    siblings: [Person!]!
    spouses: [Person!]!
    children: [Person!]!
    families: [Family!]!
    residences: [Residence!]!
    occupations: [Occupation!]!
    events: [Event!]!
    facts: [Fact!]!
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

  type Query {
    # Person queries
    person(id: ID!): Person
    people(limit: Int, offset: Int): [Person!]!
    search(query: String!): [Person!]!
    
    # Family queries
    family(id: ID!): Family
    families: [Family!]!
    
    # Stats
    stats: Stats!
    
    # Research
    researchQueue(limit: Int): [Person!]!
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

