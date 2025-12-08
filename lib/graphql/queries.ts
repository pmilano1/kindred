import { gql } from '@apollo/client';

// =====================================================
// FRAGMENTS - Optimized for specific UI needs
// =====================================================

// Minimal fields for cards/lists - PersonCard component
export const PERSON_CARD_FIELDS = gql`
  fragment PersonCardFields on Person {
    id
    name_full
    sex
    living
    birth_year
    birth_place
    death_year
    death_place
    burial_place
    completeness_score
  }
`;

// Fields for search results
export const PERSON_SEARCH_FIELDS = gql`
  fragment PersonSearchFields on Person {
    id
    name_full
    sex
    living
    birth_year
    birth_place
    death_year
    death_place
  }
`;

// Full fields for person detail page
export const PERSON_FULL_FIELDS = gql`
  fragment PersonFullFields on Person {
    id
    name_full
    name_given
    name_surname
    sex
    birth_year
    birth_date
    birth_place
    death_year
    death_date
    death_place
    burial_date
    burial_place
    christening_date
    christening_place
    immigration_date
    immigration_place
    naturalization_date
    naturalization_place
    religion
    familysearch_id
    living
    description
    source_count
    research_status
    research_priority
    last_researched
    is_notable
    notable_description
    completeness_score
    completeness_details {
      score
      has_name
      has_birth_date
      has_birth_place
      has_death_date
      has_death_place
      has_parents
      has_sources
      has_media
      missing_fields
    }
  }
`;

// Source fields
export const SOURCE_FIELDS = gql`
  fragment SourceFields on Source {
    id
    action
    content
    source_type
    source_name
    source_url
    confidence
    validated
    created_at
  }
`;

// Legacy alias - remove after migration
export const PERSON_BASIC_FIELDS = PERSON_FULL_FIELDS;

// =====================================================
// QUERIES
// =====================================================

// Get person with sources (for ResearchPanel)
export const GET_PERSON_SOURCES = gql`
  ${SOURCE_FIELDS}
  query GetPersonSources($id: ID!) {
    person(id: $id) {
      id
      name_full
      research_status
      research_priority
      sources {
        ...SourceFields
      }
    }
  }
`;

// Get full person details with relationships (detail page)
export const GET_PERSON = gql`
  ${PERSON_FULL_FIELDS}
  ${PERSON_CARD_FIELDS}
  ${SOURCE_FIELDS}
  query GetPerson($id: ID!) {
    person(id: $id) {
      ...PersonFullFields
      parents {
        ...PersonCardFields
      }
      siblings {
        ...PersonCardFields
      }
      spouses {
        ...PersonCardFields
      }
      children {
        ...PersonCardFields
      }
      families {
        id
        husband_id
        wife_id
        marriage_date
        marriage_year
        marriage_place
        husband {
          ...PersonCardFields
        }
        wife {
          ...PersonCardFields
        }
        children {
          ...PersonCardFields
        }
      }
      sources {
        ...SourceFields
      }
      lifeEvents {
        id
        event_type
        event_date
        event_year
        event_place
        event_value
      }
      facts {
        id
        fact_type
        fact_value
      }
      media {
        id
        filename
        original_filename
        mime_type
        media_type
        caption
        url
      }
    }
  }
`;

// Search people - minimal fields for list
export const SEARCH_PEOPLE = gql`
  ${PERSON_SEARCH_FIELDS}
  query SearchPeople($query: String!, $first: Int, $after: String) {
    search(query: $query, first: $first, after: $after) {
      edges {
        node {
          ...PersonSearchFields
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
        totalCount
      }
    }
  }
`;

// Get paginated people list - for people page cards
export const GET_PEOPLE = gql`
  ${PERSON_CARD_FIELDS}
  query GetPeople($first: Int, $after: String) {
    people(first: $first, after: $after) {
      edges {
        node {
          ...PersonCardFields
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
        totalCount
      }
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

export const ADD_SOURCE = gql`
  ${SOURCE_FIELDS}
  mutation AddSource($personId: ID!, $input: SourceInput!) {
    addSource(personId: $personId, input: $input) {
      ...SourceFields
    }
  }
`;

export const UPDATE_SOURCE = gql`
  ${SOURCE_FIELDS}
  mutation UpdateSource($id: ID!, $input: SourceInput!) {
    updateSource(id: $id, input: $input) {
      ...SourceFields
    }
  }
`;

export const DELETE_SOURCE = gql`
  mutation DeleteSource($id: ID!) {
    deleteSource(id: $id)
  }
`;

export const UPDATE_RESEARCH_STATUS = gql`
  mutation UpdateResearchStatus($personId: ID!, $status: String!) {
    updateResearchStatus(personId: $personId, status: $status) {
      id
      research_status
    }
  }
`;

export const UPDATE_RESEARCH_PRIORITY = gql`
  mutation UpdateResearchPriority($personId: ID!, $priority: Int!) {
    updateResearchPriority(personId: $personId, priority: $priority) {
      id
      research_priority
    }
  }
