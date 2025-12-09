'use client';

import { gql } from '@apollo/client/core';
import { useLazyQuery, useQuery } from '@apollo/client/react';
import { useCallback, useMemo, useState } from 'react';
import type { PedigreeNode } from './tree-types';

// Initial query - fetches 3 generations by default
const ANCESTORS_QUERY = gql`
  query Ancestors($personId: ID!, $generations: Int) {
    ancestors(personId: $personId, generations: $generations) {
      id
      generation
      hasMoreAncestors
      person {
        id
        name_full
        sex
        birth_year
        death_year
        birth_place
        death_place
        living
        familysearch_id
        is_notable
        research_status
        research_priority
        last_researched
        coatOfArms
      }
      father {
        id
        generation
        hasMoreAncestors
        person {
          id
          name_full
          sex
          birth_year
          death_year
          birth_place
          death_place
          living
          familysearch_id
          is_notable
          research_status
          research_priority
          last_researched
          coatOfArms
        }
        father {
          id
          generation
          hasMoreAncestors
          person {
            id
            name_full
            sex
            birth_year
            death_year
            birth_place
            death_place
            living
            familysearch_id
            is_notable
            research_status
            research_priority
            last_researched
            coatOfArms
          }
        }
        mother {
          id
          generation
          hasMoreAncestors
          person {
            id
            name_full
            sex
            birth_year
            death_year
            birth_place
            death_place
            living
            familysearch_id
            is_notable
            research_status
            research_priority
            last_researched
            coatOfArms
          }
        }
      }
      mother {
        id
        generation
        hasMoreAncestors
        person {
          id
          name_full
          sex
          birth_year
          death_year
          birth_place
          death_place
          living
          familysearch_id
          is_notable
          research_status
          research_priority
          last_researched
          coatOfArms
        }
        father {
          id
          generation
          hasMoreAncestors
          person {
            id
            name_full
            sex
            birth_year
            death_year
            birth_place
            death_place
            living
            familysearch_id
            is_notable
            research_status
            research_priority
            last_researched
            coatOfArms
          }
        }
        mother {
          id
          generation
          hasMoreAncestors
          person {
            id
            name_full
            sex
            birth_year
            death_year
            birth_place
            death_place
            living
            familysearch_id
            is_notable
            research_status
            research_priority
            last_researched
            coatOfArms
          }
        }
      }
    }
  }
`;

// Branch expansion query - fetches ancestors for a specific person
const EXPAND_BRANCH_QUERY = gql`
  query ExpandBranch($personId: ID!, $generations: Int) {
    ancestors(personId: $personId, generations: $generations) {
      id
      generation
      hasMoreAncestors
      person {
        id
        name_full
        sex
        birth_year
        death_year
        birth_place
        death_place
        living
        familysearch_id
        is_notable
        research_status
        research_priority
        last_researched
        coatOfArms
      }
      father {
        id
        generation
        hasMoreAncestors
        person { id name_full sex birth_year death_year birth_place death_place living familysearch_id is_notable research_status research_priority last_researched coatOfArms }
      }
      mother {
        id
        generation
        hasMoreAncestors
        person { id name_full sex birth_year death_year birth_place death_place living familysearch_id is_notable research_status research_priority last_researched coatOfArms }
      }
    }
  }
`;

interface UseAncestorTreeOptions {
  rootPersonId: string;
  initialGenerations?: number;
  expansionGenerations?: number;
}

interface UseAncestorTreeResult {
  pedigree: PedigreeNode | null;
  loading: boolean;
  error: Error | undefined;
  expandBranch: (personId: string) => Promise<void>;
  expandedNodes: Set<string>;
  expandingNode: string | null;
}

export function useAncestorTree({
  rootPersonId,
  initialGenerations = 3,
  expansionGenerations = 2,
}: UseAncestorTreeOptions): UseAncestorTreeResult {
  // Track which nodes have been expanded
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandingNode, setExpandingNode] = useState<string | null>(null);

  // Store merged pedigree data
  const [mergedBranches, setMergedBranches] = useState<
    Map<string, PedigreeNode>
  >(new Map());

  // Type for query result
  interface AncestorsQueryResult {
    ancestors: PedigreeNode;
  }

  // Initial query
  const { data, loading, error } = useQuery<AncestorsQueryResult>(
    ANCESTORS_QUERY,
    {
      variables: { personId: rootPersonId, generations: initialGenerations },
      skip: !rootPersonId,
    },
  );

  // Lazy query for branch expansion
  const [fetchBranch] = useLazyQuery<AncestorsQueryResult>(EXPAND_BRANCH_QUERY);

  // Merge expanded branch data into the tree
  const mergeBranch = useCallback(
    (parentId: string, branchData: PedigreeNode) => {
      setMergedBranches((prev) => {
        const next = new Map(prev);
        next.set(parentId, branchData);
        return next;
      });
    },
    [],
  );

  // Expand a branch (fetch more ancestors for a specific person)
  const expandBranch = useCallback(
    async (personId: string) => {
      if (expandedNodes.has(personId)) return;

      setExpandingNode(personId);
      try {
        const result = await fetchBranch({
          variables: { personId, generations: expansionGenerations },
        });

        if (result.data?.ancestors) {
          mergeBranch(personId, result.data.ancestors);
          setExpandedNodes((prev) => new Set([...prev, personId]));
        }
      } finally {
        setExpandingNode(null);
      }
    },
    [expandedNodes, fetchBranch, expansionGenerations, mergeBranch],
  );

  // Build the merged pedigree tree
  const pedigree = useMemo(() => {
    if (!data?.ancestors) return null;

    // Deep clone and merge expanded branches
    const mergeNode = (node: PedigreeNode): PedigreeNode => {
      // Check if this node has been expanded with more data
      const expandedData = mergedBranches.get(node.id);

      if (expandedData && node.hasMoreAncestors) {
        // Replace this node's children with the expanded data
        return {
          ...node,
          hasMoreAncestors: expandedData.hasMoreAncestors,
          father: expandedData.father
            ? mergeNode(expandedData.father)
            : undefined,
          mother: expandedData.mother
            ? mergeNode(expandedData.mother)
            : undefined,
        };
      }

      // Recursively process children
      return {
        ...node,
        father: node.father ? mergeNode(node.father) : undefined,
        mother: node.mother ? mergeNode(node.mother) : undefined,
      };
    };

    return mergeNode(data.ancestors);
  }, [data?.ancestors, mergedBranches]);

  return {
    pedigree,
    loading,
    error: error as Error | undefined,
    expandBranch,
    expandedNodes,
    expandingNode,
  };
}
