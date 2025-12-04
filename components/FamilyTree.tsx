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

export default function FamilyTree({ rootPersonId, showAncestors, onPersonClick, onTileClick }: FamilyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<TreeData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [priorityPopup, setPriorityPopup] = useState<PriorityPopup | null>(null);

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

  // Draw pedigree chart
  useEffect(() => {
    if (!data || !svgRef.current || !rootPersonId) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (!showAncestors) {
      // Descendant view - use simple message for now
      svg.append('text')
        .attr('x', dimensions.width / 2)
        .attr('y', dimensions.height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .text('Descendant view coming soon');
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

      // Research status indicator (small colored dot in bottom-left)
      nodeG.append('circle')
        .attr('cx', 10)
        .attr('cy', nodeHeight - 10)
        .attr('r', 4)
        .attr('fill', statusColors[status] || '#9ca3af')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

      // Priority indicator (small number in bottom-right if priority > 0)
      if (priority > 0) {
        nodeG.append('rect')
          .attr('x', nodeWidth - 18)
          .attr('y', nodeHeight - 16)
          .attr('width', 14)
          .attr('height', 12)
          .attr('rx', 2)
          .attr('fill', priority >= 7 ? '#ef4444' : priority >= 4 ? '#f97316' : '#3b82f6');
        nodeG.append('text')
          .attr('x', nodeWidth - 11)
          .attr('y', nodeHeight - 6)
          .attr('text-anchor', 'middle')
          .attr('font-size', '9px')
          .attr('font-weight', 'bold')
          .attr('fill', '#fff')
          .text(priority.toString());
      }

      // Living indicator
      if (person.living) {
        nodeG.append('circle')
          .attr('cx', nodeWidth - 10)
          .attr('cy', 10)
          .attr('r', 5)
          .attr('fill', '#22c55e')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);
      }

      // Name (clickable)
      const displayName = person.name.length > 20 ? person.name.substring(0, 18) + '..' : person.name;
      nodeG.append('text')
        .attr('x', nodeWidth / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', '#1f2937')
        .style('cursor', 'pointer')
        .on('click', (e) => { e.stopPropagation(); onPersonClick(person.id); })
        .text(displayName);

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

    // Always draw notable connections branch (Josephine line) if ancestor is visible
    if (data.notableConnections) {
      const connection = data.notableConnections.find(nc =>
        allNodes.some(n => n.id === nc.branchingAncestorId)
      );

      if (connection) {
        const branchingNode = allNodes.find(n => n.id === connection.branchingAncestorId);
        if (branchingNode && branchingNode.x !== undefined && branchingNode.y !== undefined) {
          // Draw the notable branch to the right of the branching ancestor
          const branchStartX = branchingNode.x + nodeWidth / 2 + 30;
          const branchStartY = branchingNode.y;

          // Draw connection line from ancestor to branch (solid line - confirmed relationship)
          g.append('path')
            .attr('d', `M${branchingNode.x + nodeWidth/2},${branchingNode.y} L${branchStartX - 15},${branchStartY}`)
            .attr('fill', 'none')
            .attr('stroke', '#f59e0b')
            .attr('stroke-width', 2);

          // Draw notable path nodes
          connection.path.forEach((personId, idx) => {
            const person = data.people[personId];
            if (!person) return;

            const nodeX = branchStartX + idx * (nodeWidth + 15);
            const nodeY = branchStartY + idx * 25;

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

            // Crown for Josephine
            if (person.isNotable) {
              nodeG.append('text').attr('x', 8).attr('y', 14).attr('font-size', '12px').text('👑');
            }

            const displayName = person.name.length > 20 ? person.name.substring(0, 18) + '..' : person.name;
            nodeG.append('text')
              .attr('x', nodeWidth / 2).attr('y', 20)
              .attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', '600')
              .attr('fill', '#1f2937').style('cursor', 'pointer')
              .on('click', (e) => { e.stopPropagation(); onPersonClick(personId); })
              .text(displayName);

            const years = `${person.birth_year || '?'} – ${person.death_year || '?'}`;
            nodeG.append('text')
              .attr('x', nodeWidth / 2).attr('y', 36)
              .attr('text-anchor', 'middle').attr('font-size', '10px').attr('fill', '#6b7280')
              .text(years);

            // Draw connecting line to previous node in path
            if (idx > 0) {
              const prevX = branchStartX + (idx-1) * (nodeWidth + 15);
              const prevY = branchStartY + (idx-1) * 25;
              g.append('path')
                .attr('d', `M${prevX + nodeWidth/2},${prevY + nodeHeight/2} L${nodeX - nodeWidth/2},${nodeY - nodeHeight/2}`)
                .attr('fill', 'none')
                .attr('stroke', '#f59e0b')
                .attr('stroke-width', 2)
                .attr('stroke-opacity', 0.7);
            }
          });

          // Label for the branch
          g.append('text')
            .attr('x', branchStartX)
            .attr('y', branchStartY - nodeHeight/2 - 8)
            .attr('font-size', '10px')
            .attr('font-weight', '600')
            .attr('fill', '#b45309')
            .text('👑 Collateral Line to Joséphine Bonaparte');
        }
      }
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
  }, [data, rootPersonId, showAncestors, dimensions, buildPedigree, buildDescendantChain, onPersonClick, onTileClick]);

  const STATUS_OPTIONS = [
    { value: 'not_started', label: '⚪ Not Started' },
    { value: 'in_progress', label: '🔵 In Progress' },
    { value: 'partial', label: '🟡 Partial' },
    { value: 'verified', label: '🟢 Verified' },
    { value: 'needs_review', label: '🟠 Needs Review' },
    { value: 'brick_wall', label: '🔴 Brick Wall' },
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
            <label className="text-xs font-medium text-gray-600">Priority</label>
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
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Status</label>
            <select
              value={priorityPopup.status}
              onChange={(e) => {
                setPriorityPopup({ ...priorityPopup, status: e.target.value });
                handleStatusChange(priorityPopup.personId, e.target.value);
              }}
              className="w-full mt-1 text-sm rounded border-gray-300 p-1"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
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