`;

export const CREATE_PERSON = gql`
  ${PERSON_FULL_FIELDS}
  mutation CreatePerson($input: PersonInput!) {
    createPerson(input: $input) {
      ...PersonFullFields
    }
  }
`;

export const UPDATE_PERSON = gql`
  ${PERSON_FULL_FIELDS}
  mutation UpdatePerson($id: ID!, $input: PersonInput!) {
    updatePerson(id: $id, input: $input) {
      ...PersonFullFields
    }
  }
`;

export const DELETE_PERSON = gql`
  mutation DeletePerson($id: ID!) {
    deletePerson(id: $id)
  }
`;

// Life Event mutations
export const ADD_LIFE_EVENT = gql`
  mutation AddLifeEvent($personId: ID!, $input: LifeEventInput!) {
    addLifeEvent(personId: $personId, input: $input) {
      id
      person_id
      event_type
      event_date
      event_year
      event_place
      event_value
    }
  }
`;

export const UPDATE_LIFE_EVENT = gql`
  mutation UpdateLifeEvent($id: Int!, $input: LifeEventInput!) {
    updateLifeEvent(id: $id, input: $input) {
      id
      event_type
      event_date
      event_year
      event_place
      event_value
    }
  }
`;

export const DELETE_LIFE_EVENT = gql`
  mutation DeleteLifeEvent($id: Int!) {
    deleteLifeEvent(id: $id)
  }
`;

// Fact mutations
export const ADD_FACT = gql`
  mutation AddFact($personId: ID!, $input: FactInput!) {
    addFact(personId: $personId, input: $input) {
      id
      person_id
      fact_type
      fact_value
    }
  }
`;

export const UPDATE_FACT = gql`
  mutation UpdateFact($id: Int!, $input: FactInput!) {
    updateFact(id: $id, input: $input) {
      id
      fact_type
      fact_value
    }
  }
`;

export const DELETE_FACT = gql`
  mutation DeleteFact($id: Int!) {
    deleteFact(id: $id)
  }
`;

// ============================================
// FAMILY MUTATIONS
// ============================================

export const CREATE_FAMILY = gql`
  mutation CreateFamily($input: FamilyInput!) {
    createFamily(input: $input) {
      id
      husband_id
      wife_id
      marriage_date
      marriage_year
      marriage_place
    }
  }
`;

export const UPDATE_FAMILY = gql`
  mutation UpdateFamily($id: ID!, $input: FamilyInput!) {
    updateFamily(id: $id, input: $input) {
      id
      husband_id
      wife_id
      marriage_date
      marriage_year
      marriage_place
    }
  }
`;

export const DELETE_FAMILY = gql`
  mutation DeleteFamily($id: ID!) {
    deleteFamily(id: $id)
  }
`;

export const ADD_CHILD_TO_FAMILY = gql`
  mutation AddChildToFamily($familyId: ID!, $personId: ID!) {
    addChildToFamily(familyId: $familyId, personId: $personId)
  }
`;

export const REMOVE_CHILD_FROM_FAMILY = gql`
  mutation RemoveChildFromFamily($familyId: ID!, $personId: ID!) {
    removeChildFromFamily(familyId: $familyId, personId: $personId)
  }
`;

export const UPDATE_NOTABLE_STATUS = gql`
  mutation UpdateNotableStatus($id: ID!, $isNotable: Boolean!, $notableDescription: String) {
    updatePerson(id: $id, input: { is_notable: $isNotable, notable_description: $notableDescription }) {
      id
      is_notable
      notable_description
    }
  }
`;

// ============================================
// HOME PAGE QUERIES
// ============================================

export const GET_STATS = gql`
  query GetStats {
    stats {
      total_people
      total_families
      living_count
      male_count
      female_count
      earliest_birth
      latest_birth
      with_familysearch_id
      average_completeness
      complete_count
      partial_count
      incomplete_count
    }
  }
`;

export const GET_DASHBOARD = gql`
  ${PERSON_CARD_FIELDS}
  query GetDashboard($activityLimit: Int, $incompleteLimit: Int, $recentLimit: Int) {
    dashboardStats {
      total_people
      total_families
      total_sources
      total_media
      earliest_birth
      latest_birth
      living_count
      incomplete_count
      average_completeness
      complete_count
      partial_count
    }
    recentActivity(limit: $activityLimit) {
      id
      action
      details
      user_name
      user_email
      created_at
      person_id
      person_name
    }
    incompleteProfiles(limit: $incompleteLimit) {
      person {
        ...PersonCardFields
      }
      missing_fields
      suggestion
    }
    recentPeople(limit: $recentLimit) {
      ...PersonCardFields
    }
  }
`;

export const GET_RECENT_PEOPLE = gql`
  ${PERSON_CARD_FIELDS}
  query GetRecentPeople($limit: Int) {
    recentPeople(limit: $limit) {
      ...PersonCardFields
    }
  }
`;

export const GET_NOTABLE_PEOPLE = gql`
  ${PERSON_CARD_FIELDS}
  query GetNotablePeople {
    notablePeople {
      ...PersonCardFields
      notable_description
    }
  }
