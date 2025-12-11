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

// Media fields
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
