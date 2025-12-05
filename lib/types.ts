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
}

export interface Residence {
  id: number;
  person_id: string;
  residence_date: string | null;
  residence_year: number | null;
  residence_place: string | null;
}

export interface Occupation {
  id: number;
  person_id: string;
  title: string | null;
  occupation_date: string | null;
  occupation_place: string | null;
}

export interface Event {
  id: number;
  person_id: string;
  event_type: string | null;
  event_date: string | null;
  event_place: string | null;
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
}

export interface TreeNode {
  id: string;
  name: string;
  sex: 'M' | 'F' | null;
  birth_year: number | null;
  death_year: number | null;
  living: boolean;
  children?: TreeNode[];
  spouse?: {
    id: string;
    name: string;
  };
}

// Unified Source type - combines sources and research activity
export type SourceType = 'FamilySearch' | 'Geni' | 'Ancestry' | 'MyHeritage' | 'FindAGrave' | 'ANOM' | 'Geneanet' | 'WikiTree' | 'Newspapers' | 'Census' | 'VitalRecords' | 'ChurchRecords' | 'Immigration' | 'Military' | 'DNA' | 'FamilyBible' | 'Interview' | 'Other';
export type SourceAction = 'searched' | 'found' | 'verified' | 'rejected' | 'corrected' | 'todo' | 'note' | 'question' | 'brick_wall';
export type SourceConfidence = 'confirmed' | 'probable' | 'possible' | 'uncertain' | 'conflicting' | 'speculative' | 'high' | 'medium' | 'low';
export type ResearchStatus = 'not_started' | 'in_progress' | 'partial' | 'verified' | 'needs_review' | 'brick_wall';

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
