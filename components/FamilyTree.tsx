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

      positionDescendants(descendantTree, 0);

      // Collect all nodes for rendering
      const allDescendants: DescendantNode[] = [];
      const collectNodes = (node: DescendantNode) => {
        allDescendants.push(node);
        node.children.forEach(collectNodes);
      };
      collectNodes(descendantTree);

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

      // Draw nodes (person tiles)
      allDescendants.forEach(node => {
        if (node.x === undefined || node.y === undefined) return;

        // Draw main person
        const drawPersonTile = (person: TreePerson, x: number, y: number, _isSpouse = false) => {
          const tileG = g.append('g')
            .attr('transform', `translate(${x - nodeWidth / 2}, ${y})`)
            .style('cursor', 'pointer')
            .on('click', () => onTileClick(person.id || node.id))
            .on('dblclick', () => onPersonClick(person.id || node.id));

          // Background
          const bgColor = person.sex === 'M' ? '#1e3a5f' : person.sex === 'F' ? '#4a1942' : '#374151';
          tileG.append('rect')
            .attr('width', nodeWidth).attr('height', nodeHeight)
            .attr('rx', 4)
            .attr('fill', bgColor)
            .attr('stroke', person.living ? '#10b981' : '#4a5568')
            .attr('stroke-width', person.living ? 2 : 1);

          // Name with ellipsis and tooltip
          const fullName = person.name || 'Unknown';
          const maxNameLen = 16;
          const displayName = fullName.length > maxNameLen ? fullName.substring(0, maxNameLen - 1) + '…' : fullName;
          const nameText = tileG.append('text')
            .attr('x', nodeWidth / 2).attr('y', 16)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white').attr('font-size', '11px').attr('font-weight', 'bold')
            .text(displayName);
          nameText.append('title').text(fullName);

          // Years
          const years = person.birth_year
            ? (person.death_year ? `${person.birth_year}–${person.death_year}` : `b. ${person.birth_year}`)
            : '';
          if (years) {
            tileG.append('text')
              .attr('x', nodeWidth / 2).attr('y', 30)
              .attr('text-anchor', 'middle')
              .attr('fill', '#9ca3af').attr('font-size', '9px')
              .text(years);
          }

          // Crown for notable
          if (person.isNotable) {
            tileG.append('text')
              .attr('x', -6).attr('y', 6)
              .attr('font-size', '14px')
              .text('👑');
          }

          // Coat of arms with hover popup
          if (person.hasCoatOfArms && person.coatOfArmsUrl) {
            const crestSize = 24;
            const crestUrl = person.coatOfArmsUrl;
            tileG.append('image')
              .attr('href', crestUrl)
              .attr('x', -crestSize / 3)
              .attr('y', nodeHeight - crestSize / 2)
              .attr('width', crestSize).attr('height', crestSize)
              .attr('preserveAspectRatio', 'xMidYMid meet')
              .style('cursor', 'pointer')
              .on('mouseenter', function(event: MouseEvent) {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  setCrestPopup({ url: crestUrl, x: event.clientX - rect.left + 20, y: event.clientY - rect.top - 75 });
                }
              })
              .on('mouseleave', () => setCrestPopup(null));
          }
        };

        // Draw main person
        const personX = node.spouse ? node.x - nodeWidth / 2 - spouseGap / 2 : node.x;
        drawPersonTile(node.person, personX, node.y);

        // Draw spouse if exists
        if (node.spouse) {
          const spouseX = node.x + nodeWidth / 2 + spouseGap / 2;
          drawPersonTile(node.spouse, spouseX, node.y, true);
        }
      });

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

    const g = svg.append('g');

    // Draw links - from bottom of person to top of parent (tree flows down)
    const drawLinks = (node: PedigreeNode) => {
      if (node.father && node.x !== undefined && node.y !== undefined && node.father.x !== undefined && node.father.y !== undefined) {
        const startX = node.x;
        const startY = node.y + nodeHeight / 2; // bottom of person
        const endX = node.father.x;
        const endY = node.father.y - nodeHeight / 2; // top of father
        g.append('path')
          .attr('d', `M${startX},${startY} C${startX},${(startY + endY) / 2} ${endX},${(startY + endY) / 2} ${endX},${endY}`)
          .attr('fill', 'none')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.6);
        drawLinks(node.father);
      }
      if (node.mother && node.x !== undefined && node.y !== undefined && node.mother.x !== undefined && node.mother.y !== undefined) {
        const startX = node.x;
        const startY = node.y + nodeHeight / 2; // bottom of person
        const endX = node.mother.x;
        const endY = node.mother.y - nodeHeight / 2; // top of mother
        g.append('path')
          .attr('d', `M${startX},${startY} C${startX},${(startY + endY) / 2} ${endX},${(startY + endY) / 2} ${endX},${endY}`)
          .attr('fill', 'none')
          .attr('stroke', '#ec4899')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.6);
        drawLinks(node.mother);
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
            const crestG = nodeG.append('g')
              .style('cursor', 'pointer')
              .on('click', (e: MouseEvent) => {
                e.stopPropagation();
                onPersonClick(personId);
              });
            crestG.append('title').text('Family coat of arms - click to view profile');

            // Position: half outside tile to bottom-left
            crestG.append('image')
              .attr('href', person.coatOfArmsUrl)
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
    </div>
  );
}
