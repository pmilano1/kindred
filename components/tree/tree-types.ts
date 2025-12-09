// Shared types for the FamilyTree component suite

// Person data as used in tree rendering
export interface TreePerson {
  id: string;
  name: string;
  sex: 'M' | 'F' | null;
  birth_year: number | null;
  death_year: number | null;
  living: boolean;
  isNotable?: boolean;
  research_status?: string;
  research_priority?: number;
}

// GraphQL Person type (as returned from API)
export interface GraphQLPerson {
  id: string;
  name_full: string;
  sex: 'M' | 'F' | null;
  birth_year: number | null;
  death_year: number | null;
  living: boolean;
  is_notable?: boolean;
  research_status?: string;
  research_priority?: number;
}

// Pedigree node for ancestor view (from GraphQL)
export interface PedigreeNode {
  id: string;
  person: GraphQLPerson;
  father?: PedigreeNode;
  mother?: PedigreeNode;
  generation: number;
  hasMoreAncestors: boolean;
  // Layout properties (set during rendering)
  x?: number;
  y?: number;
  isNotableBranch?: boolean;
}

// Descendant node for descendant view (from GraphQL)
export interface DescendantNode {
  id: string;
  person: GraphQLPerson;
  spouse?: GraphQLPerson;
  marriageYear?: number;
  children: DescendantNode[];
  generation: number;
  hasMoreDescendants: boolean;
  // Layout properties (set during rendering)
  x?: number;
  y?: number;
}

// Notable relative info
export interface NotableRelative {
  person: { id: string; name_full: string };
  generation: number;
}

// Convert GraphQL person to TreePerson for rendering
export function toTreePerson(p: GraphQLPerson): TreePerson {
  return {
    id: p.id,
    name: p.name_full,
    sex: p.sex,
    birth_year: p.birth_year,
    death_year: p.death_year,
    living: p.living,
    isNotable: p.is_notable,
    research_status: p.research_status,
    research_priority: p.research_priority,
  };
}

// Expanded branches state - tracks which nodes have been expanded
export interface ExpansionState {
  // Map of personId -> expanded (fetched more generations)
  expandedNodes: Set<string>;
}

// Tree layout configuration
export interface TreeLayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  levelGap: number; // Vertical gap between generations
  nodeGap: number; // Horizontal gap between nodes
  spouseGap: number; // Gap between person and spouse
}

export const DEFAULT_LAYOUT_CONFIG: TreeLayoutConfig = {
  nodeWidth: 115,
  nodeHeight: 42,
  levelGap: 60,
  nodeGap: 8,
  spouseGap: 4,
};

// Priority popup state
export interface PriorityPopupState {
  personId: string;
  x: number;
  y: number;
}

// Status options for research tracking
export const STATUS_OPTIONS = [
  {
    value: 'not_started',
    label: '⚪ Not Started',
    desc: 'No research done yet',
  },
  {
    value: 'in_progress',
    label: '🔵 In Progress',
    desc: 'Currently being researched',
  },
  {
    value: 'partial',
    label: '🟡 Partial',
    desc: 'Some info found, more needed',
  },
  {
    value: 'verified',
    label: '🟢 Verified',
    desc: 'Research complete, sources confirmed',
  },
  {
    value: 'needs_review',
    label: '🟠 Needs Review',
    desc: 'Conflicting info, needs verification',
  },
  {
    value: 'brick_wall',
    label: '🔴 Brick Wall',
    desc: 'Cannot find more info',
  },
] as const;
