'use client';

import { gql } from '@apollo/client/core';
import { useMutation, useQuery } from '@apollo/client/react';
import { select } from 'd3-selection';
import 'd3-transition';
import type { ZoomBehavior } from 'd3-zoom';
import { zoom, zoomIdentity } from 'd3-zoom';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UPDATE_RESEARCH_PRIORITY,
  UPDATE_RESEARCH_STATUS,
} from '@/lib/graphql/queries';
import { PriorityPopup, type PriorityPopupState } from './PriorityPopup';
import { TreeControls } from './TreeControls';
import {
  DEFAULT_LAYOUT_CONFIG,
  type DescendantNode,
  type PedigreeNode,
  toTreePerson,
} from './tree-types';
import { useAncestorTree } from './useAncestorTree';
import { useDescendantTree } from './useDescendantTree';

// Query to fetch root person with siblings and parents for generation -1
const ROOT_PERSON_CONTEXT = gql`
  query RootPersonContext($id: ID!) {
    person(id: $id) {
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
      siblings {
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
      parents {
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
`;

interface FamilyTreeLazyProps {
  rootPersonId: string;
  showAncestors: boolean;
  onPersonClick: (id: string) => void;
  onTileClick: (id: string) => void;
}

interface CrestPopup {
  url: string;
  x: number;
  y: number;
}

