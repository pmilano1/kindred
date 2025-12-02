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

