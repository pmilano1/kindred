'use client';

import { gql } from '@apollo/client/core';
import { useLazyQuery, useQuery } from '@apollo/client/react';
import { useCallback, useMemo, useState } from 'react';
import type {
  DescendantNode,
  FamilyTreeNode,
  PedigreeNode,
} from './tree-types';

// Optimized person fields - only what's needed for tree rendering
const PERSON_FIELDS = `
  id
  name_full
  sex
  birth_year
  death_year
  living
  is_notable
  research_status
  research_priority
  siblings {
    id
    name_full
    sex
    birth_year
    death_year
    living
  }
`;

// Query for ancestors (same as useAncestorTree)
const ANCESTORS_QUERY = gql`
  query Ancestors($personId: ID!, $generations: Int) {
    ancestors(personId: $personId, generations: $generations) {
      id
      generation
      hasMoreAncestors
      person { ${PERSON_FIELDS} }
      father {
        id
        generation
        hasMoreAncestors
        person { ${PERSON_FIELDS} }
        father {
          id
          generation
          hasMoreAncestors
          person { ${PERSON_FIELDS} }
          father { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
          mother { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
        }
        mother {
          id
          generation
          hasMoreAncestors
          person { ${PERSON_FIELDS} }
          father { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
          mother { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
        }
      }
      mother {
        id
        generation
        hasMoreAncestors
        person { ${PERSON_FIELDS} }
        father {
          id
          generation
          hasMoreAncestors
          person { ${PERSON_FIELDS} }
          father { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
          mother { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
        }
        mother {
          id
          generation
          hasMoreAncestors
          person { ${PERSON_FIELDS} }
          father { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
          mother { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
        }
      }
    }
  }
`;

// Query for descendants (same as useDescendantTree)
const DESCENDANTS_QUERY = gql`
  query Descendants($personId: ID!, $generations: Int) {
    descendants(personId: $personId, generations: $generations) {
      id
      generation
      hasMoreDescendants
      marriageYear
      person { ${PERSON_FIELDS} }
      spouse { ${PERSON_FIELDS} }
      children {
        id
        generation
        hasMoreDescendants
        marriageYear
        person { ${PERSON_FIELDS} }
        spouse { ${PERSON_FIELDS} }
        children {
          id
          generation
          hasMoreDescendants
          marriageYear
          person { ${PERSON_FIELDS} }
          spouse { ${PERSON_FIELDS} }
          children {
            id
            generation
            hasMoreDescendants
            marriageYear
            person { ${PERSON_FIELDS} }
            spouse { ${PERSON_FIELDS} }
            children {
              id
              generation
              hasMoreDescendants
              marriageYear
              person { ${PERSON_FIELDS} }
              spouse { ${PERSON_FIELDS} }
            }
          }
        }
      }
    }
  }
`;

// Branch expansion queries
const EXPAND_ANCESTORS_QUERY = gql`
  query ExpandAncestors($personId: ID!, $generations: Int) {
    ancestors(personId: $personId, generations: $generations) {
      id
      generation
      hasMoreAncestors
      person { ${PERSON_FIELDS} }
      father {
        id
        generation
        hasMoreAncestors
        person { ${PERSON_FIELDS} }
        father { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
        mother { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
      }
      mother {
        id
        generation
        hasMoreAncestors
        person { ${PERSON_FIELDS} }
        father { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
        mother { id generation hasMoreAncestors person { ${PERSON_FIELDS} } }
      }
    }
  }
`;

const EXPAND_DESCENDANTS_QUERY = gql`
  query ExpandDescendants($personId: ID!, $generations: Int) {
    descendants(personId: $personId, generations: $generations) {
      id
      generation
      hasMoreDescendants
      marriageYear
      person { ${PERSON_FIELDS} }
      spouse { ${PERSON_FIELDS} }
      children {
        id
        generation
        hasMoreDescendants
        marriageYear
        person { ${PERSON_FIELDS} }
        spouse { ${PERSON_FIELDS} }
        children {
          id
          generation
          hasMoreDescendants
          marriageYear
          person { ${PERSON_FIELDS} }
          spouse { ${PERSON_FIELDS} }
          children {
            id
            generation
            hasMoreDescendants
          }
        }
      }
    }
  }
`;

