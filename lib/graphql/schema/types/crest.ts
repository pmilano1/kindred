// Surname crest (coat of arms) GraphQL type definitions

export const crestTypes = `
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
`;