export function FamilyTreeLazy({
  rootPersonId,
  showAncestors,
  onPersonClick,
  onTileClick,
}: FamilyTreeLazyProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(
    null,
  );
  const currentTransformRef = useRef<{
    k: number;
    x: number;
    y: number;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [priorityPopup, setPriorityPopup] = useState<PriorityPopupState | null>(
    null,
  );
  const [crestPopup, _setCrestPopup] = useState<CrestPopup | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Track which people have their siblings visible (personId -> boolean)
  const [visibleSiblings, setVisibleSiblings] = useState<Set<string>>(
    new Set(),
  );

  // Use lazy-loading hooks
  const {
    pedigree,
    loading: ancestorLoading,
    error: ancestorError,
    expandBranch: expandAncestorBranch,
    expandingNode: expandingAncestor,
    expandedNodes: expandedAncestors,
  } = useAncestorTree({
    rootPersonId,
    initialGenerations: 3,
    expansionGenerations: 1,
  });

  const {
    tree: descendantTree,
    loading: descendantLoading,
    error: descendantError,
    expandBranch: expandDescendantBranch,
    expandingNode: expandingDescendant,
    expandedNodes: expandedDescendants,
  } = useDescendantTree({
    rootPersonId,
    initialGenerations: 3,
    expansionGenerations: 1,
  });

  // Fetch root person context (siblings and parents) for descendant view
  interface GraphQLPerson {
    id: string;
    name_full: string;
    sex: 'M' | 'F' | null;
    birth_year: number | null;
    death_year: number | null;
    birth_place: string | null;
    death_place: string | null;
    living: boolean;
    familysearch_id: string | null;
    is_notable?: boolean;
    research_status?: string;
    research_priority?: number;
    last_researched?: string;
    coatOfArms?: string | null;
  }
  interface RootPersonContextData {
    person: GraphQLPerson & {
      siblings: GraphQLPerson[];
      parents: GraphQLPerson[];
    };
  }
  const { data: rootContext } = useQuery<RootPersonContextData>(
    ROOT_PERSON_CONTEXT,
    {
      variables: { id: rootPersonId },
      skip: showAncestors, // Only needed for descendant view
    },
  );

  const loading = showAncestors ? ancestorLoading : descendantLoading;
  const error = showAncestors ? ancestorError : descendantError;

  // Mutations for priority/status
  const [updatePriority] = useMutation(UPDATE_RESEARCH_PRIORITY);
  const [updateStatus] = useMutation(UPDATE_RESEARCH_STATUS);

  const handlePriorityChange = useCallback(
    (personId: string, priority: number) => {
      updatePriority({ variables: { id: personId, priority } });
    },
    [updatePriority],
  );

  const handleStatusChange = useCallback(
    (personId: string, status: string) => {
      updateStatus({ variables: { id: personId, status } });
    },
    [updateStatus],
  );

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 400),
          height: Math.max(height, 300),
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Reset transform when root person or view mode changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to reset on rootPersonId/showAncestors change
  useEffect(() => {
    currentTransformRef.current = null;
  }, [rootPersonId, showAncestors]);

  // Toggle sibling visibility for a specific person
  const toggleSiblings = useCallback((personId: string) => {
    setVisibleSiblings((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const svg = svgRef.current;
    if (svg && zoomBehaviorRef.current) {
      select(svg)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    const svg = svgRef.current;
    if (svg && zoomBehaviorRef.current) {
      select(svg)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 0.7);
    }
  }, []);

  const handleResetZoom = useCallback(() => {
    const svg = svgRef.current;
    if (svg && zoomBehaviorRef.current) {
      // Clear saved transform so tree re-centers on next render
      currentTransformRef.current = null;
      select(svg)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.transform, zoomIdentity);
    }
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Keyboard shortcut for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          toggleFullscreen();
        }
      }
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

  // Status colors and labels
  const statusColors: Record<string, string> = {
    not_started: '#9ca3af',
    in_progress: '#3b82f6',
    partial: '#eab308',
    verified: '#22c55e',
    needs_review: '#f97316',
    brick_wall: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    partial: 'Partial',
    verified: 'Verified',
    needs_review: 'Needs Review',
    brick_wall: 'Brick Wall',
  };

  // D3 Rendering - Ancestor Tree
  useEffect(() => {
    if (!svgRef.current || !pedigree || !showAncestors) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const { nodeWidth, nodeHeight, levelGap, nodeGap } = DEFAULT_LAYOUT_CONFIG;

    // Position nodes - assign Y (generation) and X positions
    let leafX = 0;
    const visitedPositions = new Map<string, { x: number; y: number }>();

    const assignPositions = (
      node: PedigreeNode,
      gen: number,
    ): { minX: number; maxX: number } => {
      node.y = gen * (nodeHeight + levelGap);

      const existing = visitedPositions.get(node.id);
      if (existing) {
        node.x = existing.x;
        return { minX: node.x - nodeWidth / 2, maxX: node.x + nodeWidth / 2 };
      }

      const hasParents = node.father || node.mother;

      if (!hasParents) {
        node.x = leafX + nodeWidth / 2;
        leafX += nodeWidth + nodeGap;
        visitedPositions.set(node.id, { x: node.x, y: node.y });
        return { minX: node.x - nodeWidth / 2, maxX: node.x + nodeWidth / 2 };
      }

      let minX = Infinity;
      let maxX = -Infinity;

      if (node.father) {
        const bounds = assignPositions(node.father, gen + 1);
        minX = Math.min(minX, bounds.minX);
        maxX = Math.max(maxX, bounds.maxX);
      }
      if (node.mother) {
        const bounds = assignPositions(node.mother, gen + 1);
        minX = Math.min(minX, bounds.minX);
        maxX = Math.max(maxX, bounds.maxX);
      }

      node.x = (minX + maxX) / 2;
      visitedPositions.set(node.id, { x: node.x, y: node.y });

      return {
        minX: Math.min(minX, node.x - nodeWidth / 2),
        maxX: Math.max(maxX, node.x + nodeWidth / 2),
      };
    };

    assignPositions(pedigree, 0);

    // Collect all nodes
    const allNodes: PedigreeNode[] = [];
    const seenIds = new Set<string>();
    const collectNodes = (node: PedigreeNode) => {
      if (seenIds.has(node.id)) return;
      seenIds.add(node.id);
      allNodes.push(node);
      if (node.father) collectNodes(node.father);
      if (node.mother) collectNodes(node.mother);
    };
    collectNodes(pedigree);

    // Calculate bounds and center
    const padding = 50;
    const minX = Math.min(...allNodes.map((n) => (n.x ?? 0) - nodeWidth / 2));
    const maxX = Math.max(...allNodes.map((n) => (n.x ?? 0) + nodeWidth / 2));
    const maxY = Math.max(...allNodes.map((n) => (n.y ?? 0) + nodeHeight));
    const treeWidth = maxX - minX + padding * 2;
    const _treeHeight = maxY + padding * 2;

    // Setup zoom
    const g = svg.append('g');
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        // Save current transform for next render
        currentTransformRef.current = {
          k: event.transform.k,
          x: event.transform.x,
          y: event.transform.y,
        };
      });

    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    // Use saved transform if available, otherwise center tree
    if (currentTransformRef.current) {
      const { k, x, y } = currentTransformRef.current;
      svg.call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(k));
    } else {
      const initialX = dimensions.width / 2 - (minX + treeWidth / 2 - padding);
      const initialY = padding;
      svg.call(
        zoomBehavior.transform,
        zoomIdentity.translate(initialX, initialY),
      );
    }

    // Draw connecting lines
    const drawnLineKeys = new Set<string>();
    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      const key = `${Math.round(x1)},${Math.round(y1)}-${Math.round(x2)},${Math.round(y2)}`;
      if (drawnLineKeys.has(key)) return;
      drawnLineKeys.add(key);
      g.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 1.5);
    };

    const drawLinks = (node: PedigreeNode, visited = new Set<string>()) => {
      if (!node.x || node.y === undefined) return;
      if (visited.has(node.id)) return;
      visited.add(node.id);

      if (node.father || node.mother) {
        const nodeTop = node.y - nodeHeight / 2;
        const parentY =
          Math.min(node.father?.y ?? Infinity, node.mother?.y ?? Infinity) +
          nodeHeight / 2;
        const midY = nodeTop + (parentY - nodeTop) / 2 - levelGap / 2;

        drawLine(node.x, nodeTop, node.x, midY);

        const parentXs: number[] = [];
        if (node.father?.x !== undefined) parentXs.push(node.father.x);
        if (node.mother?.x !== undefined) parentXs.push(node.mother.x);

        if (parentXs.length > 0) {
          const lineMinX = Math.min(...parentXs);
          const lineMaxX = Math.max(...parentXs);
          drawLine(lineMinX, midY, lineMaxX, midY);

          if (node.father?.x !== undefined && node.father?.y !== undefined) {
            drawLine(
              node.father.x,
              midY,
              node.father.x,
              node.father.y + nodeHeight / 2,
            );
            drawLinks(node.father, visited);
          }
          if (node.mother?.x !== undefined && node.mother?.y !== undefined) {
            drawLine(
              node.mother.x,
              midY,
              node.mother.x,
              node.mother.y + nodeHeight / 2,
            );
            drawLinks(node.mother, visited);
          }
        }
      }
    };
    drawLinks(pedigree);

    // Draw nodes
    for (const node of allNodes) {
      if (node.x === undefined || node.y === undefined) continue;
      if (!node.person) {
        console.error('Node missing person field:', node);
        continue;
      }
      const person = toTreePerson(node.person);
      const isExpanding = expandingAncestor === node.id;
      const status = person.research_status || 'not_started';
      const priority = person.research_priority || 0;

      const nodeG = g
        .append('g')
        .attr(
          'transform',
          `translate(${node.x - nodeWidth / 2},${node.y - nodeHeight / 2})`,
        );

      // Box
      nodeG
        .append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 6)
        .attr(
          'fill',
          person.isNotable
            ? '#fef3c7'
            : person.sex === 'F'
              ? '#fce7f3'
              : '#dbeafe',
        )
        .attr(
          'stroke',
          person.isNotable
            ? '#f59e0b'
            : person.sex === 'F'
              ? '#ec4899'
              : '#3b82f6',
        )
        .attr('stroke-width', person.isNotable ? 3 : 2)
        .style('cursor', 'pointer')
        .on('click', () => onTileClick(person.id))
        .on('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setPriorityPopup({
              personId: person.id,
              personName: person.name,
              x: e.clientX - containerRect.left,
              y: e.clientY - containerRect.top,
              priority,
              status,
            });
          }
        });

      // Crown for notable
      if (person.isNotable) {
        nodeG
          .append('text')
          .attr('x', 8)
          .attr('y', 14)
          .attr('font-size', '12px')
          .text('👑');
      }

      // Status indicator
      const statusG = nodeG.append('g').style('cursor', 'help');
      statusG.append('title').text(statusLabels[status] || 'Unknown status');
      statusG
        .append('circle')
        .attr('cx', nodeWidth - 10)
        .attr('cy', nodeHeight - 10)
        .attr('r', 5)
        .attr('fill', statusColors[status] || '#9ca3af')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

      // Sibling expand button (left edge)
      const hasSiblings =
        node.person.siblings && node.person.siblings.length > 0;
      if (hasSiblings) {
        const siblingsVisible = visibleSiblings.has(person.id);
        const siblingButtonG = nodeG
          .append('g')
          .attr('transform', `translate(-8, ${nodeHeight / 2})`)
          .style('cursor', 'pointer')
          .on('click', (e: MouseEvent) => {
            e.stopPropagation();
            toggleSiblings(person.id);
          });

        siblingButtonG
          .append('circle')
          .attr('r', 6)
          .attr('fill', siblingsVisible ? '#2563eb' : '#fff')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 1.5);

        siblingButtonG
          .append('text')
          .attr('x', 0)
          .attr('y', 1)
          .attr('text-anchor', 'middle')
          .attr('font-size', '8px')
          .attr('font-weight', '700')
          .attr('fill', siblingsVisible ? '#fff' : '#3b82f6')
          .text(siblingsVisible ? '−' : '+');
      }

      // Name
      const maxNameLen = 18;
      const displayName =
        person.name.length > maxNameLen
          ? `${person.name.substring(0, maxNameLen - 2)}…`
          : person.name;
      const nameText = nodeG
        .append('text')
        .attr('x', nodeWidth / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', '#1f2937')
        .style('cursor', 'pointer')
        .on('click', (e: MouseEvent) => {
          e.stopPropagation();
          onPersonClick(person.id);
        })
        .text(displayName);
      nameText.append('title').text(person.name);

      // Years
      const years = person.living
        ? `${person.birth_year || '?'} – Living`
        : `${person.birth_year || '?'} – ${person.death_year || '?'}`;
      nodeG
        .append('text')
        .attr('x', nodeWidth / 2)
        .attr('y', 36)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#6b7280')
        .text(years);

      // Expand/collapse button for nodes with more ancestors
      const isExpanded = expandedAncestors.has(node.id);
      const hasParentsRendered = !!(node.father || node.mother);
      const buttonHeight = 20;
      const buttonY = nodeHeight + 4;

      // Show button if: expanded (for collapse), or has more ancestors and no parents rendered yet, or end of tree
      const shouldShowButton =
        isExpanded ||
        (node.hasMoreAncestors && !hasParentsRendered) ||
        (!node.hasMoreAncestors && !hasParentsRendered);

      if (shouldShowButton) {
        const isEndOfTree =
          !node.hasMoreAncestors && !isExpanded && !hasParentsRendered;
        const expandG = nodeG
          .append('g')
          .attr('transform', `translate(0, ${buttonY})`)
          .style('cursor', isExpanding || isEndOfTree ? 'default' : 'pointer')
          .on('click', (e: MouseEvent) => {
            e.stopPropagation();
            if (!isExpanding && !isEndOfTree) {
              expandAncestorBranch(node.id);
            }
          });

        // Button background
        expandG
          .append('rect')
          .attr('width', nodeWidth)
          .attr('height', buttonHeight)
          .attr('rx', 4)
          .attr(
            'fill',
            isExpanding
              ? '#94a3b8'
              : isEndOfTree
                ? '#e5e7eb'
                : isExpanded
                  ? '#2563eb'
                  : '#3b82f6',
          )
          .attr(
            'stroke',
            isExpanding ? '#64748b' : isEndOfTree ? '#d1d5db' : '#1e40af',
          )
          .attr('stroke-width', 1)
          .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');

        // Button text
        const buttonText = isExpanding
          ? 'Loading...'
          : isEndOfTree
            ? 'End of tree'
            : isExpanded
              ? '▲ Collapse'
              : '▼ Load More';

        expandG
          .append('text')
          .attr('x', nodeWidth / 2)
          .attr('y', buttonHeight / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', isEndOfTree ? '#9ca3af' : '#fff')
          .text(buttonText);
      }

      // Render siblings if visible
      if (
        visibleSiblings.has(person.id) &&
        node.person.siblings &&
        node.person.siblings.length > 0
      ) {
        const siblings = node.person.siblings;
        for (let idx = 0; idx < siblings.length; idx++) {
          const sibling = siblings[idx];
          const siblingPerson = toTreePerson(sibling);
          // Position siblings to the left of the person
          const sibX = (node.x || 0) - (idx + 1) * (nodeWidth + nodeGap);
          const sibY = node.y || 0;

          const siblingG = g
            .append('g')
            .attr(
              'transform',
              `translate(${sibX - nodeWidth / 2},${sibY - nodeHeight / 2})`,
            );

          // Sibling tile (dashed border to indicate sibling)
          siblingG
            .append('rect')
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 6)
            .attr('fill', siblingPerson.sex === 'F' ? '#fce7f3' : '#dbeafe')
            .attr('stroke', siblingPerson.sex === 'F' ? '#ec4899' : '#3b82f6')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4')
            .style('cursor', 'pointer')
            .style('opacity', 0.8)
            .on('click', () => onTileClick(sibling.id));

          // Sibling name
          const siblingName =
            siblingPerson.name.length > 18
              ? `${siblingPerson.name.substring(0, 16)}…`
              : siblingPerson.name;
          siblingG
            .append('text')
            .attr('x', nodeWidth / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('fill', '#1f2937')
            .text(siblingName);

          // Sibling years
          const siblingYears = siblingPerson.living
            ? `${siblingPerson.birth_year || '?'} – Living`
            : `${siblingPerson.birth_year || '?'} – ${siblingPerson.death_year || '?'}`;
          siblingG
            .append('text')
            .attr('x', nodeWidth / 2)
            .attr('y', 36)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#6b7280')
            .text(siblingYears);

          // Sibling indicator icon
          siblingG
            .append('text')
            .attr('x', nodeWidth - 12)
            .attr('y', 14)
            .attr('font-size', '10px')
            .attr('fill', '#9ca3af')
            .text('↔');
        }
      }
    }
  }, [
    pedigree,
    showAncestors,
    dimensions,
    expandAncestorBranch,
    expandingAncestor,
    expandedAncestors,
    onPersonClick,
    onTileClick,
    visibleSiblings,
    toggleSiblings,
  ]);

  // D3 Rendering - Descendant Tree (similar logic)
  useEffect(() => {
    if (!svgRef.current || !descendantTree || showAncestors) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const { nodeWidth, nodeHeight, levelGap, nodeGap, spouseGap } =
      DEFAULT_LAYOUT_CONFIG;

    // Position nodes
    let leafX = 0;

    const assignPositions = (
      node: DescendantNode,
      gen: number,
    ): { minX: number; maxX: number } => {
      // Add extra space at top for generation -1 (parents)
      const topPadding = rootContext?.person?.parents?.length
        ? nodeHeight + levelGap
        : 0;
      node.y = topPadding + gen * (nodeHeight + levelGap);

      if (node.children.length === 0) {
        const totalWidth = node.spouse ? nodeWidth * 2 + spouseGap : nodeWidth;
        node.x = leafX + totalWidth / 2;
        leafX += totalWidth + nodeGap;
        return { minX: node.x - totalWidth / 2, maxX: node.x + totalWidth / 2 };
      }

      let minX = Infinity;
      let maxX = -Infinity;

      for (const child of node.children) {
        const bounds = assignPositions(child, gen + 1);
        minX = Math.min(minX, bounds.minX);
        maxX = Math.max(maxX, bounds.maxX);
      }

      node.x = (minX + maxX) / 2;

      return {
        minX: Math.min(minX, node.x - nodeWidth / 2),
        maxX: Math.max(maxX, node.x + nodeWidth / 2),
      };
    };

    assignPositions(descendantTree, 0);

    // Collect all nodes
    const allNodes: DescendantNode[] = [];
    const collectNodes = (node: DescendantNode) => {
      allNodes.push(node);
      for (const child of node.children) {
        collectNodes(child);
      }
    };
    collectNodes(descendantTree);

    // Calculate bounds
    const padding = 50;
    const minX = Math.min(...allNodes.map((n) => (n.x ?? 0) - nodeWidth));
    const maxX = Math.max(...allNodes.map((n) => (n.x ?? 0) + nodeWidth));
    const _maxY = Math.max(...allNodes.map((n) => (n.y ?? 0) + nodeHeight));

    // Setup zoom
    const g = svg.append('g');
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        // Save current transform for next render
        currentTransformRef.current = {
          k: event.transform.k,
          x: event.transform.x,
          y: event.transform.y,
        };
      });

    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    // Use saved transform if available, otherwise center tree
    if (currentTransformRef.current) {
      const { k, x, y } = currentTransformRef.current;
      svg.call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(k));
    } else {
      const initialX = dimensions.width / 2 - (minX + (maxX - minX) / 2);
      const initialY = padding;
      svg.call(
        zoomBehavior.transform,
        zoomIdentity.translate(initialX, initialY),
      );
    }

    // Draw connecting lines
    const drawLinks = (node: DescendantNode) => {
      if (node.x === undefined || node.y === undefined) return;
      if (node.children.length === 0) return;

      const nodeBottom = node.y + nodeHeight / 2;
      const childrenY = node.children[0]?.y ?? node.y + levelGap;
      const childTop = childrenY - nodeHeight / 2;
      const midY = nodeBottom + (childTop - nodeBottom) / 2;

      // Vertical line down from parent
      g.append('line')
        .attr('x1', node.x)
        .attr('y1', nodeBottom)
        .attr('x2', node.x)
        .attr('y2', midY)
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 1.5);

      // Horizontal line spanning children
      const childXs = node.children.map((c) => c.x ?? 0);
      const minChildX = Math.min(...childXs);
      const maxChildX = Math.max(...childXs);

      g.append('line')
        .attr('x1', minChildX)
        .attr('y1', midY)
        .attr('x2', maxChildX)
        .attr('y2', midY)
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 1.5);

      // Vertical lines down to each child
      for (const child of node.children) {
        if (child.x === undefined || child.y === undefined) continue;
        g.append('line')
          .attr('x1', child.x)
          .attr('y1', midY)
          .attr('x2', child.x)
          .attr('y2', child.y - nodeHeight / 2)
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 1.5);
        drawLinks(child);
      }
    };
    drawLinks(descendantTree);

    // Draw nodes
    for (const node of allNodes) {
      if (node.x === undefined || node.y === undefined) continue;
      if (!node.person) {
        console.error('Node missing person field:', node);
        continue;
      }
      const person = toTreePerson(node.person);
      const isExpanding = expandingDescendant === node.id;
      const status = person.research_status || 'not_started';
      const priority = person.research_priority || 0;

      const nodeG = g
        .append('g')
        .attr(
          'transform',
          `translate(${node.x - nodeWidth / 2},${node.y - nodeHeight / 2})`,
        );

      // Box
      nodeG
        .append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 6)
        .attr('fill', person.sex === 'F' ? '#fce7f3' : '#dbeafe')
        .attr('stroke', person.sex === 'F' ? '#ec4899' : '#3b82f6')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('click', () => onTileClick(person.id))
        .on('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setPriorityPopup({
              personId: person.id,
              personName: person.name,
              x: e.clientX - containerRect.left,
              y: e.clientY - containerRect.top,
              priority,
              status,
            });
          }
        });

      // Name
      const maxNameLen = 18;
      const displayName =
        person.name.length > maxNameLen
          ? `${person.name.substring(0, maxNameLen - 2)}…`
          : person.name;
      nodeG
        .append('text')
        .attr('x', nodeWidth / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', '#1f2937')
        .style('cursor', 'pointer')
        .on('click', (e: MouseEvent) => {
          e.stopPropagation();
          onPersonClick(person.id);
        })
        .text(displayName);

      // Years
      const years = person.living
        ? `${person.birth_year || '?'} – Living`
        : `${person.birth_year || '?'} – ${person.death_year || '?'}`;
      nodeG
        .append('text')
        .attr('x', nodeWidth / 2)
        .attr('y', 36)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#6b7280')
        .text(years);

      // Status indicator
      nodeG
        .append('circle')
        .attr('cx', nodeWidth - 10)
        .attr('cy', nodeHeight - 10)
        .attr('r', 5)
        .attr('fill', statusColors[status] || '#9ca3af')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

      // Sibling expand button (left edge)
      const hasSiblings =
        node.person.siblings && node.person.siblings.length > 0;
      if (hasSiblings) {
        const siblingsVisible = visibleSiblings.has(person.id);
        const siblingButtonG = nodeG
          .append('g')
          .attr('transform', `translate(-8, ${nodeHeight / 2})`)
          .style('cursor', 'pointer')
          .on('click', (e: MouseEvent) => {
            e.stopPropagation();
            toggleSiblings(person.id);
          });

        siblingButtonG
          .append('circle')
          .attr('r', 6)
          .attr('fill', siblingsVisible ? '#2563eb' : '#fff')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 1.5);

        siblingButtonG
          .append('text')
          .attr('x', 0)
          .attr('y', 1)
          .attr('text-anchor', 'middle')
          .attr('font-size', '8px')
          .attr('font-weight', '700')
          .attr('fill', siblingsVisible ? '#fff' : '#3b82f6')
          .text(siblingsVisible ? '−' : '+');
      }

      // Expand/collapse button for nodes with more descendants
      const isExpanded = expandedDescendants.has(node.id);
      const hasChildrenRendered = node.children && node.children.length > 0;
      const buttonHeight = 20;
      const buttonY = nodeHeight + 4;

      // Show button if: expanded (for collapse), or has more descendants and no children rendered yet, or end of tree
      const shouldShowButton =
        isExpanded ||
        (node.hasMoreDescendants && !hasChildrenRendered) ||
        (!node.hasMoreDescendants && !hasChildrenRendered);

      if (shouldShowButton) {
        const isEndOfTree =
          !node.hasMoreDescendants && !isExpanded && !hasChildrenRendered;
        const expandG = nodeG
          .append('g')
          .attr('transform', `translate(0, ${buttonY})`)
          .style('cursor', isExpanding || isEndOfTree ? 'default' : 'pointer')
          .on('click', (e: MouseEvent) => {
            e.stopPropagation();
            if (!isExpanding && !isEndOfTree) {
              expandDescendantBranch(node.id);
            }
          });

        // Button background
        expandG
          .append('rect')
          .attr('width', nodeWidth)
          .attr('height', buttonHeight)
          .attr('rx', 4)
          .attr(
            'fill',
            isExpanding
              ? '#94a3b8'
              : isEndOfTree
                ? '#e5e7eb'
                : isExpanded
                  ? '#16a34a'
                  : '#22c55e',
          )
          .attr(
            'stroke',
            isExpanding ? '#64748b' : isEndOfTree ? '#d1d5db' : '#15803d',
          )
          .attr('stroke-width', 1)
          .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');

        // Button text
        const buttonText = isExpanding
          ? 'Loading...'
          : isEndOfTree
            ? 'End of tree'
            : isExpanded
              ? '▲ Collapse'
              : '▼ Load More';

        expandG
          .append('text')
          .attr('x', nodeWidth / 2)
          .attr('y', buttonHeight / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', isEndOfTree ? '#9ca3af' : '#fff')
          .text(buttonText);
      }

      // Draw spouse next to person
      if (node.spouse) {
        const spouse = toTreePerson(node.spouse);
        const spouseX = node.x + nodeWidth / 2 + spouseGap;

        const spouseG = g
          .append('g')
          .attr(
            'transform',
            `translate(${spouseX},${node.y - nodeHeight / 2})`,
          );

        spouseG
          .append('rect')
          .attr('width', nodeWidth)
          .attr('height', nodeHeight)
          .attr('rx', 6)
          .attr('fill', spouse.sex === 'F' ? '#fce7f3' : '#dbeafe')
          .attr('stroke', spouse.sex === 'F' ? '#ec4899' : '#3b82f6')
          .attr('stroke-width', 2)
          .style('cursor', 'pointer')
          .on('click', () => onTileClick(spouse.id));

        const spouseDisplayName =
          spouse.name.length > maxNameLen
            ? `${spouse.name.substring(0, maxNameLen - 2)}…`
            : spouse.name;
        spouseG
          .append('text')
          .attr('x', nodeWidth / 2)
          .attr('y', 20)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#1f2937')
          .text(spouseDisplayName);

        const spouseYears = spouse.living
          ? `${spouse.birth_year || '?'} – Living`
          : `${spouse.birth_year || '?'} – ${spouse.death_year || '?'}`;
        spouseG
          .append('text')
          .attr('x', nodeWidth / 2)
          .attr('y', 36)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('fill', '#6b7280')
          .text(spouseYears);
      }

      // Render siblings if visible
      if (
        visibleSiblings.has(person.id) &&
        node.person.siblings &&
        node.person.siblings.length > 0
      ) {
        const siblings = node.person.siblings;
        for (let idx = 0; idx < siblings.length; idx++) {
          const sibling = siblings[idx];
          const siblingPerson = toTreePerson(sibling);
          // Position siblings to the left of the person
          const sibX = (node.x || 0) - (idx + 1) * (nodeWidth + nodeGap);
          const sibY = node.y || 0;

          const siblingG = g
            .append('g')
            .attr(
              'transform',
              `translate(${sibX - nodeWidth / 2},${sibY - nodeHeight / 2})`,
            );

          // Sibling tile (dashed border to indicate sibling)
          siblingG
            .append('rect')
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 6)
            .attr('fill', siblingPerson.sex === 'F' ? '#fce7f3' : '#dbeafe')
            .attr('stroke', siblingPerson.sex === 'F' ? '#ec4899' : '#3b82f6')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4')
            .style('cursor', 'pointer')
            .style('opacity', 0.8)
            .on('click', () => onTileClick(sibling.id));

          // Sibling name
          const siblingName =
            siblingPerson.name.length > 18
              ? `${siblingPerson.name.substring(0, 16)}…`
              : siblingPerson.name;
          siblingG
            .append('text')
            .attr('x', nodeWidth / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('fill', '#1f2937')
            .text(siblingName);

          // Sibling years
          const siblingYears = siblingPerson.living
            ? `${siblingPerson.birth_year || '?'} – Living`
            : `${siblingPerson.birth_year || '?'} – ${siblingPerson.death_year || '?'}`;
          siblingG
            .append('text')
            .attr('x', nodeWidth / 2)
            .attr('y', 36)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#6b7280')
            .text(siblingYears);

          // Sibling indicator icon
          siblingG
            .append('text')
            .attr('x', nodeWidth - 12)
            .attr('y', 14)
            .attr('font-size', '10px')
            .attr('fill', '#9ca3af')
            .text('↔');
        }
      }
    }

    // Draw generation -1 (parents) and siblings if available
    if (
      rootContext?.person &&
      descendantTree.x !== undefined &&
      descendantTree.y !== undefined
    ) {
      const rootX = descendantTree.x;
      const rootY = descendantTree.y;
      const parents = rootContext.person.parents || [];
      const maxNameLen = 18;

      // Draw parents at generation -1 (above root)
      if (parents.length > 0) {
        const parentY = rootY - (nodeHeight + levelGap);
        const father = parents.find((p: GraphQLPerson) => p.sex === 'M');
        const mother = parents.find((p: GraphQLPerson) => p.sex === 'F');

        // Position parents side by side
        const fatherX = father ? rootX - nodeWidth / 2 - spouseGap / 2 : rootX;
        const motherX = mother ? rootX + nodeWidth / 2 + spouseGap / 2 : rootX;

        // Draw connecting line from root to parents
        if (father && mother) {
          const midY = (parentY + nodeHeight / 2 + rootY - nodeHeight / 2) / 2;
          g.append('path')
            .attr(
              'd',
              `M${rootX},${rootY - nodeHeight / 2} L${rootX},${midY} L${fatherX + nodeWidth / 2},${midY} L${fatherX + nodeWidth / 2},${parentY + nodeHeight}`,
            )
            .attr('fill', 'none')
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 1.5);
          g.append('path')
            .attr(
              'd',
              `M${motherX - nodeWidth / 2},${midY} L${motherX - nodeWidth / 2},${parentY + nodeHeight}`,
            )
            .attr('fill', 'none')
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 1.5);
        } else if (father || mother) {
          const parentX = father ? fatherX : motherX;
          g.append('path')
            .attr(
              'd',
              `M${rootX},${rootY - nodeHeight / 2} L${parentX + nodeWidth / 2},${parentY + nodeHeight}`,
            )
            .attr('fill', 'none')
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 1.5);
        }

        // Draw father tile
        if (father) {
          const fatherPerson = toTreePerson(father);
          const tileG = g
            .append('g')
            .attr('transform', `translate(${fatherX},${parentY})`)
            .style('cursor', 'pointer')
            .style('opacity', 0.7)
            .on('click', () => onTileClick(father.id));

          tileG
            .append('rect')
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 6)
            .attr('fill', '#dbeafe')
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4');

          const fatherName =
            fatherPerson.name.length > maxNameLen
              ? `${fatherPerson.name.substring(0, maxNameLen - 2)}…`
              : fatherPerson.name;
          tileG
            .append('text')
            .attr('x', nodeWidth / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('fill', '#1f2937')
            .text(fatherName);

          const fatherYears = fatherPerson.living
            ? `${fatherPerson.birth_year || '?'} – Living`
            : `${fatherPerson.birth_year || '?'} – ${fatherPerson.death_year || '?'}`;
          tileG
            .append('text')
            .attr('x', nodeWidth / 2)
            .attr('y', 36)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#6b7280')
            .text(fatherYears);

          // Up arrow indicator
          tileG
            .append('text')
            .attr('x', nodeWidth - 12)
            .attr('y', 14)
            .attr('font-size', '10px')
            .attr('fill', '#9ca3af')
            .text('⬆');
        }

        // Draw mother tile
        if (mother) {
          const motherPerson = toTreePerson(mother);
          const tileG = g
            .append('g')
            .attr('transform', `translate(${motherX},${parentY})`)
            .style('cursor', 'pointer')
            .style('opacity', 0.7)
            .on('click', () => onTileClick(mother.id));

          tileG
            .append('rect')
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 6)
            .attr('fill', '#fce7f3')
            .attr('stroke', '#ec4899')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4');

          const motherName =
            motherPerson.name.length > maxNameLen
              ? `${motherPerson.name.substring(0, maxNameLen - 2)}…`
              : motherPerson.name;
          tileG
            .append('text')
            .attr('x', nodeWidth / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('fill', '#1f2937')
            .text(motherName);

          const motherYears = motherPerson.living
            ? `${motherPerson.birth_year || '?'} – Living`
            : `${motherPerson.birth_year || '?'} – ${motherPerson.death_year || '?'}`;
          tileG
            .append('text')
            .attr('x', nodeWidth / 2)
            .attr('y', 36)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#6b7280')
            .text(motherYears);

          // Up arrow indicator
          tileG
            .append('text')
            .attr('x', nodeWidth - 12)
            .attr('y', 14)
            .attr('font-size', '10px')
            .attr('fill', '#9ca3af')
            .text('⬆');
        }
      }
    }
  }, [
    descendantTree,
    showAncestors,
    dimensions,
    expandDescendantBranch,
    expandingDescendant,
    expandedDescendants,
    onPersonClick,
    onTileClick,
    rootContext,
    visibleSiblings,
    toggleSiblings,
  ]);

  // Container classes for fullscreen mode
  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-white'
    : 'relative w-full h-full';

  return (
    <div
      className={containerClasses}
      ref={containerRef}
      onClick={() => setPriorityPopup(null)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setPriorityPopup(null);
        }
      }}
      role="application"
      tabIndex={-1}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg"
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-600">
          Failed to load data: {error.message}
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--muted-foreground)]">
          Loading...
        </div>
      )}

      {/* Tree Controls */}
      <TreeControls
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
      />

      {/* Priority Popup */}
      {priorityPopup && (
        <PriorityPopup
          popup={priorityPopup}
          onClose={() => setPriorityPopup(null)}
          onPriorityChange={handlePriorityChange}
          onStatusChange={handleStatusChange}
          onPopupUpdate={(updates) =>
            setPriorityPopup((prev) => (prev ? { ...prev, ...updates } : null))
          }
        />
      )}

      {/* Crest Hover Popup */}
      {crestPopup && (
        <div
          className="absolute pointer-events-none z-50"
          style={{ left: crestPopup.x, top: crestPopup.y }}
        >
          <div className="bg-[var(--card)] rounded-lg shadow-xl border-2 border-amber-400 p-2">
            <div className="relative w-36 h-36">
              <Image
                src={crestPopup.url}
                alt="Coat of Arms"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
