'use client';

import { useMutation } from '@apollo/client/react';
import { select } from 'd3-selection';
import 'd3-transition';
import type { ZoomBehavior } from 'd3-zoom';
import { zoom, zoomIdentity } from 'd3-zoom';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UPDATE_RESEARCH_PRIORITY,
  UPDATE_RESEARCH_STATUS,
} from '@/lib/graphql/queries';
import { PriorityPopup, type PriorityPopupState } from './PriorityPopup';
import { TreeControls } from './TreeControls';
import {
  DEFAULT_LAYOUT_CONFIG,
  type FamilyTreeNode,
  toTreePerson,
} from './tree-types';
import { useFamilyTree } from './useFamilyTree';

interface FamilyTreeUnifiedProps {
  rootPersonId: string;
  onPersonClick: (id: string) => void;
  onTileClick: (id: string) => void;
}

export function FamilyTreeUnified({
  rootPersonId,
  onPersonClick,
  onTileClick,
}: FamilyTreeUnifiedProps) {
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [_visibleSiblings, setVisibleSiblings] = useState<Set<string>>(
    new Set(),
  );

  // Use unified family tree hook
  const {
    tree,
    loading,
    error,
    expandAncestors,
    expandDescendants,
    expandedAncestors,
    expandedDescendants,
    expandingNode,
  } = useFamilyTree({
    rootPersonId,
    initialGenerations: 3,
    expansionGenerations: 1,
  });

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

  // Reset transform when root person changes
  useEffect(() => {
    currentTransformRef.current = null;
  }, []);

  // Toggle sibling visibility
  const _toggleSiblings = useCallback((personId: string) => {
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

  // Keyboard shortcuts
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

  const _statusLabels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    partial: 'Partial',
    verified: 'Verified',
    needs_review: 'Needs Review',
    brick_wall: 'Brick Wall',
  };

  // D3 Rendering - Unified Bidirectional Tree
  useEffect(() => {
    if (!svgRef.current || !tree) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const { nodeWidth, nodeHeight, levelGap, nodeGap, spouseGap } =
      DEFAULT_LAYOUT_CONFIG;

    // Position nodes - assign X and Y positions
    // Generation 0 = root (Y = 0)
    // Positive generations = ancestors (Y increases downward)
    // Negative generations = descendants (Y decreases upward)
    let leafX = 0;
    const visitedPositions = new Map<string, { x: number; y: number }>();

    // Assign positions for ancestors (recursive upward)
    const assignAncestorPositions = (
      node: FamilyTreeNode,
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
        const bounds = assignAncestorPositions(node.father, gen + 1);
        minX = Math.min(minX, bounds.minX);
        maxX = Math.max(maxX, bounds.maxX);
      }
      if (node.mother) {
        const bounds = assignAncestorPositions(node.mother, gen + 1);
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

    // Assign positions for descendants (recursive downward)
    const assignDescendantPositions = (
      node: FamilyTreeNode,
      gen: number,
    ): { minX: number; maxX: number } => {
      node.y = gen * (nodeHeight + levelGap);

      if (node.children.length === 0) {
        const totalWidth = node.spouse ? nodeWidth * 2 + spouseGap : nodeWidth;
        node.x = leafX + totalWidth / 2;
        leafX += totalWidth + nodeGap;
        return { minX: node.x - totalWidth / 2, maxX: node.x + totalWidth / 2 };
      }

      let minX = Infinity;
      let maxX = -Infinity;

      for (const child of node.children) {
        const bounds = assignDescendantPositions(child, gen - 1);
        minX = Math.min(minX, bounds.minX);
        maxX = Math.max(maxX, bounds.maxX);
      }

      // Center the person tile over children
      // If there's a spouse, the person tile is on the left, so offset accordingly
      const childrenCenter = (minX + maxX) / 2;
      if (node.spouse) {
        // Person tile is on left, spouse on right
        // Center the pair over children
        const pairWidth = nodeWidth * 2 + spouseGap;
        node.x = childrenCenter - spouseGap / 2 - nodeWidth / 2;
      } else {
        node.x = childrenCenter;
      }

      const totalWidth = node.spouse ? nodeWidth * 2 + spouseGap : nodeWidth;
      return {
        minX: Math.min(minX, node.x - nodeWidth / 2),
        maxX: Math.max(maxX, node.x + totalWidth - nodeWidth / 2),
      };
    };

    // Position ancestors first
    leafX = 0;
    assignAncestorPositions(tree, 0);

    // Position descendants
    leafX = 0;
    if (tree.children.length > 0) {
      for (const child of tree.children) {
        assignDescendantPositions(child, -1);
      }
    }

    // Collect all nodes
    const allNodes: FamilyTreeNode[] = [];
    const seenIds = new Set<string>();
    const collectNodes = (node: FamilyTreeNode) => {
      if (seenIds.has(node.id)) return;
      seenIds.add(node.id);
      allNodes.push(node);
      if (node.father) collectNodes(node.father);
      if (node.mother) collectNodes(node.mother);
      for (const child of node.children) {
        collectNodes(child);
      }
    };
    collectNodes(tree);

    // Calculate bounds and center
    const padding = 50;
    const minX = Math.min(...allNodes.map((n) => (n.x ?? 0) - nodeWidth / 2));
    const maxX = Math.max(...allNodes.map((n) => (n.x ?? 0) + nodeWidth / 2));
    const minY = Math.min(...allNodes.map((n) => (n.y ?? 0) - nodeHeight / 2));
    const maxY = Math.max(...allNodes.map((n) => (n.y ?? 0) + nodeHeight / 2));
    const _treeWidth = maxX - minX + padding * 2;
    const _treeHeight = maxY - minY + padding * 2;

    // Setup zoom
    const g = svg.append('g');
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
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
      const initialY = dimensions.height / 2 - (minY + (maxY - minY) / 2);
      svg.call(
        zoomBehavior.transform,
        zoomIdentity.translate(initialX, initialY),
      );
    }

    // Draw links for ancestors (parent-child connections)
    const drawAncestorLinks = (node: FamilyTreeNode) => {
      if (node.x === undefined || node.y === undefined) return;

      const _nodeTop = node.y - nodeHeight / 2;
      const nodeBottom = node.y + nodeHeight / 2;

      // Draw lines to parents
      const parents = [node.father, node.mother].filter(
        Boolean,
      ) as FamilyTreeNode[];
      if (parents.length > 0) {
        const parentY = parents[0]?.y ?? node.y + levelGap;
        const parentTop = parentY - nodeHeight / 2;
        const midY = nodeBottom + (parentTop - nodeBottom) / 2;

        // Vertical line down from child
        g.append('line')
          .attr('x1', node.x)
          .attr('y1', nodeBottom)
          .attr('x2', node.x)
          .attr('y2', midY)
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 1.5);

        // Horizontal line spanning parents
        const parentXs = parents.map((p) => p.x ?? 0);
        const minParentX = Math.min(...parentXs);
        const maxParentX = Math.max(...parentXs);

        if (parents.length > 1) {
          g.append('line')
            .attr('x1', minParentX)
            .attr('y1', midY)
            .attr('x2', maxParentX)
            .attr('y2', midY)
            .attr('stroke', '#94a3b8')
            .attr('stroke-width', 1.5);
        }

        // Vertical lines up to each parent
        for (const parent of parents) {
          if (parent.x === undefined || parent.y === undefined) continue;
          g.append('line')
            .attr('x1', parent.x)
            .attr('y1', midY)
            .attr('x2', parent.x)
            .attr('y2', parent.y - nodeHeight / 2)
            .attr('stroke', '#94a3b8')
            .attr('stroke-width', 1.5);
          drawAncestorLinks(parent);
        }
      }
    };

    // Draw links for descendants (parent-child connections)
    const drawDescendantLinks = (node: FamilyTreeNode) => {
      if (node.x === undefined || node.y === undefined) return;
      if (node.children.length === 0) return;

      const nodeTop = node.y - nodeHeight / 2;
      const childrenY = node.children[0]?.y ?? node.y - levelGap;
      const childBottom = childrenY + nodeHeight / 2;
      const midY = nodeTop - (nodeTop - childBottom) / 2;

      // Vertical line up from parent
      g.append('line')
        .attr('x1', node.x)
        .attr('y1', nodeTop)
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
          .attr('y2', child.y + nodeHeight / 2)
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 1.5);
        drawDescendantLinks(child);
      }
    };

    // Draw all links
    drawAncestorLinks(tree);
    drawDescendantLinks(tree);

    // Draw nodes
    for (const node of allNodes) {
      if (node.x === undefined || node.y === undefined) continue;
      if (!node.person) continue;

      const person = toTreePerson(node.person);
      const isExpandingAncestors =
        expandingNode === node.id && expandedAncestors.has(node.id);
      const isExpandingDescendants =
        expandingNode === node.id && expandedDescendants.has(node.id);
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
        .attr('y', 32)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('fill', '#6b7280')
        .text(years);

      // Status indicator (left edge)
      if (status !== 'not_started') {
        nodeG
          .append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', 4)
          .attr('height', nodeHeight)
          .attr('rx', 6)
          .attr('fill', statusColors[status] || '#9ca3af');
      }

      // Priority indicator (top-right corner)
      if (priority > 0) {
        const priorityColor =
          priority >= 3 ? '#ef4444' : priority === 2 ? '#f97316' : '#eab308';
        nodeG
          .append('circle')
          .attr('cx', nodeWidth - 8)
          .attr('cy', 8)
          .attr('r', 5)
          .attr('fill', priorityColor)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);
      }

      // Sibling expand button (left edge)
      const hasSiblings =
        node.person.siblings && node.person.siblings.length > 0;
      if (hasSiblings) {
        const siblingsVisible = _visibleSiblings.has(person.id);
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
          .attr('font-weight', 'bold')
          .attr('fill', siblingsVisible ? '#fff' : '#3b82f6')
          .text(siblingsVisible ? '−' : '+');
      }

      // Expand ancestors bar (bottom of tile)
      const buttonHeight = 20;
      const buttonY = nodeHeight + 4;
      const isExpanded = expandedAncestors.has(node.id);
      const hasParentsRendered = node.father || node.mother;

      // Only show "End of tree" if we've never expanded AND there's nothing to load
      // Don't show it if parents are already rendered
      const canLoadMoreAncestors = node.hasMoreAncestors && !hasParentsRendered;
      const shouldShowButton = isExpanded || canLoadMoreAncestors;

      if (shouldShowButton) {
        const isEndOfTree = false; // Never show "End of tree" for ancestors
        const expandG = nodeG
          .append('g')
          .attr('transform', `translate(0, ${buttonY})`)
          .style(
            'cursor',
            isExpandingAncestors || isEndOfTree ? 'default' : 'pointer',
          )
          .on('click', (e: MouseEvent) => {
            e.stopPropagation();
            if (!isExpandingAncestors && !isEndOfTree) {
              expandAncestors(node.id);
            }
          });

        // Button background - FULL WIDTH RECTANGLE
        expandG
          .append('rect')
          .attr('width', nodeWidth)
          .attr('height', buttonHeight)
          .attr('rx', 4)
          .attr(
            'fill',
            isExpandingAncestors
              ? '#94a3b8'
              : isEndOfTree
                ? '#e5e7eb'
                : isExpanded
                  ? '#2563eb'
                  : '#3b82f6',
          )
          .attr(
            'stroke',
            isExpandingAncestors
              ? '#64748b'
              : isEndOfTree
                ? '#d1d5db'
                : '#1e40af',
          )
          .attr('stroke-width', 1)
          .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');

        // Button text
        const buttonText = isExpandingAncestors
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

      // Expand descendants bar (top of tile)
      const isDescExpanded = expandedDescendants.has(node.id);
      const hasChildrenRendered = node.children && node.children.length > 0;

      // Only show "End of tree" if we've never expanded AND there's nothing to load
      // Don't show it if children are already rendered
      const canLoadMoreDescendants = node.hasMoreDescendants && !hasChildrenRendered;
      const shouldShowDescButton = isDescExpanded || canLoadMoreDescendants;

      if (shouldShowDescButton) {
        const isEndOfDescTree = false; // Never show "End of tree" for descendants
        const descButtonY = -(buttonHeight + 4);
        const descExpandG = nodeG
          .append('g')
          .attr('transform', `translate(0, ${descButtonY})`)
          .style(
            'cursor',
            isExpandingDescendants || isEndOfDescTree ? 'default' : 'pointer',
          )
          .on('click', (e: MouseEvent) => {
            e.stopPropagation();
            if (!isExpandingDescendants && !isEndOfDescTree) {
              expandDescendants(node.id);
            }
          });

        // Button background - FULL WIDTH RECTANGLE
        descExpandG
          .append('rect')
          .attr('width', nodeWidth)
          .attr('height', buttonHeight)
          .attr('rx', 4)
          .attr(
            'fill',
            isExpandingDescendants
              ? '#94a3b8'
              : isEndOfDescTree
                ? '#e5e7eb'
                : isDescExpanded
                  ? '#2563eb'
                  : '#3b82f6',
          )
          .attr(
            'stroke',
            isExpandingDescendants
              ? '#64748b'
              : isEndOfDescTree
                ? '#d1d5db'
                : '#1e40af',
          )
          .attr('stroke-width', 1)
          .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');

        // Button text
        const descButtonText = isExpandingDescendants
          ? 'Loading...'
          : isEndOfDescTree
            ? 'End of tree'
            : isDescExpanded
              ? '▼ Collapse'
              : '▲ Load More';

        descExpandG
          .append('text')
          .attr('x', nodeWidth / 2)
          .attr('y', buttonHeight / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', isEndOfDescTree ? '#9ca3af' : '#fff')
          .text(descButtonText);
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

        const maxNameLen = 18;
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
        _visibleSiblings.has(person.id) &&
        node.person.siblings &&
        node.person.siblings.length > 0
      ) {
        const siblings = node.person.siblings;
        const maxNameLen = 18;
        for (let idx = 0; idx < siblings.length; idx++) {
          const sibling = toTreePerson(siblings[idx]);
          const siblingX =
            node.x - nodeWidth / 2 - (idx + 1) * (nodeWidth + nodeGap);
          const siblingG = g
            .append('g')
            .attr(
              'transform',
              `translate(${siblingX},${node.y - nodeHeight / 2})`,
            );

          siblingG
            .append('rect')
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 6)
            .attr('fill', sibling.sex === 'F' ? '#fce7f3' : '#dbeafe')
            .attr('stroke', sibling.sex === 'F' ? '#ec4899' : '#3b82f6')
            .attr('stroke-width', 2)
            .attr('opacity', 0.7)
            .style('cursor', 'pointer')
            .on('click', () => onTileClick(sibling.id));

          const siblingDisplayName =
            sibling.name.length > maxNameLen
              ? `${sibling.name.substring(0, maxNameLen - 2)}…`
              : sibling.name;
          siblingG
            .append('text')
            .attr('x', nodeWidth / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('fill', '#1f2937')
            .text(siblingDisplayName);

          const siblingYears = sibling.living
            ? `${sibling.birth_year || '?'} – Living`
            : `${sibling.birth_year || '?'} – ${sibling.death_year || '?'}`;
          siblingG
            .append('text')
            .attr('x', nodeWidth / 2)
            .attr('y', 36)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#6b7280')
            .text(siblingYears);
        }
      }
    }
  }, [
    tree,
    dimensions,
    expandAncestors,
    expandDescendants,
    expandedAncestors,
    expandedDescendants,
    expandingNode,
    onPersonClick,
    onTileClick,
    _visibleSiblings,
    toggleSiblings,
  ]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 font-semibold">
            Error loading family tree
          </p>
          <p className="text-sm text-gray-500 mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="text-sm text-gray-500 mt-4">Loading family tree...</p>
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No tree data available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
      <TreeControls
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
      />
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
    </div>
  );
}