`;

// Notable relatives are now fetched as a field on Person, e.g.:
// person(id: $id) { notableRelatives { person { ...PersonCardFields } generation } }

// ============================================
// TIMELINE QUERY
// ============================================

export const GET_TIMELINE = gql`
  ${PERSON_CARD_FIELDS}
  query GetTimeline {
    timeline {
      year
      events {
        type
        person {
          ...PersonCardFields
        }
      }
    }
  }
`;

// ============================================
// PEOPLE & FAMILIES QUERIES
// ============================================

export const GET_PEOPLE_LIST = gql`
  ${PERSON_CARD_FIELDS}
  query GetPeopleList($limit: Int, $offset: Int) {
    peopleList(limit: $limit, offset: $offset) {
      ...PersonCardFields
    }
  }
`;

export const GET_FAMILIES = gql`
  query GetFamilies {
    families {
      id
      husband_id
      wife_id
      marriage_year
      marriage_place
      children {
        id
      }
    }
  }
`;

// ============================================
// RESEARCH QUEUE QUERY
// ============================================

export const GET_RESEARCH_QUEUE = gql`
  ${PERSON_CARD_FIELDS}
  query GetResearchQueue($first: Int, $after: String) {
    researchQueue(first: $first, after: $after) {
      edges {
        node {
          ...PersonCardFields
          research_status
          research_priority
          last_researched
          research_tip
          source_count
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
        totalCount
      }
    }
  }
`;

// ============================================
// ADMIN QUERIES
// ============================================

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

// ============================================
// SERVICE ACCOUNTS
// ============================================

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

// ============================================
// API KEY MANAGEMENT
// ============================================

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

// ============================================
// COAT OF ARMS / SURNAME CRESTS
// ============================================

export const GET_SURNAME_CRESTS = gql`
  query GetSurnameCrests {
    surnameCrests {
      id
      surname
      coat_of_arms
      description
      origin
      motto
      created_at
    }
  }
`;

export const GET_SURNAME_CREST = gql`
  query GetSurnameCrest($surname: String!) {
    surnameCrest(surname: $surname) {
      id
      surname
      coat_of_arms
      description
      origin
      motto
    }
  }
`;

export const SET_SURNAME_CREST = gql`
  mutation SetSurnameCrest($surname: String!, $coatOfArms: String!, $description: String, $origin: String, $motto: String) {
    setSurnameCrest(surname: $surname, coatOfArms: $coatOfArms, description: $description, origin: $origin, motto: $motto) {
      id
      surname
      coat_of_arms
    }
  }
`;

export const REMOVE_SURNAME_CREST = gql`
  mutation RemoveSurnameCrest($surname: String!) {
    removeSurnameCrest(surname: $surname)
  }
`;

export const SET_PERSON_COAT_OF_ARMS = gql`
  mutation SetPersonCoatOfArms($personId: ID!, $coatOfArms: String!) {
    setPersonCoatOfArms(personId: $personId, coatOfArms: $coatOfArms)
  }
`;

export const REMOVE_PERSON_COAT_OF_ARMS = gql`
  mutation RemovePersonCoatOfArms($personId: ID!) {
    removePersonCoatOfArms(personId: $personId)
  }
`;

// =====================================================
// SITE SETTINGS
// =====================================================

export const GET_SITE_SETTINGS = gql`
  query GetSiteSettings {
    siteSettings {
      site_name
      family_name
      site_tagline
      theme_color
      logo_url
      require_login
      show_living_details
      living_cutoff_years
      date_format
      default_tree_generations
      show_coats_of_arms
      admin_email
      footer_text
    }
  }
`;

// ============================================
// GEDCOM EXPORT/IMPORT
// ============================================

export const EXPORT_GEDCOM = gql`
  query ExportGedcom($includeLiving: Boolean, $includeSources: Boolean) {
    exportGedcom(includeLiving: $includeLiving, includeSources: $includeSources)
  }
`;

export const IMPORT_GEDCOM = gql`
  mutation ImportGedcom($content: String!) {
    importGedcom(content: $content) {
      peopleImported
      familiesImported
      errors
      warnings
    }
  }
`;

// ============================================
// MEDIA
// ============================================

export const MEDIA_FIELDS = gql`
  fragment MediaFields on Media {
    id
    person_id
    filename
    original_filename
    mime_type
    file_size
    storage_path
    thumbnail_path
    media_type
    caption
    date_taken
    source_attribution
    created_at
    url
  }
`;

export const UPLOAD_MEDIA = gql`
  mutation UploadMedia($personId: ID!, $input: MediaInput!) {
    uploadMedia(personId: $personId, input: $input) {
      ...MediaFields
    }
  }
  ${MEDIA_FIELDS}
`;

export const UPDATE_MEDIA = gql`
  mutation UpdateMedia($id: ID!, $input: MediaUpdateInput!) {
    updateMedia(id: $id, input: $input) {
      ...MediaFields
    }
  }
  ${MEDIA_FIELDS}
`;

export const DELETE_MEDIA = gql`
  mutation DeleteMedia($id: ID!) {
    deleteMedia(id: $id)
  }
`;
