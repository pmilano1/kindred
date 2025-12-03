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
}

interface TreeFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
  marriage_year: number | null;
  marriage_place: string | null;
  children: string[];
}

interface TreeData {
  people: Record<string, TreePerson>;
  families: TreeFamily[];
}

// Pedigree node - each person has their own node with father/mother links
interface PedigreeNode {
  id: string;
  person: TreePerson;
  father?: PedigreeNode;
  mother?: PedigreeNode;
  x?: number;
  y?: number;
}

interface FamilyTreeProps {
  rootPersonId: string;
  showAncestors: boolean;
  onPersonClick: (id: string) => void;
  onTileClick: (id: string) => void;
}

export default function FamilyTree({ rootPersonId, showAncestors, onPersonClick, onTileClick }: FamilyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<TreeData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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
  const buildPedigree = useCallback((personId: string, depth = 0, maxDepth = 6): PedigreeNode | null => {
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

    const { width, height } = dimensions;
    const nodeWidth = 140;
    const nodeHeight = 50;
    const levelGap = 180; // Horizontal gap between generations
    const verticalGap = 10; // Vertical gap between father/mother

    // Calculate positions using pedigree layout
    // Generation 0 (root) is on the left, ancestors expand to the right
    const positionNodes = (node: PedigreeNode, gen: number, yMin: number, yMax: number) => {
      node.x = gen * levelGap + 50;
      node.y = (yMin + yMax) / 2;

      if (node.father || node.mother) {
        const midY = (yMin + yMax) / 2;
        if (node.father) {
          positionNodes(node.father, gen + 1, yMin, midY - verticalGap / 2);
        }
        if (node.mother) {
          positionNodes(node.mother, gen + 1, midY + verticalGap / 2, yMax);
        }
      }
    };

    positionNodes(pedigree, 0, 50, height - 50);

    // Collect all nodes
    const allNodes: PedigreeNode[] = [];
    const collectNodes = (node: PedigreeNode) => {
      allNodes.push(node);
      if (node.father) collectNodes(node.father);
      if (node.mother) collectNodes(node.mother);
    };
    collectNodes(pedigree);

    const g = svg.append('g');

    // Draw links
    const drawLinks = (node: PedigreeNode) => {
      if (node.father && node.x !== undefined && node.y !== undefined && node.father.x !== undefined && node.father.y !== undefined) {
        g.append('path')
          .attr('d', `M${node.x + nodeWidth / 2},${node.y}
                      C${(node.x + node.father.x) / 2 + nodeWidth / 2},${node.y}
                       ${(node.x + node.father.x) / 2 + nodeWidth / 2},${node.father.y}
                       ${node.father.x},${node.father.y}`)
          .attr('fill', 'none')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.6);
        drawLinks(node.father);
      }
      if (node.mother && node.x !== undefined && node.y !== undefined && node.mother.x !== undefined && node.mother.y !== undefined) {
        g.append('path')
          .attr('d', `M${node.x + nodeWidth / 2},${node.y}
                      C${(node.x + node.mother.x) / 2 + nodeWidth / 2},${node.y}
                       ${(node.x + node.mother.x) / 2 + nodeWidth / 2},${node.mother.y}
                       ${node.mother.x},${node.mother.y}`)
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

      const nodeG = g.append('g')
        .attr('transform', `translate(${node.x - nodeWidth / 2},${node.y - nodeHeight / 2})`);

      // Box
      nodeG.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 6)
        .attr('fill', person.sex === 'F' ? '#fce7f3' : '#dbeafe')
        .attr('stroke', person.sex === 'F' ? '#ec4899' : '#3b82f6')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('click', () => onTileClick(person.id));

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

    // Zoom/pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);

    // Fit to view
    const bounds = g.node()?.getBBox();
    if (bounds) {
      const scale = Math.min(width / (bounds.width + 100), height / (bounds.height + 100), 1);
      const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
      const ty = (height - bounds.height * scale) / 2 - bounds.y * scale;
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }
  }, [data, rootPersonId, showAncestors, dimensions, buildPedigree, onPersonClick, onTileClick]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg" />
      {!data && <div className="absolute inset-0 flex items-center justify-center text-gray-500">Loading...</div>}
    </div>
  );
}