interface UseFamilyTreeOptions {
  rootPersonId: string;
  initialGenerations?: number;
  expansionGenerations?: number;
}

interface UseFamilyTreeResult {
  tree: FamilyTreeNode | null;
  loading: boolean;
  error: Error | undefined;
  expandAncestors: (personId: string) => Promise<void>;
  expandDescendants: (personId: string) => Promise<void>;
  expandedAncestors: Set<string>;
  expandedDescendants: Set<string>;
  expandingNode: string | null;
}

// GraphQL query response types
interface AncestorsQueryData {
  ancestors: PedigreeNode;
}

interface DescendantsQueryData {
  descendants: DescendantNode;
}

export function useFamilyTree({
  rootPersonId,
  initialGenerations = 3,
  expansionGenerations = 1,
}: UseFamilyTreeOptions): UseFamilyTreeResult {
  // Track which nodes have been expanded in each direction
  const [expandedAncestors, setExpandedAncestors] = useState<Set<string>>(
    new Set(),
  );
  const [expandedDescendants, setExpandedDescendants] = useState<Set<string>>(
    new Set(),
  );
  const [expandingNode, setExpandingNode] = useState<string | null>(null);

  // Store merged branches
  const [mergedAncestorBranches, setMergedAncestorBranches] = useState<
    Map<string, PedigreeNode>
  >(new Map());
  const [mergedDescendantBranches, setMergedDescendantBranches] = useState<
    Map<string, DescendantNode>
  >(new Map());

  // Fetch initial ancestors and descendants in parallel
  const {
    data: ancestorData,
    loading: ancestorLoading,
    error: ancestorError,
  } = useQuery<AncestorsQueryData>(ANCESTORS_QUERY, {
    variables: { personId: rootPersonId, generations: initialGenerations },
    skip: !rootPersonId,
  });

  const {
    data: descendantData,
    loading: descendantLoading,
    error: descendantError,
  } = useQuery<DescendantsQueryData>(DESCENDANTS_QUERY, {
    variables: { personId: rootPersonId, generations: initialGenerations },
    skip: !rootPersonId,
  });

  // Lazy queries for expansion
  const [fetchAncestorBranch] = useLazyQuery<AncestorsQueryData>(
    EXPAND_ANCESTORS_QUERY,
  );
  const [fetchDescendantBranch] = useLazyQuery<DescendantsQueryData>(
    EXPAND_DESCENDANTS_QUERY,
  );

  const loading = ancestorLoading || descendantLoading;
  const error = ancestorError || descendantError;

  // Convert PedigreeNode to FamilyTreeNode
  const convertPedigreeToFamily = useCallback(
    (node: PedigreeNode): FamilyTreeNode => {
      return {
        id: node.id,
        person: node.person,
        father: node.father ? convertPedigreeToFamily(node.father) : undefined,
        mother: node.mother ? convertPedigreeToFamily(node.mother) : undefined,
        children: [],
        generation: node.generation,
        hasMoreAncestors: node.hasMoreAncestors,
        hasMoreDescendants: false,
        x: node.x,
        y: node.y,
        isNotableBranch: node.isNotableBranch,
      };
    },
    [],
  );

  // Convert DescendantNode to FamilyTreeNode
  const convertDescendantToFamily = useCallback(
    (node: DescendantNode): FamilyTreeNode => {
      return {
        id: node.id,
        person: node.person,
        spouse: node.spouse,
        marriageYear: node.marriageYear,
        children: node.children.map(convertDescendantToFamily),
        generation: -node.generation, // Negative for descendants
        hasMoreAncestors: false,
        hasMoreDescendants: node.hasMoreDescendants,
        x: node.x,
        y: node.y,
      };
    },
    [],
  );

  // Merge ancestor and descendant data into unified tree
  const tree = useMemo(() => {
    if (!ancestorData?.ancestors || !descendantData?.descendants) return null;

    // Start with the root person from ancestors
    const rootNode = convertPedigreeToFamily(ancestorData.ancestors);

    // Merge in descendant data
    const descendantRoot = descendantData.descendants;
    rootNode.spouse = descendantRoot.spouse;
    rootNode.marriageYear = descendantRoot.marriageYear;
    rootNode.children = descendantRoot.children.map(convertDescendantToFamily);
    rootNode.hasMoreDescendants = descendantRoot.hasMoreDescendants;

    // Apply expanded ancestor branches
    const mergeAncestorBranch = (node: FamilyTreeNode): FamilyTreeNode => {
      const expandedData = mergedAncestorBranches.get(node.id);
      if (expandedData && node.hasMoreAncestors) {
        return {
          ...node,
          father: expandedData.father
            ? convertPedigreeToFamily(expandedData.father)
            : node.father,
          mother: expandedData.mother
            ? convertPedigreeToFamily(expandedData.mother)
            : node.mother,
          hasMoreAncestors: expandedData.hasMoreAncestors,
        };
      }
      return {
        ...node,
        father: node.father ? mergeAncestorBranch(node.father) : undefined,
        mother: node.mother ? mergeAncestorBranch(node.mother) : undefined,
      };
    };

    // Apply expanded descendant branches
    const mergeDescendantBranch = (node: FamilyTreeNode): FamilyTreeNode => {
      const expandedData = mergedDescendantBranches.get(node.id);
      if (expandedData && node.hasMoreDescendants) {
        return {
          ...node,
          children: expandedData.children.map(convertDescendantToFamily),
          hasMoreDescendants: expandedData.hasMoreDescendants,
        };
      }
      return {
        ...node,
        children: node.children.map(mergeDescendantBranch),
      };
    };

    let merged = mergeAncestorBranch(rootNode);
    merged = mergeDescendantBranch(merged);

    return merged;
  }, [
    ancestorData,
    descendantData,
    mergedAncestorBranches,
    mergedDescendantBranches,
    convertPedigreeToFamily,
    convertDescendantToFamily,
  ]);

  // Expand ancestors for a person
  const expandAncestors = useCallback(
    async (personId: string) => {
      // If already expanded, collapse it
      if (expandedAncestors.has(personId)) {
        setExpandedAncestors((prev) => {
          const next = new Set(prev);
          next.delete(personId);
          return next;
        });
        setMergedAncestorBranches((prev) => {
          const next = new Map(prev);
          next.delete(personId);
          return next;
        });
        return;
      }

      // Otherwise, expand it
      setExpandingNode(personId);
      try {
        const result = await fetchAncestorBranch({
          variables: { personId, generations: expansionGenerations },
        });

        if (result.data?.ancestors) {
          setMergedAncestorBranches((prev) =>
            new Map(prev).set(personId, result.data?.ancestors),
          );
          setExpandedAncestors((prev) => new Set([...prev, personId]));
        }
      } finally {
        setExpandingNode(null);
      }
    },
    [expandedAncestors, fetchAncestorBranch, expansionGenerations],
  );

  // Expand descendants for a person
  const expandDescendants = useCallback(
    async (personId: string) => {
      // If already expanded, collapse it
      if (expandedDescendants.has(personId)) {
        setExpandedDescendants((prev) => {
          const next = new Set(prev);
          next.delete(personId);
          return next;
        });
        setMergedDescendantBranches((prev) => {
          const next = new Map(prev);
          next.delete(personId);
          return next;
        });
        return;
      }

      // Otherwise, expand it
      setExpandingNode(personId);
      try {
        const result = await fetchDescendantBranch({
          variables: { personId, generations: expansionGenerations },
        });

        if (result.data?.descendants) {
          setMergedDescendantBranches((prev) =>
            new Map(prev).set(personId, result.data?.descendants),
          );
          setExpandedDescendants((prev) => new Set([...prev, personId]));
        }
      } finally {
        setExpandingNode(null);
      }
    },
    [expandedDescendants, fetchDescendantBranch, expansionGenerations],
  );

  return {
    tree,
    loading,
    error: error as Error | undefined,
    expandAncestors,
    expandDescendants,
    expandedAncestors,
    expandedDescendants,
    expandingNode,
  };
}
