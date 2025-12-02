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

interface TreeNode {
  id: string;
  name: string;
  sex: 'M' | 'F' | null;
  birth_year: number | null;
  death_year: number | null;
  living: boolean;
  familysearch_id: string | null;
  spouse?: TreePerson;
  children?: TreeNode[];
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
  const [transform, setTransform] = useState(d3.zoomIdentity);

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

  // Build ancestor tree from person going up
  const buildAncestorTree = useCallback((personId: string, depth = 0): TreeNode | null => {
    if (!data || depth > 8) return null;
    const person = data.people[personId];
    if (!person) return null;

    const node: TreeNode = {
      id: person.id,
      name: person.name,
      sex: person.sex,
      birth_year: person.birth_year,
      death_year: person.death_year,
      living: person.living,
      familysearch_id: person.familysearch_id,
    };

    // Find family where this person is a child
    const parentFamily = data.families.find(f => f.children.includes(personId));
    if (parentFamily) {
      const parents: TreeNode[] = [];
      if (parentFamily.husband_id) {
        const father = buildAncestorTree(parentFamily.husband_id, depth + 1);
        if (father) parents.push(father);
      }
      if (parentFamily.wife_id) {
        const mother = buildAncestorTree(parentFamily.wife_id, depth + 1);
        if (mother) parents.push(mother);
      }
      if (parents.length > 0) {
        node.children = parents;
      }
    }

    return node;
  }, [data]);

  // Build descendant tree from person going down
  const buildDescendantTree = useCallback((personId: string, depth = 0): TreeNode | null => {
    if (!data || depth > 8) return null;
    const person = data.people[personId];
    if (!person) return null;

    const node: TreeNode = {
      id: person.id,
      name: person.name,
      sex: person.sex,
      birth_year: person.birth_year,
      death_year: person.death_year,
      living: person.living,
      familysearch_id: person.familysearch_id,
    };

    // Find families where this person is a spouse
    const spouseFamilies = data.families.filter(
      f => f.husband_id === personId || f.wife_id === personId
    );

    if (spouseFamilies.length > 0) {
      const family = spouseFamilies[0]; // Use first family
      const spouseId = family.husband_id === personId ? family.wife_id : family.husband_id;
      if (spouseId && data.people[spouseId]) {
        node.spouse = data.people[spouseId];
      }
      
      const childNodes: TreeNode[] = [];
      for (const childId of family.children) {
        const childNode = buildDescendantTree(childId, depth + 1);
        if (childNode) childNodes.push(childNode);
      }
      if (childNodes.length > 0) {
        node.children = childNodes;
      }
    }

    return node;
  }, [data]);

  // Draw tree - vertical orientation (top-left branching down-right)
  useEffect(() => {
    if (!data || !svgRef.current || !rootPersonId) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const treeData = showAncestors ? buildAncestorTree(rootPersonId) : buildDescendantTree(rootPersonId);
    if (!treeData) return;

    const { width, height } = dimensions;
    const margin = { top: 30, right: 20, bottom: 30, left: 30 };
    const root = d3.hierarchy(treeData);

    // Node dimensions (smaller, tighter)
    const nodeWidth = 120;
    const nodeHeight = 40;
    const nodeSpacingX = 30; // Horizontal gap between nodes at same level
    const nodeSpacingY = 50; // Vertical gap between levels

    // Calculate tree size based on depth and breadth
    const maxDepth = root.height;
    const leaves = root.leaves().length;
    const treeWidth = Math.max(leaves * (nodeWidth + nodeSpacingX), width - margin.left - margin.right);
    const treeHeight = Math.max((maxDepth + 1) * (nodeHeight + nodeSpacingY), height - margin.top - margin.bottom);

    // Create vertical tree layout (top to bottom)
    const treeLayout = d3.tree<TreeNode>()
      .size([treeWidth, treeHeight])
      .separation((a, b) => a.parent === b.parent ? 1 : 1.2);

    treeLayout(root as any);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Draw curved links (vertical orientation)
    g.selectAll('.link').data(root.links()).enter().append('path')
      .attr('d', d3.linkVertical<any, any>().x(d => d.x).y(d => d.y) as any)
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // Create node groups
    const nodes = g.selectAll('.node').data(root.descendants()).enter().append('g')
      .attr('transform', d => `translate(${(d as any).x},${(d as any).y})`);

    // Node rectangles - clicking tile navigates to that person's tree
    nodes.append('rect')
      .attr('x', -nodeWidth / 2)
      .attr('y', -nodeHeight / 2)
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('rx', 6)
      .attr('fill', d => (d as any).data.sex === 'F' ? '#fce7f3' : '#dbeafe')
      .attr('stroke', d => (d as any).data.sex === 'F' ? '#ec4899' : '#3b82f6')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (e, d) => {
        e.stopPropagation();
        onTileClick((d as any).data.id);
      });

    // Living indicator (smaller)
    nodes.filter(d => (d as any).data.living).append('circle')
      .attr('cx', nodeWidth / 2 - 8)
      .attr('cy', -nodeHeight / 2 + 8)
      .attr('r', 4)
      .attr('fill', '#22c55e')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('pointer-events', 'none');

    // Name text - clicking name goes to person page
    nodes.append('text')
      .attr('dy', -2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('font-weight', '600')
      .attr('fill', '#1f2937')
      .style('cursor', 'pointer')
      .style('text-decoration', 'none')
      .on('mouseover', function() { d3.select(this).style('text-decoration', 'underline'); })
      .on('mouseout', function() { d3.select(this).style('text-decoration', 'none'); })
      .on('click', (e, d) => {
        e.stopPropagation();
        onPersonClick((d as any).data.id);
      })
      .text(d => {
        const n = (d as any).data.name;
        return n.length > 16 ? n.substring(0, 14) + '...' : n;
      });

    // Years text (smaller) - not clickable
    nodes.append('text')
      .attr('dy', 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('fill', '#6b7280')
      .style('pointer-events', 'none')
      .text(d => {
        const data = (d as any).data;
        const birth = data.birth_year || '?';
        const death = data.living ? 'Living' : (data.death_year || '?');
        return `${birth} – ${death}`;
      });

    // Setup zoom/pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);

    // Initial transform: start from top-left area
    svg.call(zoom.transform, d3.zoomIdentity.translate(margin.left, margin.top).scale(0.8));
  }, [data, rootPersonId, showAncestors, dimensions, buildAncestorTree, buildDescendantTree, onPersonClick, onTileClick]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg" />
      {!data && <div className="absolute inset-0 flex items-center justify-center text-gray-500">Loading...</div>}
    </div>
  );
}
