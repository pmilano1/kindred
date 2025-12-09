'use client';

import { gql } from '@apollo/client/core';
import { useLazyQuery, useQuery } from '@apollo/client/react';
import { useCallback, useMemo, useState } from 'react';
import type { DescendantNode } from './tree-types';

// Fragment for person fields to reduce duplication
const PERSON_FIELDS = `
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
  expansionGenerations = 2,
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
      if (expandedNodes.has(personId)) return;

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

    const mergeNode = (node: DescendantNode): DescendantNode => {
      const expandedData = mergedBranches.get(node.id);

      if (expandedData && node.hasMoreDescendants) {
        return {
          ...node,
          hasMoreDescendants: expandedData.hasMoreDescendants,
          children: expandedData.children.map(mergeNode),
        };
      }

      return {
        ...node,
        children: node.children.map(mergeNode),
      };
    };

    return mergeNode(data.descendants);
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
