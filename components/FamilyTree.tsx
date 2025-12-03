'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as f3 from 'family-chart';
import 'family-chart/styles/family-chart.css';

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

// family-chart data format
interface F3Person {
  id: string;
  data: {
    gender: 'M' | 'F';
    'first name': string;
    'last name': string;
    birthday: string;
    living?: boolean;
  };
  rels: {
    parents: string[];
    spouses: string[];
    children: string[];
  };
}

interface FamilyTreeProps {
  rootPersonId: string;
  showAncestors: boolean;
  onPersonClick: (id: string) => void;
  onTileClick: (id: string) => void;
}

export default function FamilyTree({ rootPersonId, showAncestors, onPersonClick, onTileClick }: FamilyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [data, setData] = useState<TreeData | null>(null);
  const [f3Data, setF3Data] = useState<F3Person[]>([]);

  // Fetch data from API
  useEffect(() => {
    fetch('/api/tree')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  // Transform API data to family-chart format
  const transformData = useCallback((apiData: TreeData): F3Person[] => {
    const result: F3Person[] = [];
    const people = apiData.people;
    const families = apiData.families;

    // Build lookup: personId -> { parents: [], spouses: [], children: [] }
    const relsMap: Record<string, { parents: string[]; spouses: string[]; children: string[] }> = {};

    // Initialize all people
    for (const personId of Object.keys(people)) {
      relsMap[personId] = { parents: [], spouses: [], children: [] };
    }

    // Process families to build relationships
    for (const family of families) {
      const husbandId = family.husband_id;
      const wifeId = family.wife_id;

      // Add spouse relationships (bidirectional)
      if (husbandId && wifeId) {
        if (relsMap[husbandId] && !relsMap[husbandId].spouses.includes(wifeId)) {
          relsMap[husbandId].spouses.push(wifeId);
        }
        if (relsMap[wifeId] && !relsMap[wifeId].spouses.includes(husbandId)) {
          relsMap[wifeId].spouses.push(husbandId);
        }
      }

      // Add parent/child relationships
      for (const childId of family.children) {
        if (!relsMap[childId]) continue;

        // Add parents to child
        if (husbandId && !relsMap[childId].parents.includes(husbandId)) {
          relsMap[childId].parents.push(husbandId);
        }
        if (wifeId && !relsMap[childId].parents.includes(wifeId)) {
          relsMap[childId].parents.push(wifeId);
        }

        // Add child to parents
        if (husbandId && relsMap[husbandId] && !relsMap[husbandId].children.includes(childId)) {
          relsMap[husbandId].children.push(childId);
        }
        if (wifeId && relsMap[wifeId] && !relsMap[wifeId].children.includes(childId)) {
          relsMap[wifeId].children.push(childId);
        }
      }
    }

    // Convert to f3 format
    for (const [id, person] of Object.entries(people)) {
      const nameParts = person.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const rels = relsMap[id];

      const f3Person: F3Person = {
        id,
        data: {
          gender: person.sex === 'F' ? 'F' : 'M',
          'first name': firstName,
          'last name': lastName,
          birthday: person.birth_year ? String(person.birth_year) : '',
          living: person.living,
        },
        rels: {
          parents: rels.parents,
          spouses: rels.spouses,
          children: rels.children,
        }
      };

      result.push(f3Person);
    }

    return result;
  }, []);

  // Transform data when API data is loaded
  useEffect(() => {
    if (data) {
      const transformed = transformData(data);
      setF3Data(transformed);
    }
  }, [data, transformData]);

  // Create and update chart
  useEffect(() => {
    if (!containerRef.current || f3Data.length === 0 || !rootPersonId) return;

    // Clear previous chart
    containerRef.current.innerHTML = '';

    // Create chart container div
    const chartDiv = document.createElement('div');
    chartDiv.id = 'FamilyChart';
    chartDiv.style.width = '100%';
    chartDiv.style.height = '100%';
    containerRef.current.appendChild(chartDiv);

    try {
      // Create family-chart instance
      const chart = f3.createChart('#FamilyChart', f3Data)
        .setTransitionTime(500)
        .setCardXSpacing(20)
        .setCardYSpacing(100);

      // Set card display with HTML cards
      const cardHtml = chart.setCardHtml()
        .setCardDisplay([['first name', 'last name'], ['birthday']])
        .setMiniTree(true)
        .setStyle('rect');

      // Handle card clicks - name goes to person page, card refocuses tree
      cardHtml.setOnCardClick((e: any, d: any) => {
        e.stopPropagation();
        const target = e.target as HTMLElement;
        // Check if clicking on name element
        if (target.classList?.contains('f3-card-name') ||
            target.closest('.f3-card-name') ||
            target.tagName?.toLowerCase() === 'tspan') {
          onPersonClick(d.data.id);
        } else {
          onTileClick(d.data.id);
        }
      });

      // Set main person and render tree
      chart.updateMainId(rootPersonId);
      chart.updateTree({ initial: true });

      chartRef.current = chart;
    } catch (err) {
      console.error('Failed to create family chart:', err);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [f3Data, rootPersonId, showAncestors, onPersonClick, onTileClick]);

  // Update main person when rootPersonId changes
  useEffect(() => {
    if (chartRef.current && rootPersonId) {
      try {
        chartRef.current.updateTree({ mainId: rootPersonId });
      } catch (err) {
        console.error('Failed to update tree:', err);
      }
    }
  }, [rootPersonId]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
    >
      {!data && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          Loading...
        </div>
      )}
    </div>
  );
}
