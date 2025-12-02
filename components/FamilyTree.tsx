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
}

export default function FamilyTree({ rootPersonId, showAncestors, onPersonClick }: FamilyTreeProps) {
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

  // Draw tree
  useEffect(() => {
    if (!data || !svgRef.current || !rootPersonId) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const treeData = showAncestors ? buildAncestorTree(rootPersonId) : buildDescendantTree(rootPersonId);
    if (!treeData) return;

    const { width, height } = dimensions;
    const margin = { top: 40, right: 150, bottom: 40, left: 150 };
    const root = d3.hierarchy(treeData);

    // Calculate tree size based on number of nodes to prevent overlap
    const nodeCount = root.descendants().length;
    const nodeHeight = 70; // Minimum vertical spacing between nodes
    const treeHeight = Math.max(height - margin.top - margin.bottom, nodeCount * nodeHeight);
    const treeWidth = width - margin.left - margin.right;

    d3.tree<TreeNode>().size([treeHeight, treeWidth]).separation((a, b) => a.parent === b.parent ? 1.5 : 2)(root as any);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.selectAll('.link').data(root.links()).enter().append('path')
      .attr('d', d3.linkHorizontal<any, any>().x(d => d.y).y(d => d.x) as any)
      .attr('fill', 'none').attr('stroke', '#94a3b8').attr('stroke-width', 2);

    const nodes = g.selectAll('.node').data(root.descendants()).enter().append('g')
      .attr('transform', d => `translate(${(d as any).y},${(d as any).x})`)
      .style('cursor', 'pointer').on('click', (e, d) => onPersonClick((d as any).data.id));

    nodes.append('rect').attr('x', -70).attr('y', -25).attr('width', 140).attr('height', 50).attr('rx', 8)
      .attr('fill', d => (d as any).data.sex === 'F' ? '#fce7f3' : '#dbeafe')
      .attr('stroke', d => (d as any).data.sex === 'F' ? '#ec4899' : '#3b82f6').attr('stroke-width', 2);

    nodes.filter(d => (d as any).data.living).append('circle')
      .attr('cx', 55).attr('cy', -15).attr('r', 6).attr('fill', '#22c55e').attr('stroke', '#fff');

    nodes.append('text').attr('dy', -5).attr('text-anchor', 'middle')
      .attr('font-size', '11px').attr('font-weight', '600').attr('fill', '#1f2937')
      .text(d => { const n = (d as any).data.name; return n.length > 18 ? n.substring(0, 16) + '...' : n; });

    nodes.append('text').attr('dy', 12).attr('text-anchor', 'middle').attr('font-size', '10px').attr('fill', '#6b7280')
      .text(d => `${(d as any).data.birth_year || '?'} – ${(d as any).data.living ? 'Living' : ((d as any).data.death_year || '?')}`);

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 3]).on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 4, height / 2).scale(0.9));
  }, [data, rootPersonId, showAncestors, dimensions, buildAncestorTree, buildDescendantTree, onPersonClick]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg" />
      {!data && <div className="absolute inset-0 flex items-center justify-center text-gray-500">Loading...</div>}
    </div>
  );
}
