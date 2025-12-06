'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import * as d3 from 'd3';
import { UPDATE_RESEARCH_STATUS, UPDATE_RESEARCH_PRIORITY } from '@/lib/graphql/queries';

// GraphQL query - component asks for exactly what it needs
const TREE_DATA_QUERY = gql`
  query TreeData($rootPersonId: ID!) {
    peopleList(limit: 10000) {
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
    families {
      id
      husband_id
      wife_id
      marriage_year
      marriage_place
      children { id }
    }
    person(id: $rootPersonId) {
      id
      notableRelatives {
        person { id name_full }
        generation
      }
    }
  }
`;

interface TreePerson {
  id: string;
  name: string;
  sex: 'M' | 'F' | null;
  birth_year: number | null;
  death_year: number | null;
  birth_place: string | null;
  death_place: string | null;
  living: boolean;
  familysearch_id: string | null;
  isNotable?: boolean;
  research_status?: string;
  research_priority?: number;
  last_researched?: string;
  hasCoatOfArms?: boolean;
  coatOfArmsUrl?: string | null;
}

interface TreeFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
  marriage_year: number | null;
  marriage_place: string | null;
  children: string[];
}

interface NotableRelative {
  person: { id: string; name_full: string };
  generation: number;
}

interface TreeData {
  people: Record<string, TreePerson>;
  families: TreeFamily[];
  notableRelatives: NotableRelative[];
}

// Pedigree node - each person has their own node with father/mother links
interface PedigreeNode {
  id: string;
  person: TreePerson;
  father?: PedigreeNode;
  mother?: PedigreeNode;
  x?: number;
  y?: number;
  isNotableBranch?: boolean;
}

interface FamilyTreeProps {
  rootPersonId: string;
  showAncestors: boolean;
  onPersonClick: (id: string) => void;
  onTileClick: (id: string) => void;
  showNotableConnections?: boolean;
}

// Priority popup state
interface PriorityPopup {
  personId: string;
  personName: string;
  x: number;
  y: number;
  priority: number;
  status: string;
}

// Crest popup state
interface CrestPopup {
  url: string;
  x: number;
  y: number;
}

