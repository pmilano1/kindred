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
  burial_place: string | null;
  living: boolean;
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

