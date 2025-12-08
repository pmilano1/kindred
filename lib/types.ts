// Date accuracy values for estimated dates (Issue #195)
export type DateAccuracy = 'EXACT' | 'ESTIMATED' | 'RANGE' | 'UNKNOWN';

export interface Person {
  id: string;
  familysearch_id: string | null;
  name_given: string | null;
  name_surname: string | null;
  name_full: string;
  sex: 'M' | 'F' | null;
  birth_date: string | null;
  birth_year: number | null;
  birth_place: string | null;
  death_date: string | null;
  death_year: number | null;
  death_place: string | null;
  burial_date: string | null;
  burial_place: string | null;
  christening_date: string | null;
  christening_place: string | null;
  immigration_date: string | null;
  immigration_place: string | null;
  naturalization_date: string | null;
  naturalization_place: string | null;
  religion: string | null;
  description: string | null;
  living: boolean;
  source_count: number;
  research_status: string | null;
  research_priority: number | null;
  last_researched: string | null;
  is_notable: boolean;
  notable_description: string | null;
  // Estimated dates and placeholder support (Issue #195)
  birth_date_accuracy: DateAccuracy | null;
  birth_year_min: number | null;
  birth_year_max: number | null;
  death_date_accuracy: DateAccuracy | null;
  death_year_min: number | null;
  death_year_max: number | null;
  is_placeholder: boolean;
  // Computed research tip
  research_tip?: string | null;
  // Data completeness
  completeness_score?: number;
  completeness_details?: CompletenessDetails;
}

export interface CompletenessDetails {
  score: number;
  has_name: boolean;
  has_birth_date: boolean;
  has_birth_place: boolean;
  has_death_date: boolean;
  has_death_place: boolean;
  has_parents: boolean;
  has_sources: boolean;
  has_media: boolean;
  missing_fields: string[];
}

// Unified life event (combines residence, occupation, and other events)
export interface LifeEvent {
  id: number;
  person_id: string;
  event_type: string;
  event_date: string | null;
  event_year: number | null;
  event_place: string | null;
  event_value: string | null;
}

export interface Fact {
  id: number;
  person_id: string;
  fact_type: string | null;
  fact_value: string | null;
}

export interface Family {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
  marriage_date: string | null;
  marriage_year: number | null;
  marriage_place: string | null;
}

export interface Child {
  family_id: string;
  person_id: string;
}

export interface Stats {
  total_people: number;
  total_families: number;
  living_count: number;
  male_count: number;
  female_count: number;
  earliest_birth: number | null;
  latest_birth: number | null;
  with_familysearch_id: number;
  average_completeness: number;
  complete_count: number;
  partial_count: number;
  incomplete_count: number;
}

// Unified Source type - combines sources and research activity
export type SourceType =
  | 'FamilySearch'
  | 'Geni'
  | 'Ancestry'
  | 'MyHeritage'
  | 'FindAGrave'
  | 'ANOM'
  | 'Geneanet'
  | 'WikiTree'
  | 'Newspapers'
  | 'Census'
  | 'VitalRecords'
  | 'ChurchRecords'
  | 'Immigration'
  | 'Military'
  | 'DNA'
  | 'FamilyBible'
  | 'Interview'
  | 'Other';
export type SourceAction =
  | 'searched'
  | 'found'
  | 'verified'
  | 'rejected'
  | 'corrected'
  | 'todo'
  | 'note'
  | 'question'
  | 'brick_wall';
export type SourceConfidence =
  | 'confirmed'
  | 'probable'
  | 'possible'
  | 'uncertain'
  | 'conflicting'
  | 'speculative'
  | 'high'
  | 'medium'
  | 'low';
export type ResearchStatus =
  | 'not_started'
  | 'in_progress'
  | 'partial'
  | 'verified'
  | 'needs_review'
  | 'brick_wall';

export interface Source {
  id: string;
  person_id: string;
  source_type: SourceType | null;
  source_name: string | null;
  source_url: string | null;
  action: SourceAction;
  content: string | null;
  confidence: SourceConfidence | null;
  validated: boolean;
  validated_date: string | null;
  created_at: string;
  updated_at: string;
}

// Legacy aliases for backwards compatibility
export type ResearchLog = Source;
export type ResearchActionType = SourceAction;
export type ResearchSource = SourceType;
export type ResearchConfidence = SourceConfidence;

export interface ResearchQueueItem {
  id: string;
  legacy_id: string;
  name_full: string;
  birth_year: number | null;
  death_year: number | null;
  research_status: ResearchStatus;
  research_priority: number;
  last_researched: string | null;
  research_notes_count: number;
  latest_note: string | null;
}

export type MediaType = 'photo' | 'document' | 'certificate' | 'other';

export interface Media {
  id: string;
  person_id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  thumbnail_path: string | null;
  media_type: MediaType;
  caption: string | null;
  date_taken: string | null;
  source_attribution: string | null;
  uploaded_by: string | null;
  created_at: string;
}