export default function FamilyTree({ rootPersonId, showAncestors, onPersonClick, onTileClick }: FamilyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [priorityPopup, setPriorityPopup] = useState<PriorityPopup | null>(null);
  const [crestPopup, setCrestPopup] = useState<CrestPopup | null>(null);
  const [notablePanelOpen, setNotablePanelOpen] = useState(true);

  // GraphQL data fetching
  interface QueryResult {
    peopleList: Array<{
      id: string;
      name_full: string;
      sex: 'M' | 'F' | null;
      birth_year: number | null;
      death_year: number | null;
      birth_place: string | null;
      death_place: string | null;
      living: boolean;
      familysearch_id: string | null;
      is_notable: boolean;
      research_status: string | null;
      research_priority: number | null;
      last_researched: string | null;
      coatOfArms: string | null;
    }>;
    families: Array<{
      id: string;
      husband_id: string | null;
      wife_id: string | null;
      marriage_year: number | null;
      marriage_place: string | null;
      children: { id: string }[];
    }>;
    person: {
      notableRelatives: Array<{
        person: { id: string; name_full: string };
        generation: number;
      }>;
    } | null;
  }
  const { data: queryData, loading, error } = useQuery<QueryResult>(TREE_DATA_QUERY, {
    variables: { rootPersonId },
  });
  const [updateStatus] = useMutation(UPDATE_RESEARCH_STATUS);

  // Log errors for debugging
  if (error) {
    console.error('FamilyTree GraphQL error:', error);
  }
  const [updatePriority] = useMutation(UPDATE_RESEARCH_PRIORITY);

  // Transform GraphQL response to tree data format
  const data: TreeData | null = useMemo(() => {
    if (!queryData) return null;
    const people: Record<string, TreePerson> = {};
    for (const p of queryData.peopleList) {
      people[p.id] = {
        id: p.id,
        name: p.name_full,
        sex: p.sex,
        birth_year: p.birth_year,
        death_year: p.death_year,
        birth_place: p.birth_place,
        death_place: p.death_place,
        living: p.living,
        familysearch_id: p.familysearch_id,
        isNotable: p.is_notable,
        research_status: p.research_status ?? undefined,
        research_priority: p.research_priority ?? undefined,
        last_researched: p.last_researched ?? undefined,
        coatOfArmsUrl: p.coatOfArms ?? undefined,
      };
    }
    const families: TreeFamily[] = queryData.families.map((f) => ({
      id: f.id,
      husband_id: f.husband_id,
      wife_id: f.wife_id,
      marriage_year: f.marriage_year,
      marriage_place: f.marriage_place,
      children: f.children.map(c => c.id),
    }));
    return { people, families, notableRelatives: queryData.person?.notableRelatives ?? [] };
  }, [queryData]);

  const handlePriorityChange = async (personId: string, priority: number) => {
    await updatePriority({ variables: { personId, priority } });
    setPriorityPopup(null);
  };

  const handleStatusChange = async (personId: string, status: string) => {
    await updateStatus({ variables: { personId, status } });
  };

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Build descendant chain for collateral branches (e.g., Renée -> ... -> Joséphine)
  const buildDescendantChain = useCallback((personId: string, targetId: string, visited: Set<string> = new Set()): PedigreeNode[] | null => {
    if (!data) return null;
    if (visited.has(personId)) return null;
    visited.add(personId);

    const person = data.people[personId];
    if (!person) return null;

    // Found the target
    if (personId === targetId) {
      return [{ id: personId, person, isNotableBranch: person.isNotable }];
    }

    // Find families where this person is a parent
    const familiesAsParent = data.families.filter(f => f.husband_id === personId || f.wife_id === personId);

    for (const family of familiesAsParent) {
      for (const childId of family.children) {
        const childChain = buildDescendantChain(childId, targetId, visited);
        if (childChain) {
          return [{ id: personId, person, isNotableBranch: true }, ...childChain];
        }
      }
    }
    return null;
  }, [data]);

  // Build pedigree tree - each person links to their own father and mother
  const buildPedigree = useCallback((personId: string, depth = 0, maxDepth = 10): PedigreeNode | null => {
    if (!data || depth > maxDepth) return null;
    const person = data.people[personId];
    if (!person) return null;

    const node: PedigreeNode = { id: personId, person };

    // Find family where this person is a child
    const parentFamily = data.families.find(f => f.children.includes(personId));
    if (parentFamily) {
      if (parentFamily.husband_id) {
        node.father = buildPedigree(parentFamily.husband_id, depth + 1, maxDepth) || undefined;
      }
      if (parentFamily.wife_id) {
        node.mother = buildPedigree(parentFamily.wife_id, depth + 1, maxDepth) || undefined;
      }
    }

    return node;
  }, [data]);

  // Descendant node - includes spouse and children
  interface DescendantNode {
    id: string;
    person: TreePerson;
    spouse?: TreePerson;
    marriageYear?: number | null;
    children: DescendantNode[];
    x?: number;
    y?: number;
  }

  // Build descendant tree - each person links to spouse and children
  const buildDescendantTree = useCallback((personId: string, depth = 0, maxDepth = 8): DescendantNode | null => {
    if (!data || depth > maxDepth) return null;
    const person = data.people[personId];
    if (!person) return null;

    const node: DescendantNode = { id: personId, person, children: [] };

    // Find families where this person is a parent
    const familiesAsParent = data.families.filter(f =>
      f.husband_id === personId || f.wife_id === personId
    );

    // Use the first family for spouse (primary marriage)
    if (familiesAsParent.length > 0) {
      const primaryFamily = familiesAsParent[0];
      const spouseId = primaryFamily.husband_id === personId
        ? primaryFamily.wife_id
        : primaryFamily.husband_id;
      if (spouseId && data.people[spouseId]) {
        node.spouse = data.people[spouseId];
        node.marriageYear = primaryFamily.marriage_year;
      }

      // Add children from all marriages
      for (const family of familiesAsParent) {
        for (const childId of family.children) {
          const childNode = buildDescendantTree(childId, depth + 1, maxDepth);
          if (childNode) {
            node.children.push(childNode);
          }
        }
      }
    }

    return node;
  }, [data]);

  // Draw pedigree chart
  useEffect(() => {
    if (!data || !svgRef.current || !rootPersonId) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (!showAncestors) {
      // Descendant view - build tree going down
      const descendantTree = buildDescendantTree(rootPersonId);
      if (!descendantTree) return;

      const nodeWidth = 115;
      const nodeHeight = 42;
      const levelGap = 60;
      const nodeGap = 8;
      const spouseGap = 4; // Gap between person and spouse

      // Position nodes top-down: root at top, children spread below
      interface DescendantNode {
        id: string;
        person: TreePerson;
        spouse?: TreePerson;
        marriageYear?: number | null;
        children: DescendantNode[];
        x?: number;
        y?: number;
      }

      let leafX = 0;
      const positionDescendants = (node: DescendantNode, gen: number): { minX: number; maxX: number } => {
        node.y = gen * levelGap + 30;

        if (node.children.length === 0) {
          // Leaf node
          const width = node.spouse ? nodeWidth * 2 + spouseGap : nodeWidth;
          node.x = leafX + width / 2;
          leafX += width + nodeGap;
          return { minX: node.x - width / 2, maxX: node.x + width / 2 };
        }

        // Position children first
        let minX = Infinity;
        let maxX = -Infinity;
        for (const child of node.children) {
          const childBounds = positionDescendants(child, gen + 1);
          minX = Math.min(minX, childBounds.minX);
          maxX = Math.max(maxX, childBounds.maxX);
        }

        // Center parent above children
        const width = node.spouse ? nodeWidth * 2 + spouseGap : nodeWidth;
        node.x = (minX + maxX) / 2;
        return { minX: Math.min(minX, node.x - width / 2), maxX: Math.max(maxX, node.x + width / 2) };
      };

      // Find parents of root for -1 level navigation
      const parentFamily = data.families.find(f => f.children.includes(rootPersonId));
      const fatherPerson = parentFamily?.husband_id ? data.people[parentFamily.husband_id] : null;
      const motherPerson = parentFamily?.wife_id ? data.people[parentFamily.wife_id] : null;
      const hasParents = fatherPerson || motherPerson;

      // Find siblings of root (other children of the same parent family)
      const siblingIds = parentFamily ? parentFamily.children.filter(id => id !== rootPersonId) : [];
      const siblingPeople = siblingIds.map(id => data.people[id]).filter(Boolean);

      // Position descendants starting at gen 1 if we have parents, else gen 0
      const rootGen = hasParents ? 1 : 0;
      positionDescendants(descendantTree, rootGen);

      // Collect all nodes for rendering
      const allDescendants: DescendantNode[] = [];
      const collectNodes = (node: DescendantNode) => {
        allDescendants.push(node);
        node.children.forEach(collectNodes);
      };
      collectNodes(descendantTree);

      // Add parent nodes at generation 0 (above root)
      interface ParentNode { person: TreePerson; x: number; y: number; }
      const parentNodes: ParentNode[] = [];
      if (hasParents && descendantTree.x !== undefined) {
        const parentY = 30; // Generation 0
        if (fatherPerson) {
          parentNodes.push({ person: fatherPerson, x: descendantTree.x - nodeWidth/2 - spouseGap, y: parentY });
        }
        if (motherPerson) {
          parentNodes.push({ person: motherPerson, x: descendantTree.x + nodeWidth/2 + spouseGap, y: parentY });
        }
      }

      // Calculate bounds
      const xs = allDescendants.map(n => n.x!);
      const ys = allDescendants.map(n => n.y!);
      const treeWidth = Math.max(...xs) - Math.min(...xs) + nodeWidth * 2;
      const treeHeight = Math.max(...ys) + nodeHeight + 40;

      // Setup zoom
      const { width, height } = dimensions;
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 2])
        .on('zoom', (event) => g.attr('transform', event.transform));
      svg.call(zoom);

      const g = svg.append('g');

      // Draw connections (lines from parent to children)
      allDescendants.forEach(node => {
        if (node.children.length > 0 && node.x !== undefined && node.y !== undefined) {
          const parentY = node.y + nodeHeight;
          const childY = node.y + levelGap;

          // Vertical line down from parent
          const midY = parentY + (childY - parentY) / 2;
          g.append('line')
            .attr('x1', node.x).attr('y1', parentY)
            .attr('x2', node.x).attr('y2', midY)
            .attr('stroke', '#4a5568').attr('stroke-width', 1);

          // Horizontal line spanning children
          const childXs = node.children.map(c => c.x!);
          const minChildX = Math.min(...childXs);
          const maxChildX = Math.max(...childXs);
          g.append('line')
            .attr('x1', minChildX).attr('y1', midY)
            .attr('x2', maxChildX).attr('y2', midY)
            .attr('stroke', '#4a5568').attr('stroke-width', 1);

          // Vertical lines down to each child
          node.children.forEach(child => {
            g.append('line')
              .attr('x1', child.x!).attr('y1', midY)
              .attr('x2', child.x!).attr('y2', childY)
              .attr('stroke', '#4a5568').attr('stroke-width', 1);
          });
        }

        // Marriage connector line between person and spouse
        if (node.spouse && node.x !== undefined && node.y !== undefined) {
          // No marriage line - cleaner look
        }
      });

      // Status color map (same as ancestor view)
      const statusColors: Record<string, string> = {
        'not_started': '#9ca3af', 'in_progress': '#3b82f6', 'partial': '#eab308',
        'verified': '#22c55e', 'needs_review': '#f97316', 'brick_wall': '#ef4444',
      };
      const statusLabels: Record<string, string> = {
        'not_started': 'Not Started', 'in_progress': 'In Progress', 'partial': 'Partial',
        'verified': 'Verified', 'needs_review': 'Needs Review', 'brick_wall': 'Brick Wall',
      };

      // Draw nodes (person tiles) - MATCHING ANCESTOR VIEW STYLING
      allDescendants.forEach(node => {
        if (node.x === undefined || node.y === undefined) return;

        const drawPersonTile = (person: TreePerson, x: number, y: number) => {
          const isNotable = person.isNotable;
          const status = person.research_status || 'not_started';

          const tileG = g.append('g')
            .attr('transform', `translate(${x - nodeWidth / 2}, ${y})`)
            .style('cursor', 'pointer')
            .on('click', () => onTileClick(person.id || node.id))
            .on('dblclick', () => onPersonClick(person.id || node.id));

          // Background - SAME AS ANCESTOR VIEW (light pastels, gold for notable)
          tileG.append('rect')
            .attr('width', nodeWidth).attr('height', nodeHeight)
            .attr('rx', 6)
            .attr('fill', isNotable ? '#fef3c7' : (person.sex === 'F' ? '#fce7f3' : '#dbeafe'))
            .attr('stroke', isNotable ? '#f59e0b' : (person.sex === 'F' ? '#ec4899' : '#3b82f6'))
            .attr('stroke-width', isNotable ? 3 : 2);

          // Crown for notable - positioned outside tile top-left
          if (isNotable) {
            tileG.append('text')
              .attr('x', -6).attr('y', 6)
              .attr('font-size', '14px')
              .text('👑');
          }

          // Coat of arms with hover popup - positioned outside tile bottom-left
          if (person.coatOfArmsUrl) {
            const crestSize = 28;
            const crestUrl = person.coatOfArmsUrl;
            const crestG = tileG.append('g')
              .style('cursor', 'pointer')
              .on('mouseenter', function(event: MouseEvent) {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  setCrestPopup({ url: crestUrl, x: event.clientX - rect.left + 20, y: event.clientY - rect.top - 75 });
                }
              })
              .on('mouseleave', () => setCrestPopup(null));
            crestG.append('image')
              .attr('href', crestUrl)
              .attr('x', -crestSize / 3)
              .attr('y', nodeHeight - crestSize / 2)
              .attr('width', crestSize).attr('height', crestSize)
              .attr('preserveAspectRatio', 'xMidYMid meet');
          }

          // Research status indicator (bottom-right dot)
          const statusG = tileG.append('g').style('cursor', 'help');
          statusG.append('title').text(statusLabels[status] || 'Unknown status');
          statusG.append('circle')
            .attr('cx', nodeWidth - 10).attr('cy', nodeHeight - 10).attr('r', 5)
            .attr('fill', statusColors[status] || '#9ca3af')
            .attr('stroke', '#fff').attr('stroke-width', 1);

          // Name with ellipsis and tooltip - dark text like ancestor view
          const fullName = person.name || 'Unknown';
          const maxNameLen = 18;
          const displayName = fullName.length > maxNameLen ? fullName.substring(0, maxNameLen - 2) + '…' : fullName;
          const nameText = tileG.append('text')
            .attr('x', nodeWidth / 2).attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('fill', '#1f2937').attr('font-size', '11px').attr('font-weight', '600')
            .text(displayName);
          nameText.append('title').text(fullName);

          // Years - same styling as ancestor view
          const years = person.living
            ? `${person.birth_year || '?'} – Living`
            : `${person.birth_year || '?'} – ${person.death_year || '?'}`;
          tileG.append('text')
            .attr('x', nodeWidth / 2).attr('y', 36)
            .attr('text-anchor', 'middle')
            .attr('fill', '#6b7280').attr('font-size', '10px')
            .text(years);
        };

        // Draw main person
        const personX = node.spouse ? node.x - nodeWidth / 2 - spouseGap / 2 : node.x;
        drawPersonTile(node.person, personX, node.y);

        // Draw spouse if exists
        if (node.spouse) {
          const spouseX = node.x + nodeWidth / 2 + spouseGap / 2;
          drawPersonTile(node.spouse, spouseX, node.y);
        }
      });

      // Draw parent nodes (-1 level for navigation)
      if (parentNodes.length > 0 && descendantTree.x !== undefined && descendantTree.y !== undefined) {
        // Draw connection line from parents down to root
        const rootY = descendantTree.y;
        const parentY = 30 + nodeHeight;
        const midY = (parentY + rootY) / 2;

        // Line from father to midpoint
        if (fatherPerson) {
          const fatherX = descendantTree.x - nodeWidth/2 - spouseGap;
          g.append('path')
            .attr('d', `M${fatherX},${parentY} L${fatherX},${midY} L${descendantTree.x},${midY} L${descendantTree.x},${rootY}`)
            .attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 2).attr('stroke-opacity', 0.6);
        }
        if (motherPerson) {
          const motherX = descendantTree.x + nodeWidth/2 + spouseGap;
          g.append('path')
            .attr('d', `M${motherX},${parentY} L${motherX},${midY} L${descendantTree.x},${midY}`)
            .attr('fill', 'none').attr('stroke', '#ec4899').attr('stroke-width', 2).attr('stroke-opacity', 0.6);
        }
        // Marriage line between parents
        if (fatherPerson && motherPerson) {
          // No marriage line - cleaner look
        }

        // Draw parent tiles (dimmed to indicate navigation)
        parentNodes.forEach(pn => {
          const person = pn.person;
          const isNotable = person.isNotable;
          const tileG = g.append('g')
            .attr('transform', `translate(${pn.x - nodeWidth/2}, ${pn.y})`)
            .style('cursor', 'pointer').style('opacity', 0.7)
            .on('click', () => onTileClick(person.id));

          tileG.append('rect')
            .attr('width', nodeWidth).attr('height', nodeHeight).attr('rx', 6)
            .attr('fill', isNotable ? '#fef3c7' : (person.sex === 'F' ? '#fce7f3' : '#dbeafe'))
            .attr('stroke', isNotable ? '#f59e0b' : (person.sex === 'F' ? '#ec4899' : '#3b82f6'))
            .attr('stroke-width', 2).attr('stroke-dasharray', '4,2');

          const fullName = person.name || 'Unknown';
          const maxLen = 18;
          const displayName = fullName.length > maxLen ? fullName.substring(0, maxLen - 2) + '…' : fullName;
          const nameText = tileG.append('text')
            .attr('x', nodeWidth/2).attr('y', 20).attr('text-anchor', 'middle')
            .attr('fill', '#1f2937').attr('font-size', '11px').attr('font-weight', '600')
            .text(displayName);
          nameText.append('title').text(fullName + ' (click to navigate)');

          const years = `${person.birth_year || '?'} – ${person.death_year || '?'}`;
          tileG.append('text')
            .attr('x', nodeWidth/2).attr('y', 36).attr('text-anchor', 'middle')
            .attr('fill', '#6b7280').attr('font-size', '10px').text(years);

          // Up arrow to indicate navigation
          tileG.append('text')
            .attr('x', nodeWidth - 12).attr('y', 14).attr('font-size', '10px').attr('fill', '#9ca3af')
            .text('⬆');
        });
      }

      // Draw siblings at level 0 - positioned on father's side (left of root)
      // Siblings connect to the parent junction line
      if (siblingPeople.length > 0 && descendantTree.x !== undefined && descendantTree.y !== undefined) {
        const rootY = descendantTree.y;
        const rootCenterX = descendantTree.x;
        const parentY = 30 + nodeHeight;
        const midY = (parentY + rootY) / 2;

        // Position all siblings to the left of root (father's side)
        // Start from the father's X position and go further left
        const fatherX = fatherPerson ? rootCenterX - nodeWidth/2 - spouseGap : rootCenterX - nodeWidth;

        siblingPeople.forEach((sibling, idx) => {
          const sibX = fatherX - (idx + 1) * (nodeWidth + nodeGap);
          const sibCenterX = sibX;

          // Draw connecting line from sibling to the parent junction
          g.append('path')
            .attr('d', `M${sibCenterX},${rootY} L${sibCenterX},${midY} L${rootCenterX},${midY}`)
            .attr('fill', 'none').attr('stroke', '#9ca3af').attr('stroke-width', 1.5).attr('stroke-opacity', 0.5);

          const tileG = g.append('g')
            .attr('transform', `translate(${sibX - nodeWidth / 2}, ${rootY})`)
            .style('cursor', 'pointer').style('opacity', 0.7)
            .on('click', () => onTileClick(sibling.id));

          tileG.append('rect')
            .attr('width', nodeWidth).attr('height', nodeHeight).attr('rx', 6)
            .attr('fill', sibling.isNotable ? '#fef3c7' : (sibling.sex === 'F' ? '#fce7f3' : '#dbeafe'))
            .attr('stroke', sibling.isNotable ? '#f59e0b' : (sibling.sex === 'F' ? '#ec4899' : '#3b82f6'))
            .attr('stroke-width', 2).attr('stroke-dasharray', '4,2');

          const fullName = sibling.name || 'Unknown';
          const maxLen = 18;
          const displayName = fullName.length > maxLen ? fullName.substring(0, maxLen - 2) + '…' : fullName;
          const nameText = tileG.append('text')
            .attr('x', nodeWidth / 2).attr('y', 20).attr('text-anchor', 'middle')
            .attr('fill', '#1f2937').attr('font-size', '11px').attr('font-weight', '600')
            .text(displayName);
          nameText.append('title').text(fullName);

          const years = sibling.living
            ? `${sibling.birth_year || '?'} – Living`
            : `${sibling.birth_year || '?'} – ${sibling.death_year || '?'}`;
          tileG.append('text')
            .attr('x', nodeWidth / 2).attr('y', 36).attr('text-anchor', 'middle')
            .attr('fill', '#6b7280').attr('font-size', '10px').text(years);

          // Sibling indicator
          tileG.append('text')
            .attr('x', nodeWidth - 12).attr('y', 14).attr('font-size', '10px').attr('fill', '#9ca3af')
            .text('↔');
        });
      }

      // Fit to view
      const bounds = { x: Math.min(...xs) - nodeWidth, y: 0, width: treeWidth, height: treeHeight };
      const scale = Math.min(width / (bounds.width + 100), height / (bounds.height + 100), 1);
      const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
      const ty = 20;
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

      return;
    }

    const pedigree = buildPedigree(rootPersonId);
    if (!pedigree) return;

    const nodeWidth = 115;
    const nodeHeight = 42;
    const levelGap = 60; // Vertical gap between generations (same as descendants)
    const nodeGap = 8; // Horizontal gap between nodes
    const spouseGap = 4; // Gap between person and spouse (same as descendants)

    // Find spouse of root person for level 0 display (like descendant view)
    const rootFamilies = data.families.filter(f => f.husband_id === rootPersonId || f.wife_id === rootPersonId);
    const rootSpouseId = rootFamilies.length > 0
      ? (rootFamilies[0].husband_id === rootPersonId ? rootFamilies[0].wife_id : rootFamilies[0].husband_id)
      : null;
    const rootSpouse = rootSpouseId ? data.people[rootSpouseId] : null;

    // Find siblings of root (other children of the same parent family)
    const ancestorParentFamily = data.families.find(f => f.children.includes(rootPersonId));
    const ancestorSiblingIds = ancestorParentFamily ? ancestorParentFamily.children.filter(id => id !== rootPersonId) : [];
    const ancestorSiblingPeople = ancestorSiblingIds.map(id => data.people[id]).filter(Boolean);

    // Position nodes - parents displayed as couples side-by-side at SAME Y level
    let leafX = 0;

    // Track visited nodes to handle pedigree collapse (same ancestor through multiple lines)
    const visitedPositions = new Map<string, { x: number; y: number }>();

    // First pass: assign generation levels (parents must be at same level as each other)
    // Track assigned generations to handle pedigree collapse - use the MINIMUM gen (closest to root)
    const assignedGens = new Map<string, number>();
    // Also track all node objects for each person ID so we can update all of them
    const nodesByPersonId = new Map<string, PedigreeNode[]>();

    const collectAllNodeInstances = (node: PedigreeNode) => {
      const existing = nodesByPersonId.get(node.id) || [];
      existing.push(node);
      nodesByPersonId.set(node.id, existing);
      if (node.father) collectAllNodeInstances(node.father);
      if (node.mother) collectAllNodeInstances(node.mother);
    };

    const assignGenerations = (node: PedigreeNode, gen: number) => {
      const existingGen = assignedGens.get(node.id);
      if (existingGen !== undefined) {
        // Already visited - use the stored generation for THIS node object
        node.y = existingGen * levelGap + 30;
        // If new path is closer to root, update stored gen and all node instances
        if (gen < existingGen) {
          assignedGens.set(node.id, gen);
          const allNodes = nodesByPersonId.get(node.id) || [];
          allNodes.forEach(n => n.y = gen * levelGap + 30);
        }
        return; // Don't recurse again
      }

      assignedGens.set(node.id, gen);
      node.y = gen * levelGap + 30;

      // Both parents at same generation level (gen + 1)
      if (node.father) assignGenerations(node.father, gen + 1);
      if (node.mother) assignGenerations(node.mother, gen + 1);
    };

    // First collect all nodes, then assign generations
    collectAllNodeInstances(pedigree);
    assignGenerations(pedigree, 0);

    // Second pass: assign X positions bottom-up (from leaves to root)
    const positionNodes = (node: PedigreeNode): { minX: number; maxX: number } => {
      // Check if this person was already positioned (pedigree collapse)
      const existing = visitedPositions.get(node.id);
      if (existing) {
        node.x = existing.x;
        // Don't overwrite Y - it was set correctly in assignGenerations
        return { minX: node.x - nodeWidth / 2, maxX: node.x + nodeWidth / 2 };
      }

      const hasParents = node.father || node.mother;

      if (!hasParents) {
        // Leaf node - assign next available X
        node.x = leafX + nodeWidth / 2;
        leafX += nodeWidth + nodeGap;
        visitedPositions.set(node.id, { x: node.x, y: node.y! });
        return { minX: node.x - nodeWidth / 2, maxX: node.x + nodeWidth / 2 };
      }

      // Position parents first (they're displayed as a couple above this node)
      let minX = Infinity;
      let maxX = -Infinity;

      if (node.father && node.mother) {
        // Both parents - position them as a couple unit
        const fatherBounds = positionNodes(node.father);
        const motherBounds = positionNodes(node.mother);
        minX = Math.min(fatherBounds.minX, motherBounds.minX);
        maxX = Math.max(fatherBounds.maxX, motherBounds.maxX);
      } else if (node.father) {
        const bounds = positionNodes(node.father);
        minX = bounds.minX;
        maxX = bounds.maxX;
      } else if (node.mother) {
        const bounds = positionNodes(node.mother);
        minX = bounds.minX;
        maxX = bounds.maxX;
      }

      // Center this node under its parents
      node.x = (minX + maxX) / 2;
      visitedPositions.set(node.id, { x: node.x, y: node.y! });

      return { minX: Math.min(minX, node.x - nodeWidth / 2), maxX: Math.max(maxX, node.x + nodeWidth / 2) };
    };

    positionNodes(pedigree);

    // Adjust root position if spouse exists - shift left to make room for spouse on right
    if (rootSpouse && pedigree.x !== undefined) {
      const shift = (nodeWidth + spouseGap) / 2;
      pedigree.x -= shift;
      visitedPositions.set(pedigree.id, { x: pedigree.x, y: pedigree.y! });
    }

    // Collect all nodes - deduplicate by ID to handle pedigree collapse
    const allNodes: PedigreeNode[] = [];
    const seenIds = new Set<string>();
    const collectNodes = (node: PedigreeNode) => {
      if (seenIds.has(node.id)) return; // Skip duplicates
      seenIds.add(node.id);
      allNodes.push(node);
      if (node.father) collectNodes(node.father);
      if (node.mother) collectNodes(node.mother);
    };
    collectNodes(pedigree);

    // Find children of root for -1 level navigation
    const childFamilies = data.families.filter(f => f.husband_id === rootPersonId || f.wife_id === rootPersonId);
    const childIds: string[] = [];
    childFamilies.forEach(f => childIds.push(...f.children));
    const childPeople = childIds.map(id => data.people[id]).filter(Boolean).slice(0, 5); // Max 5 children shown

    const g = svg.append('g');

    // Draw links - same pattern as descendant view
    // Note: node.y is CENTER of node, so top = y - nodeHeight/2, bottom = y + nodeHeight/2
    // Track links by unique coordinates to prevent duplicates from pedigree collapse
    const drawnLineKeys = new Set<string>();

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      // Create a unique key for this line (rounded to avoid floating point issues)
      const key = `${Math.round(x1)},${Math.round(y1)}-${Math.round(x2)},${Math.round(y2)}`;
      if (drawnLineKeys.has(key)) return;
      drawnLineKeys.add(key);

      g.append('line')
        .attr('x1', x1).attr('y1', y1)
        .attr('x2', x2).attr('y2', y2)
        .attr('stroke', '#4a5568').attr('stroke-width', 1);
    };

    const drawLinks = (node: PedigreeNode, visited = new Set<string>()) => {
      if (node.x === undefined || node.y === undefined) return;
      const hasParents = node.father || node.mother;
      if (!hasParents) return;

      // Skip if we've already processed this node in this traversal path
      const nodeKey = `${node.id}-${Math.round(node.x)}-${Math.round(node.y)}`;
      if (visited.has(nodeKey)) return;
      visited.add(nodeKey);

      // Both parents should be at the SAME Y level (one generation above current node)
      // Use the assigned generation from our tracking map
      const expectedParentY = node.y + levelGap; // Parents are above (higher Y in our coordinate system)

      // Ensure both parents use the correct Y (their assigned generation)
      const fatherY = node.father?.y;
      const motherY = node.mother?.y;

      // Use the consistent parent Y level (should be same for both)
      const parentY = Math.min(fatherY ?? Infinity, motherY ?? Infinity);
      if (parentY === Infinity) return;

      // Node top and parent bottom (y is center-based)
      const nodeTop = node.y - nodeHeight / 2;
      const parentBottom = parentY + nodeHeight / 2;
      const midY = parentBottom + (nodeTop - parentBottom) / 2;

      // Vertical line UP from current node top to midY
      drawLine(node.x, nodeTop, node.x, midY);

      // Get parent x positions
      const parentXs: number[] = [];
      if (node.father?.x !== undefined) parentXs.push(node.father.x);
      if (node.mother?.x !== undefined) parentXs.push(node.mother.x);

      if (parentXs.length > 0) {
        // Horizontal line spanning parents at midY
        const minX = Math.min(...parentXs);
        const maxX = Math.max(...parentXs);
        drawLine(minX, midY, maxX, midY);

        // Vertical lines UP from midY to each parent's bottom - use their ACTUAL Y positions
        if (node.father?.x !== undefined && node.father?.y !== undefined) {
          drawLine(node.father.x, midY, node.father.x, node.father.y + nodeHeight / 2);
          drawLinks(node.father, visited);
        }
        if (node.mother?.x !== undefined && node.mother?.y !== undefined) {
          drawLine(node.mother.x, midY, node.mother.x, node.mother.y + nodeHeight / 2);
          drawLinks(node.mother, visited);
        }
      }
    };
    drawLinks(pedigree);

    // Status color map
    const statusColors: Record<string, string> = {
      'not_started': '#9ca3af',    // gray
      'in_progress': '#3b82f6',     // blue
      'partial': '#eab308',         // yellow
      'verified': '#22c55e',        // green
      'needs_review': '#f97316',    // orange
      'brick_wall': '#ef4444',      // red
    };

    // Status labels for tooltips
    const statusLabels: Record<string, string> = {
      'not_started': 'Not Started - No research done yet',
      'in_progress': 'In Progress - Currently being researched',
      'partial': 'Partial - Some info found, more needed',
      'verified': 'Verified - Research complete, sources confirmed',
      'needs_review': 'Needs Review - Conflicting info, needs verification',
      'brick_wall': 'Brick Wall - Cannot find more info',
    };

    // Draw nodes
    allNodes.forEach(node => {
      if (node.x === undefined || node.y === undefined) return;
      const person = node.person;
      const isNotable = person.isNotable || node.isNotableBranch;
      const priority = person.research_priority || 0;
      const status = person.research_status || 'not_started';

      const nodeG = g.append('g')
        .attr('transform', `translate(${node.x - nodeWidth / 2},${node.y - nodeHeight / 2})`);

      // Box - gold for notable people
      nodeG.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 6)
        .attr('fill', isNotable ? '#fef3c7' : (person.sex === 'F' ? '#fce7f3' : '#dbeafe'))
        .attr('stroke', isNotable ? '#f59e0b' : (person.sex === 'F' ? '#ec4899' : '#3b82f6'))
        .attr('stroke-width', isNotable ? 3 : 2)
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
              status
            });
          }
        });

      // Crown for notable
      if (isNotable) {
        nodeG.append('text')
          .attr('x', 8)
          .attr('y', 14)
          .attr('font-size', '12px')
          .text('👑');
      }

      // Coat of arms image - positioned outside tile, overlapping bottom-left corner
      if (person.coatOfArmsUrl) {
        const crestSize = 28;
        const crestUrl = person.coatOfArmsUrl;
        const crestG = nodeG.append('g')
          .style('cursor', 'pointer')
          .on('click', (e: MouseEvent) => {
            e.stopPropagation();
            onPersonClick(person.id);
          })
          .on('mouseenter', function(event: MouseEvent) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              setCrestPopup({ url: crestUrl, x: event.clientX - rect.left + 20, y: event.clientY - rect.top - 75 });
            }
          })
          .on('mouseleave', () => setCrestPopup(null));

        // Position: half outside tile to bottom-left
        crestG.append('image')
          .attr('href', crestUrl)
          .attr('x', -crestSize / 3)
          .attr('y', nodeHeight - crestSize / 2)
          .attr('width', crestSize)
          .attr('height', crestSize)
          .attr('preserveAspectRatio', 'xMidYMid meet');
      }

      // Research status indicator (colored dot in bottom-right) with tooltip
      const statusG = nodeG.append('g').style('cursor', 'help');
      statusG.append('title').text(statusLabels[status] || 'Unknown status');
      statusG.append('circle')
        .attr('cx', nodeWidth - 10)
        .attr('cy', nodeHeight - 10)
        .attr('r', 5)
        .attr('fill', statusColors[status] || '#9ca3af')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

      // Name (clickable) with ellipsis and tooltip
      const maxNameLen = 18;
      const displayName = person.name.length > maxNameLen ? person.name.substring(0, maxNameLen - 2) + '…' : person.name;
      const nameText = nodeG.append('text')
        .attr('x', nodeWidth / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', '#1f2937')
        .style('cursor', 'pointer')
        .on('click', (e) => { e.stopPropagation(); onPersonClick(person.id); })
        .text(displayName);
      // Add tooltip with full name
      nameText.append('title').text(person.name);

      // Years
      const years = person.living
        ? `${person.birth_year || '?'} – Living`
        : `${person.birth_year || '?'} – ${person.death_year || '?'}`;
      nodeG.append('text')
        .attr('x', nodeWidth / 2)
        .attr('y', 36)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#6b7280')
        .text(years);
    });

    // Draw root spouse at level 0 (like descendant view) - positioned to the right of root
    if (rootSpouse && pedigree.x !== undefined && pedigree.y !== undefined) {
      const spouseX = pedigree.x + nodeWidth + spouseGap;
      const spouseY = pedigree.y;
      const status = rootSpouse.research_status || 'not_started';

      // No marriage line - cleaner look

      const spouseG = g.append('g')
        .attr('transform', `translate(${spouseX - nodeWidth / 2},${spouseY - nodeHeight / 2})`);

      spouseG.append('rect')
        .attr('width', nodeWidth).attr('height', nodeHeight).attr('rx', 6)
        .attr('fill', rootSpouse.sex === 'F' ? '#fce7f3' : '#dbeafe')
        .attr('stroke', rootSpouse.sex === 'F' ? '#ec4899' : '#3b82f6')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('click', () => onTileClick(rootSpouse.id));

      // Status indicator
      const spouseStatusG = spouseG.append('g').style('cursor', 'help');
      spouseStatusG.append('title').text(statusLabels[status] || 'Unknown status');
      spouseStatusG.append('circle')
        .attr('cx', nodeWidth - 10).attr('cy', nodeHeight - 10).attr('r', 5)
        .attr('fill', statusColors[status] || '#9ca3af')
        .attr('stroke', '#fff').attr('stroke-width', 1);

      const maxLen = 18;
      const spouseDisplayName = rootSpouse.name.length > maxLen ? rootSpouse.name.substring(0, maxLen - 2) + '…' : rootSpouse.name;
      const spouseNameText = spouseG.append('text')
        .attr('x', nodeWidth / 2).attr('y', 20).attr('text-anchor', 'middle')
        .attr('fill', '#1f2937').attr('font-size', '11px').attr('font-weight', '600')
        .style('cursor', 'pointer')
        .on('click', (e) => { e.stopPropagation(); onPersonClick(rootSpouse.id); })
        .text(spouseDisplayName);
      spouseNameText.append('title').text(rootSpouse.name);

      const spouseYears = rootSpouse.living
        ? `${rootSpouse.birth_year || '?'} – Living`
        : `${rootSpouse.birth_year || '?'} – ${rootSpouse.death_year || '?'}`;
      spouseG.append('text')
        .attr('x', nodeWidth / 2).attr('y', 36).attr('text-anchor', 'middle')
        .attr('fill', '#6b7280').attr('font-size', '10px')
        .text(spouseYears);
    }

    // Draw siblings at level 0 (same as root) - positioned to left of root (spouse is on right)
    // Siblings connect via line to the root's parent connection point
    if (ancestorSiblingPeople.length > 0 && pedigree.x !== undefined && pedigree.y !== undefined) {
      const rootY = pedigree.y;
      const rootX = pedigree.x;

      // Find parent Y for connecting line (if parents exist)
      const parentY = pedigree.father?.y ?? pedigree.mother?.y;
      const midY = parentY !== undefined ? rootY + (parentY - rootY) / 2 : rootY - 30;

      // All siblings go to the LEFT of root (since spouse is on right)
      ancestorSiblingPeople.forEach((sibling, idx) => {
        const sibX = pedigree.x! - (idx + 1) * (nodeWidth + nodeGap);

        // Draw connecting line from sibling to the parent junction
        g.append('path')
          .attr('d', `M${sibX},${rootY} L${sibX},${midY} L${rootX},${midY}`)
          .attr('fill', 'none').attr('stroke', '#9ca3af').attr('stroke-width', 1.5).attr('stroke-opacity', 0.5);

        const sibG = g.append('g')
          .attr('transform', `translate(${sibX - nodeWidth / 2},${rootY - nodeHeight / 2})`)
          .style('cursor', 'pointer').style('opacity', 0.7)
          .on('click', () => onTileClick(sibling.id));

        sibG.append('rect')
          .attr('width', nodeWidth).attr('height', nodeHeight).attr('rx', 6)
          .attr('fill', sibling.isNotable ? '#fef3c7' : (sibling.sex === 'F' ? '#fce7f3' : '#dbeafe'))
          .attr('stroke', sibling.isNotable ? '#f59e0b' : (sibling.sex === 'F' ? '#ec4899' : '#3b82f6'))
          .attr('stroke-width', 2).attr('stroke-dasharray', '4,2');

        // Status indicator
        const sibStatus = sibling.research_status || 'not_started';
        const sibStatusG = sibG.append('g').style('cursor', 'help');
        sibStatusG.append('title').text(statusLabels[sibStatus] || 'Unknown status');
        sibStatusG.append('circle')
          .attr('cx', nodeWidth - 10).attr('cy', nodeHeight - 10).attr('r', 5)
          .attr('fill', statusColors[sibStatus] || '#9ca3af')
          .attr('stroke', '#fff').attr('stroke-width', 1);

        const fullName = sibling.name || 'Unknown';
        const maxLen = 18;
        const displayName = fullName.length > maxLen ? fullName.substring(0, maxLen - 2) + '…' : fullName;
        const nameText = sibG.append('text')
          .attr('x', nodeWidth / 2).attr('y', 20).attr('text-anchor', 'middle')
          .attr('fill', '#1f2937').attr('font-size', '11px').attr('font-weight', '600')
          .style('cursor', 'pointer')
          .on('click', (e: MouseEvent) => { e.stopPropagation(); onPersonClick(sibling.id); })
          .text(displayName);
        nameText.append('title').text(fullName);

        const years = sibling.living
          ? `${sibling.birth_year || '?'} – Living`
          : `${sibling.birth_year || '?'} – ${sibling.death_year || '?'}`;
        sibG.append('text')
          .attr('x', nodeWidth / 2).attr('y', 36).attr('text-anchor', 'middle')
          .attr('fill', '#6b7280').attr('font-size', '10px').text(years);

        // Sibling indicator
        sibG.append('text')
          .attr('x', nodeWidth - 12).attr('y', 14).attr('font-size', '10px').attr('fill', '#9ca3af')
          .text('↔');
      });
    }



    // Draw children of root (-1 level for navigation) ABOVE the root (since tree goes down to ancestors)
    // Note: y is CENTER-based, so we need to account for that
    if (childPeople.length > 0 && pedigree.x !== undefined && pedigree.y !== undefined) {
      const childCenterY = pedigree.y - levelGap; // Center of child tiles
      const totalChildWidth = childPeople.length * nodeWidth + (childPeople.length - 1) * nodeGap;
      const startX = pedigree.x - totalChildWidth / 2 + nodeWidth / 2;

      // Draw connection line from root up to children (same style as other connections)
      const rootTop = pedigree.y - nodeHeight / 2; // Top of root tile (y is center)
      const childBottom = childCenterY + nodeHeight / 2; // Bottom of child tiles
      const midY = childBottom + (rootTop - childBottom) / 2;

      // Vertical line up from root
      g.append('line')
        .attr('x1', pedigree.x).attr('y1', rootTop)
        .attr('x2', pedigree.x).attr('y2', midY)
        .attr('stroke', '#4a5568').attr('stroke-width', 1);

      // Horizontal line spanning children
      if (childPeople.length > 1) {
        g.append('line')
          .attr('x1', startX).attr('y1', midY)
          .attr('x2', startX + (childPeople.length - 1) * (nodeWidth + nodeGap)).attr('y2', midY)
          .attr('stroke', '#4a5568').attr('stroke-width', 1);
      }

      childPeople.forEach((child, idx) => {
        const childX = startX + idx * (nodeWidth + nodeGap);

        // Line from horizontal bar up to child bottom
        g.append('line')
          .attr('x1', childX).attr('y1', midY)
          .attr('x2', childX).attr('y2', childBottom)
          .attr('stroke', '#4a5568').attr('stroke-width', 1);

        // Position tile with center-based y (same as other nodes)
        const tileG = g.append('g')
          .attr('transform', `translate(${childX - nodeWidth / 2}, ${childCenterY - nodeHeight / 2})`)
          .style('cursor', 'pointer').style('opacity', 0.7)
          .on('click', () => onTileClick(child.id));

        tileG.append('rect')
          .attr('width', nodeWidth).attr('height', nodeHeight).attr('rx', 6)
          .attr('fill', child.isNotable ? '#fef3c7' : (child.sex === 'F' ? '#fce7f3' : '#dbeafe'))
          .attr('stroke', child.isNotable ? '#f59e0b' : (child.sex === 'F' ? '#ec4899' : '#3b82f6'))
          .attr('stroke-width', 2).attr('stroke-dasharray', '4,2');

        const fullName = child.name || 'Unknown';
        const maxLen = 18;
        const displayName = fullName.length > maxLen ? fullName.substring(0, maxLen - 2) + '…' : fullName;
        const nameText = tileG.append('text')
          .attr('x', nodeWidth / 2).attr('y', 20).attr('text-anchor', 'middle')
          .attr('fill', '#1f2937').attr('font-size', '11px').attr('font-weight', '600')
          .text(displayName);
        nameText.append('title').text(fullName + ' (click to navigate)');

        const years = child.living
          ? `${child.birth_year || '?'} – Living`
          : `${child.birth_year || '?'} – ${child.death_year || '?'}`;
        tileG.append('text')
          .attr('x', nodeWidth / 2).attr('y', 36).attr('text-anchor', 'middle')
          .attr('fill', '#6b7280').attr('font-size', '10px').text(years);

        // Down arrow to indicate navigation
        tileG.append('text')
          .attr('x', nodeWidth - 12).attr('y', 14).attr('font-size', '10px').attr('fill', '#9ca3af')
          .text('⬇');
      });
    }

    // Zoom/pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);

    // Fit to view
    const bounds = g.node()?.getBBox();
    if (bounds) {
      const { width, height } = dimensions;
      const scale = Math.min(width / (bounds.width + 100), height / (bounds.height + 100), 1);
      const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
      const ty = (height - bounds.height * scale) / 2 - bounds.y * scale;
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }
  }, [data, rootPersonId, showAncestors, dimensions, buildPedigree, buildDescendantChain, buildDescendantTree, onPersonClick, onTileClick]);

  const STATUS_OPTIONS = [
    { value: 'not_started', label: '⚪ Not Started', desc: 'No research done yet' },
    { value: 'in_progress', label: '🔵 In Progress', desc: 'Currently being researched' },
    { value: 'partial', label: '🟡 Partial', desc: 'Some info found, more needed' },
    { value: 'verified', label: '🟢 Verified', desc: 'Research complete, sources confirmed' },
    { value: 'needs_review', label: '🟠 Needs Review', desc: 'Conflicting info, needs verification' },
    { value: 'brick_wall', label: '🔴 Brick Wall', desc: 'Cannot find more info' },
  ];

  return (
    <div className="relative w-full h-full" ref={containerRef} onClick={() => setPriorityPopup(null)}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-600">
          Failed to load data: {error.message}
        </div>
      )}
      {loading && !data && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">Loading...</div>
      )}

      {/* Notable Relatives Panel */}
      {data && data.notableRelatives.length > 0 && (
        <div className="absolute top-4 right-4 z-40">
          <div className="bg-white rounded-lg shadow-lg border border-amber-300 overflow-hidden max-w-xs">
            <button
              onClick={(e) => { e.stopPropagation(); setNotablePanelOpen(!notablePanelOpen); }}
              className="w-full px-3 py-2 bg-amber-50 hover:bg-amber-100 flex items-center justify-between text-sm font-medium text-amber-800"
            >
              <span>👑 Notable Relatives ({data.notableRelatives.length})</span>
              <span className="text-xs">{notablePanelOpen ? '▼' : '▶'}</span>
            </button>
            {notablePanelOpen && (
              <div className="max-h-64 overflow-y-auto">
                {data.notableRelatives.map((rel) => (
                  <button
                    key={rel.person.id}
                    onClick={(e) => { e.stopPropagation(); onTileClick(rel.person.id); }}
                    className="w-full px-3 py-2 text-left hover:bg-amber-50 border-t border-amber-100 text-sm"
                  >
                    <div className="font-medium text-gray-800">{rel.person.name_full}</div>
                    <div className="text-xs text-gray-500">{rel.generation} generation{rel.generation !== 1 ? 's' : ''} away</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Priority/Status Popup */}
      {priorityPopup && (
        <div
          className="absolute bg-white rounded-lg shadow-xl border p-3 z-50"
          style={{ left: priorityPopup.x, top: priorityPopup.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-semibold text-sm mb-2 truncate max-w-48">{priorityPopup.personName}</div>

          <div className="mb-3">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
              Priority
              <span className="text-gray-400 cursor-help" title="0 = No urgency, 10 = Research immediately. Higher priority people appear first in research queue.">ⓘ</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min="0"
                max="10"
                value={priorityPopup.priority}
                onChange={(e) => {
                  const newPriority = parseInt(e.target.value);
                  setPriorityPopup({ ...priorityPopup, priority: newPriority });
                }}
                onMouseUp={() => handlePriorityChange(priorityPopup.personId, priorityPopup.priority)}
                className="w-20"
              />
              <span className="text-sm font-bold w-6">{priorityPopup.priority}</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {priorityPopup.priority === 0 ? 'Not prioritized' :
               priorityPopup.priority <= 3 ? 'Low priority' :
               priorityPopup.priority <= 6 ? 'Medium priority' :
               priorityPopup.priority <= 9 ? 'High priority' : 'Urgent'}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
              Status
              <span className="text-gray-400 cursor-help" title="Tracks research progress: Not Started → In Progress → Partial/Verified. Use Brick Wall when stuck.">ⓘ</span>
            </label>
            <select
              value={priorityPopup.status}
              onChange={(e) => {
                setPriorityPopup({ ...priorityPopup, status: e.target.value });
                handleStatusChange(priorityPopup.personId, e.target.value);
              }}
              className="w-full mt-1 text-sm rounded border-gray-300 p-1"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value} title={s.desc}>{s.label}</option>
              ))}
            </select>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {STATUS_OPTIONS.find(s => s.value === priorityPopup.status)?.desc}
            </div>
          </div>

          <div className="mt-2 text-right">
            <button
              onClick={() => setPriorityPopup(null)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Crest Hover Popup - larger coat of arms on mouseover */}
      {crestPopup && (
        <div
          className="absolute pointer-events-none z-50"
          style={{ left: crestPopup.x, top: crestPopup.y }}
        >
          <div className="bg-white rounded-lg shadow-xl border-2 border-amber-400 p-2">
            <img
              src={crestPopup.url}
              alt="Coat of Arms"
              className="w-36 h-36 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
