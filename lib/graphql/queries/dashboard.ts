import { gql } from '@apollo/client';
import { PERSON_CARD_FIELDS } from './fragments';

// =====================================================
// DASHBOARD & STATS QUERIES
// =====================================================

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

// =====================================================
// RESEARCH QUEUE QUERY
// =====================================================

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

// =====================================================
// TIMELINE QUERY
// =====================================================

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
