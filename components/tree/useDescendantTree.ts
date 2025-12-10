'use client';

import { gql } from '@apollo/client/core';
import { useLazyQuery, useQuery } from '@apollo/client/react';
import { useCallback, useMemo, useState } from 'react';
import type { DescendantNode } from './tree-types';

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

// Initial query - fetches 3 generations by default
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

// Branch expansion query
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

interface UseDescendantTreeOptions {
  rootPersonId: string;
  initialGenerations?: number;
  expansionGenerations?: number;
}

interface UseDescendantTreeResult {
  tree: DescendantNode | null;
  loading: boolean;
  error: Error | undefined;
  expandBranch: (personId: string) => Promise<void>;
  expandedNodes: Set<string>;
  expandingNode: string | null;
}

export function useDescendantTree({
  rootPersonId,
  initialGenerations = 3,
  expansionGenerations = 1,
}: UseDescendantTreeOptions): UseDescendantTreeResult {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandingNode, setExpandingNode] = useState<string | null>(null);
  const [mergedBranches, setMergedBranches] = useState<
    Map<string, DescendantNode>
  >(new Map());

  // Type for query result
  interface DescendantsQueryResult {
    descendants: DescendantNode;
  }

  const { data, loading, error } = useQuery<DescendantsQueryResult>(
    DESCENDANTS_QUERY,
    {
      variables: { personId: rootPersonId, generations: initialGenerations },
      skip: !rootPersonId,
    },
  );

  const [fetchBranch] = useLazyQuery<DescendantsQueryResult>(
    EXPAND_DESCENDANTS_QUERY,
  );

  const mergeBranch = useCallback(
    (parentId: string, branchData: DescendantNode) => {
      setMergedBranches((prev) => {
        const next = new Map(prev);
        next.set(parentId, branchData);
        return next;
      });
    },
    [],
  );

  const expandBranch = useCallback(
    async (personId: string) => {
      // If already expanded, collapse it
      if (expandedNodes.has(personId)) {
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.delete(personId);
          return next;
        });
        setMergedBranches((prev) => {
          const next = new Map(prev);
          next.delete(personId);
          return next;
        });
        return;
      }

      // Otherwise, expand it
      setExpandingNode(personId);
      try {
        const result = await fetchBranch({
          variables: { personId, generations: expansionGenerations },
        });

        if (result.data?.descendants) {
          mergeBranch(personId, result.data.descendants);
          setExpandedNodes((prev) => new Set([...prev, personId]));
        }
      } finally {
        setExpandingNode(null);
      }
    },
    [expandedNodes, fetchBranch, expansionGenerations, mergeBranch],
  );

  const tree = useMemo(() => {
    if (!data?.descendants) return null;

    // Track visited nodes to prevent infinite recursion from circular relationships
    const visited = new Set<string>();

    const mergeNode = (node: DescendantNode): DescendantNode | null => {
      // Cycle detection: if we've already visited this node, return null to break the cycle
      if (visited.has(node.id)) {
        console.warn(
          `Circular relationship detected for person ${node.id} in descendant tree`,
        );
        return null;
      }

      visited.add(node.id);

      const expandedData = mergedBranches.get(node.id);

      if (expandedData && node.hasMoreDescendants) {
        const children = expandedData.children
          .map(mergeNode)
          .filter((child): child is DescendantNode => child !== null);

        return {
          ...node,
          hasMoreDescendants: expandedData.hasMoreDescendants,
          children,
        };
      }

      const children = node.children
        .map(mergeNode)
        .filter((child): child is DescendantNode => child !== null);

      return {
        ...node,
        children,
      };
    };

    const result = mergeNode(data.descendants);
    return result || data.descendants; // Fallback to original data if cycle detected at root
  }, [data?.descendants, mergedBranches]);

  return {
    tree,
    loading,
    error: error as Error | undefined,
    expandBranch,
    expandedNodes,
    expandingNode,
  };
}
