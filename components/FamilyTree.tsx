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

  // Build ancestor tree from person going up - shows BOTH paternal and maternal lines
  const buildAncestorTree = useCallback((personId: string, depth = 0): TreeNode | null => {
    if (!data || depth > 10) return null;
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

    // Find family where this person is a child to get parents
    const parentFamily = data.families.find(f => f.children.includes(personId));
    if (parentFamily) {
      const fatherId = parentFamily.husband_id;
      const motherId = parentFamily.wife_id;
      const father = fatherId ? data.people[fatherId] : null;
      const mother = motherId ? data.people[motherId] : null;

      // Build TWO separate branches - one for father's line, one for mother's line
      const parentNodes: TreeNode[] = [];

      // PATERNAL branch (father + his parents)
      if (father) {
        const fatherNode: TreeNode = {
          id: father.id,
          name: father.name,
          sex: father.sex,
          birth_year: father.birth_year,
          death_year: father.death_year,
          living: father.living,
          familysearch_id: father.familysearch_id,
        };

        // Find father's spouse (for display) - look for the family where he's husband
        const fatherFamily = data.families.find(f => f.husband_id === fatherId && f.children.includes(personId));
        if (fatherFamily && fatherFamily.wife_id) {
          const fatherSpouse = data.people[fatherFamily.wife_id];
          if (fatherSpouse) {
            fatherNode.spouse = fatherSpouse;
          }
        }

        // Recursively get father's parents (paternal grandparents)
        const fatherParentFamily = data.families.find(f => f.children.includes(fatherId));
        if (fatherParentFamily) {
          const patGrandparents: TreeNode[] = [];

          // Paternal grandfather
          if (fatherParentFamily.husband_id) {
            const patGFNode = buildAncestorTree(fatherParentFamily.husband_id, depth + 1);
            if (patGFNode) {
              // Add spouse info
              if (fatherParentFamily.wife_id) {
                patGFNode.spouse = data.people[fatherParentFamily.wife_id];
              }
              patGrandparents.push(patGFNode);
            }
          }

          // Paternal grandmother (as separate branch)
          if (fatherParentFamily.wife_id) {
            const patGMNode = buildAncestorTree(fatherParentFamily.wife_id, depth + 1);
            if (patGMNode) patGrandparents.push(patGMNode);
          }

          if (patGrandparents.length > 0) {
            fatherNode.children = patGrandparents;
          }
        }

        parentNodes.push(fatherNode);
      }

      // MATERNAL branch (mother + her parents)
      if (mother) {
        const motherNode: TreeNode = {
          id: mother.id,
          name: mother.name,
          sex: mother.sex,
          birth_year: mother.birth_year,
          death_year: mother.death_year,
          living: mother.living,
          familysearch_id: mother.familysearch_id,
        };

        // Recursively get mother's parents (maternal grandparents)
        const motherParentFamily = data.families.find(f => f.children.includes(motherId!));
        if (motherParentFamily) {
          const matGrandparents: TreeNode[] = [];

          // Maternal grandfather
          if (motherParentFamily.husband_id) {
            const matGFNode = buildAncestorTree(motherParentFamily.husband_id, depth + 1);
            if (matGFNode) {
              // Add spouse info
              if (motherParentFamily.wife_id) {
                matGFNode.spouse = data.people[motherParentFamily.wife_id];
              }
              matGrandparents.push(matGFNode);
            }
          }

          // Maternal grandmother (as separate branch)
          if (motherParentFamily.wife_id) {
            const matGMNode = buildAncestorTree(motherParentFamily.wife_id, depth + 1);
            if (matGMNode) matGrandparents.push(matGMNode);
          }

          if (matGrandparents.length > 0) {
            motherNode.children = matGrandparents;
          }
        }

        parentNodes.push(motherNode);
      }

      if (parentNodes.length > 0) {
        node.children = parentNodes;
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

    // Node dimensions
    const nodeWidth = 120;
    const coupleNodeWidth = 240; // Wider for couples
    const nodeHeight = 40;
    const nodeSpacingX = 50; // Horizontal gap (increased for couples)
    const nodeSpacingY = 60; // Vertical gap between levels

    // Calculate tree size based on depth and breadth
    const maxDepth = root.height;
    const leaves = root.leaves().length;
    const treeWidth = Math.max(leaves * (coupleNodeWidth + nodeSpacingX), width - margin.left - margin.right);
    const treeHeight = Math.max((maxDepth + 1) * (nodeHeight + nodeSpacingY), height - margin.top - margin.bottom);

    // Create vertical tree layout (top to bottom)
    const treeLayout = d3.tree<TreeNode>()
      .size([treeWidth, treeHeight])
      .separation((a, b) => a.parent === b.parent ? 1.5 : 2); // More separation for couples

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

    // Width for couple vs single boxes
    const coupleWidth = 240;
    const singleWidth = nodeWidth;

    // Render split boxes for couples, single boxes for individuals
    nodes.each(function(d: any) {
      const node = d3.select(this);
      const spouse = d.data.spouse;
      const boxWidth = spouse ? coupleWidth : singleWidth;

      if (spouse) {
        // Determine who goes on left (male) vs right (female)
        // Always put male on left, female on right
        const primaryIsMale = d.data.sex === 'M';
        const spouseIsMale = spouse.sex === 'M';

        // Left person should be male, right should be female
        // If primary is female and spouse is male, swap positions
        const leftPerson = (primaryIsMale || (!primaryIsMale && !spouseIsMale)) ? d.data : spouse;
        const rightPerson = (primaryIsMale || (!primaryIsMale && !spouseIsMale)) ? spouse : d.data;

        // Split box for couple - outer container
        node.append('rect')
          .attr('x', -boxWidth / 2)
          .attr('y', -nodeHeight / 2)
          .attr('width', boxWidth)
          .attr('height', nodeHeight)
          .attr('rx', 6)
          .attr('fill', '#f8fafc')
          .attr('stroke', '#64748b')
          .attr('stroke-width', 2);

        // Left half (male)
        node.append('rect')
          .attr('x', -boxWidth / 2 + 2)
          .attr('y', -nodeHeight / 2 + 2)
          .attr('width', boxWidth / 2 - 4)
          .attr('height', nodeHeight - 4)
          .attr('rx', 4)
          .attr('fill', leftPerson.sex === 'F' ? '#fce7f3' : '#dbeafe')
          .style('cursor', 'pointer')
          .on('click', (e: any) => { e.stopPropagation(); onTileClick(leftPerson.id); });

        // Right half (female)
        node.append('rect')
          .attr('x', 2)
          .attr('y', -nodeHeight / 2 + 2)
          .attr('width', boxWidth / 2 - 4)
          .attr('height', nodeHeight - 4)
          .attr('rx', 4)
          .attr('fill', rightPerson.sex === 'F' ? '#fce7f3' : '#dbeafe')
          .style('cursor', 'pointer')
          .on('click', (e: any) => { e.stopPropagation(); onTileClick(rightPerson.id); });

        // Divider line
        node.append('line')
          .attr('x1', 0).attr('y1', -nodeHeight / 2 + 4)
          .attr('x2', 0).attr('y2', nodeHeight / 2 - 4)
          .attr('stroke', '#94a3b8').attr('stroke-width', 1);

        // Left person name
        const leftName = leftPerson.name.length > 14 ? leftPerson.name.substring(0, 12) + '..' : leftPerson.name;
        node.append('text')
          .attr('x', -boxWidth / 4).attr('dy', -2)
          .attr('text-anchor', 'middle').attr('font-size', '8px').attr('font-weight', '600').attr('fill', '#1f2937')
          .style('cursor', 'pointer')
          .on('click', (e: any) => { e.stopPropagation(); onPersonClick(leftPerson.id); })
          .text(leftName);

        // Left person years
        node.append('text')
          .attr('x', -boxWidth / 4).attr('dy', 10)
          .attr('text-anchor', 'middle').attr('font-size', '7px').attr('fill', '#6b7280')
          .text(`${leftPerson.birth_year || '?'}–${leftPerson.living ? 'L' : (leftPerson.death_year || '?')}`);

        // Right person name
        const rightName = rightPerson.name.length > 14 ? rightPerson.name.substring(0, 12) + '..' : rightPerson.name;
        node.append('text')
          .attr('x', boxWidth / 4).attr('dy', -2)
          .attr('text-anchor', 'middle').attr('font-size', '8px').attr('font-weight', '600').attr('fill', '#1f2937')
          .style('cursor', 'pointer')
          .on('click', (e: any) => { e.stopPropagation(); onPersonClick(rightPerson.id); })
          .text(rightName);

        // Right person years
        node.append('text')
          .attr('x', boxWidth / 4).attr('dy', 10)
          .attr('text-anchor', 'middle').attr('font-size', '7px').attr('fill', '#6b7280')
          .text(`${rightPerson.birth_year || '?'}–${rightPerson.living ? 'L' : (rightPerson.death_year || '?')}`);

      } else {
        // Single person box
        node.append('rect')
          .attr('x', -singleWidth / 2)
          .attr('y', -nodeHeight / 2)
          .attr('width', singleWidth)
          .attr('height', nodeHeight)
          .attr('rx', 6)
          .attr('fill', d.data.sex === 'F' ? '#fce7f3' : '#dbeafe')
          .attr('stroke', d.data.sex === 'F' ? '#ec4899' : '#3b82f6')
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer')
          .on('click', (e: any) => { e.stopPropagation(); onTileClick(d.data.id); });

        // Living indicator
        if (d.data.living) {
          node.append('circle')
            .attr('cx', singleWidth / 2 - 8).attr('cy', -nodeHeight / 2 + 8)
            .attr('r', 4).attr('fill', '#22c55e').attr('stroke', '#fff').attr('stroke-width', 1);
        }

        // Name
        const n = d.data.name.length > 16 ? d.data.name.substring(0, 14) + '..' : d.data.name;
        node.append('text')
          .attr('dy', -2).attr('text-anchor', 'middle')
          .attr('font-size', '9px').attr('font-weight', '600').attr('fill', '#1f2937')
          .style('cursor', 'pointer')
          .on('click', (e: any) => { e.stopPropagation(); onPersonClick(d.data.id); })
          .text(n);

        // Years
        node.append('text')
          .attr('dy', 10).attr('text-anchor', 'middle')
          .attr('font-size', '8px').attr('fill', '#6b7280')
          .text(`${d.data.birth_year || '?'} – ${d.data.living ? 'Living' : (d.data.death_year || '?')}`);
      }
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
