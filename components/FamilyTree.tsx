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

export default function FamilyTree({ rootPersonId, showAncestors, onPersonClick, onTileClick, showNotableConnections = true }: FamilyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<TreeData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showNotable, setShowNotable] = useState(showNotableConnections);

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

    // Draw nodes
    allNodes.forEach(node => {
      if (node.x === undefined || node.y === undefined) return;
      const person = node.person;
      const isNotable = person.isNotable || node.isNotableBranch;

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
        .on('click', () => onTileClick(person.id));

      // Crown for notable
      if (isNotable) {
        nodeG.append('text')
          .attr('x', 8)
          .attr('y', 14)
          .attr('font-size', '12px')
          .text('👑');
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

    // Draw notable connections branch if enabled and applicable
    if (showNotable && data.notableConnections) {
      const connection = data.notableConnections.find(nc =>
        allNodes.some(n => n.id === nc.branchingAncestorId)
      );

      if (connection) {
        const branchingNode = allNodes.find(n => n.id === connection.branchingAncestorId);
        if (branchingNode && branchingNode.x !== undefined && branchingNode.y !== undefined) {
          // Draw the notable branch to the right of the branching ancestor
          const branchStartX = branchingNode.x + nodeWidth / 2 + 30;
          const branchStartY = branchingNode.y;

          // Draw connection line from ancestor to branch
          g.append('path')
            .attr('d', `M${branchingNode.x + nodeWidth/2},${branchingNode.y} L${branchStartX - 15},${branchStartY}`)
            .attr('fill', 'none')
            .attr('stroke', '#f59e0b')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,3');

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
            .text('👑 Josephine Bonaparte Connection');
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
  }, [data, rootPersonId, showAncestors, showNotable, dimensions, buildPedigree, onPersonClick, onTileClick]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      {data?.notableConnections && data.notableConnections.length > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <label className="flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-lg shadow text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showNotable}
              onChange={(e) => setShowNotable(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            <span>👑 Show Notable Connections</span>
          </label>
        </div>
      )}
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg" />
      {!data && <div className="absolute inset-0 flex items-center justify-center text-gray-500">Loading...</div>}
    </div>
  );
}
