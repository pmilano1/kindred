'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

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

interface NotableConnection {
  branchingAncestorId: string;
  siblingId: string;
  notablePersonId: string;
  path: string[];
}

interface TreeData {
  people: Record<string, TreePerson>;
  families: TreeFamily[];
  notableConnections?: NotableConnection[];
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
  const [data, setData] = useState<TreeData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [priorityPopup, setPriorityPopup] = useState<PriorityPopup | null>(null);
  const [crestPopup, setCrestPopup] = useState<CrestPopup | null>(null);

  const handlePriorityChange = async (personId: string, priority: number) => {
    await fetch(`/api/research/${personId}/priority`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    });
    // Update local data
    if (data && data.people[personId]) {
      setData({
        ...data,
        people: {
          ...data.people,
          [personId]: { ...data.people[personId], research_priority: priority }
        }
      });
    }
    setPriorityPopup(null);
  };

  const handleStatusChange = async (personId: string, status: string) => {
    await fetch(`/api/research/${personId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    // Update local data
    if (data && data.people[personId]) {
      setData({
        ...data,
        people: {
          ...data.people,
          [personId]: { ...data.people[personId], research_status: status }
        }
      });
    }
  };

  // Fetch data
  useEffect(() => {
    fetch('/api/tree')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

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
          g.append('line')
            .attr('x1', node.x - nodeWidth / 2 - spouseGap / 2)
            .attr('y1', node.y + nodeHeight / 2)
            .attr('x2', node.x + nodeWidth / 2 + spouseGap / 2)
            .attr('y2', node.y + nodeHeight / 2)
            .attr('stroke', '#f59e0b').attr('stroke-width', 2);
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
          g.append('line')
            .attr('x1', descendantTree.x - nodeWidth/2 - spouseGap + nodeWidth/2)
            .attr('y1', 30 + nodeHeight/2)
            .attr('x2', descendantTree.x + nodeWidth/2 + spouseGap - nodeWidth/2)
            .attr('y2', 30 + nodeHeight/2)
            .attr('stroke', '#f59e0b').attr('stroke-width', 2);
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
    const levelGap = 52; // Vertical gap between generations
    const nodeGap = 4; // Horizontal gap between sibling nodes

    // Position nodes bottom-up: leaves first, parents centered above children
    let leafX = 0;
    const positionNodes = (node: PedigreeNode, gen: number): number => {
      node.y = gen * levelGap + 30;

      if (!node.father && !node.mother) {
        // Leaf node - assign next available X
        node.x = leafX + nodeWidth / 2;
        leafX += nodeWidth + nodeGap;
        return node.x;
      }

      // Position children first
      let fatherX = node.x || 0;
      let motherX = node.x || 0;

      if (node.father) {
        fatherX = positionNodes(node.father, gen + 1);
      }
      if (node.mother) {
        motherX = positionNodes(node.mother, gen + 1);
      }

      // Parent centered between children
      if (node.father && node.mother) {
        node.x = (fatherX + motherX) / 2;
      } else if (node.father) {
        node.x = fatherX;
      } else if (node.mother) {
        node.x = motherX;
      }

      return node.x!;
    };

    positionNodes(pedigree, 0);

    // Collect all nodes
    const allNodes: PedigreeNode[] = [];
    const collectNodes = (node: PedigreeNode) => {
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

    // Draw links - identical to descendant view (vertical from node, horizontal bar, vertical to parents)
    const drawLinks = (node: PedigreeNode) => {
      if (node.x === undefined || node.y === undefined) return;
      const hasParents = node.father || node.mother;
      if (!hasParents) return;

      // Get parent y position (parents are ABOVE, so lower y value)
      const parentY = node.father?.y ?? node.mother?.y;
      if (parentY === undefined) return;

      // Same pattern as descendant: node bottom → midY → parent bottom
      const nodeTop = node.y;
      const parentBottom = parentY + nodeHeight;
      const midY = parentBottom + (nodeTop - parentBottom) / 2;

      // Vertical line UP from current node top to midY
      g.append('line')
        .attr('x1', node.x).attr('y1', nodeTop)
        .attr('x2', node.x).attr('y2', midY)
        .attr('stroke', '#4a5568').attr('stroke-width', 1);

      // Get parent x positions
      const parentXs: number[] = [];
      if (node.father?.x !== undefined) parentXs.push(node.father.x);
      if (node.mother?.x !== undefined) parentXs.push(node.mother.x);

      if (parentXs.length > 0) {
        // Horizontal line spanning parents at midY
        const minX = Math.min(...parentXs);
        const maxX = Math.max(...parentXs);
        g.append('line')
          .attr('x1', minX).attr('y1', midY)
          .attr('x2', maxX).attr('y2', midY)
          .attr('stroke', '#4a5568').attr('stroke-width', 1);

        // Vertical lines UP from midY to each parent's bottom
        if (node.father?.x !== undefined && node.father?.y !== undefined) {
          g.append('line')
            .attr('x1', node.father.x).attr('y1', midY)
            .attr('x2', node.father.x).attr('y2', node.father.y + nodeHeight)
            .attr('stroke', '#4a5568').attr('stroke-width', 1);
          drawLinks(node.father);
        }
        if (node.mother?.x !== undefined && node.mother?.y !== undefined) {
          g.append('line')
            .attr('x1', node.mother.x).attr('y1', midY)
            .attr('x2', node.mother.x).attr('y2', node.mother.y + nodeHeight)
            .attr('stroke', '#4a5568').attr('stroke-width', 1);
          drawLinks(node.mother);
        }

        // Marriage line between parents (gold) - between their tiles
        if (node.father?.x !== undefined && node.mother?.x !== undefined && node.father?.y !== undefined) {
          g.append('line')
            .attr('x1', node.father.x + nodeWidth/2).attr('y1', node.father.y + nodeHeight/2)
            .attr('x2', node.mother.x - nodeWidth/2).attr('y2', node.father.y + nodeHeight/2)
            .attr('stroke', '#f59e0b').attr('stroke-width', 2);
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

    // Draw notable connections ONLY if the branching ancestor is in the current pedigree
    // Position them BELOW the main tree to avoid overlapping
    if (data.notableConnections) {
      // Find max Y (deepest generation) to position notable connections below
      const maxY = Math.max(...allNodes.filter(n => n.y !== undefined).map(n => n.y!));

      // Draw each connection that has a visible branching ancestor
      let notableYOffset = maxY + nodeHeight + 80; // Start below the tree

      data.notableConnections.forEach(connection => {
        const branchingNode = allNodes.find(n => n.id === connection.branchingAncestorId);
        if (!branchingNode || branchingNode.x === undefined || branchingNode.y === undefined) return;

        // Position notable branch at bottom, centered under branching ancestor
        const branchStartX = Math.max(branchingNode.x, 100);
        const branchStartY = notableYOffset;

        // Get notable person info for label
        const notablePerson = data.people[connection.notablePersonId];
        const notableName = notablePerson?.name || 'Notable Person';

        // Draw dashed connection line from branching ancestor down to notable branch
        // Line goes down from ancestor, then horizontally, then to the top of the first notable tile
        const labelY = branchStartY - nodeHeight/2 - 25; // Above the label
        g.append('path')
          .attr('d', `M${branchingNode.x},${branchingNode.y + nodeHeight/2}
                      L${branchingNode.x},${labelY}
                      L${branchStartX - nodeWidth/2 - 10},${labelY}
                      L${branchStartX - nodeWidth/2 - 10},${branchStartY - nodeHeight/2}`)
          .attr('fill', 'none')
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,3');

        // Label for the branch - positioned ABOVE the tiles
        g.append('text')
          .attr('x', branchStartX - nodeWidth/2)
          .attr('y', branchStartY - nodeHeight/2 - 12)
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#b45309')
          .text(`👑 Collateral Line to ${notableName}`);

        // Draw notable path nodes horizontally
        connection.path.forEach((personId, idx) => {
          const person = data.people[personId];
          if (!person) return;

          const nodeX = branchStartX + idx * (nodeWidth + 10);
          const nodeY = branchStartY;

          const nodeG = g.append('g')
            .attr('transform', `translate(${nodeX - nodeWidth/2},${nodeY - nodeHeight/2})`);

          // Gold box for notable branch
          nodeG.append('rect')
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 6)
            .attr('fill', person.isNotable ? '#fef3c7' : '#fffbeb')
            .attr('stroke', '#f59e0b')
            .attr('stroke-width', person.isNotable ? 3 : 2)
            .style('cursor', 'pointer')
            .on('click', () => onTileClick(personId));

          // Crown for notable person - positioned outside tile, overlapping top-left corner
          if (person.isNotable) {
            const crownSize = 20;
            nodeG.append('text')
              .attr('x', -crownSize / 3)
              .attr('y', crownSize / 3)
              .attr('font-size', '16px')
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
                onPersonClick(personId);
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

          const maxNameLen = 18;
          const displayName = person.name.length > maxNameLen ? person.name.substring(0, maxNameLen - 2) + '…' : person.name;
          const nameText = nodeG.append('text')
            .attr('x', nodeWidth / 2).attr('y', 22)
            .attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', '600')
            .attr('fill', '#1f2937').style('cursor', 'pointer')
            .on('click', (e: MouseEvent) => { e.stopPropagation(); onPersonClick(personId); })
            .text(displayName);
          nameText.append('title').text(person.name);

          const years = `${person.birth_year || '?'} – ${person.death_year || '?'}`;
          nodeG.append('text')
            .attr('x', nodeWidth / 2).attr('y', 36)
            .attr('text-anchor', 'middle').attr('font-size', '10px').attr('fill', '#6b7280')
            .text(years);

          // Draw connecting line to previous node in path
          if (idx > 0) {
            const prevX = branchStartX + (idx-1) * (nodeWidth + 10);
            g.append('path')
              .attr('d', `M${prevX + nodeWidth/2},${nodeY} L${nodeX - nodeWidth/2},${nodeY}`)
              .attr('fill', 'none')
              .attr('stroke', '#f59e0b')
              .attr('stroke-width', 2);
          }
        });

        // Move offset down for next notable connection
        notableYOffset += nodeHeight + 60;
      });
    }

    // Draw children of root (-1 level for navigation) ABOVE the root (since tree goes down to ancestors)
    if (childPeople.length > 0 && pedigree.x !== undefined && pedigree.y !== undefined) {
      const childY = pedigree.y - levelGap; // Same spacing as other levels
      const totalChildWidth = childPeople.length * nodeWidth + (childPeople.length - 1) * nodeGap;
      const startX = pedigree.x - totalChildWidth / 2 + nodeWidth / 2;

      // Draw connection line from root up to children (same style as other connections)
      const rootTop = pedigree.y; // Top of root tile (y is already at top)
      const childBottom = childY + nodeHeight;
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

        // Line from horizontal bar up to child
        g.append('line')
          .attr('x1', childX).attr('y1', midY)
          .attr('x2', childX).attr('y2', childBottom)
          .attr('stroke', '#4a5568').attr('stroke-width', 1);

        const tileG = g.append('g')
          .attr('transform', `translate(${childX - nodeWidth / 2}, ${childY})`)
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
      {!data && <div className="absolute inset-0 flex items-center justify-center text-gray-500">Loading...</div>}

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
