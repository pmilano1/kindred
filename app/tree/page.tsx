'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import { Person } from '@/lib/types';

export default function TreePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/people')
      .then(res => res.json())
      .then(data => {
        setPeople(data);
        setLoading(false);
        // Default to first person with a recent birth year
        const recent = data.find((p: Person) => p.birth_year && p.birth_year > 1970);
        if (recent) setSelectedPerson(recent.id);
      });
  }, []);

  const selected = people.find(p => p.id === selectedPerson);

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <Hero title="Family Tree" subtitle="Interactive visualization of family connections" />
        <div className="content-wrapper">
          <div className="tree-controls">
            <select
              className="tree-select"
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
            >
              <option value="">Select a person...</option>
              <optgroup label="Living Family Members">
                {people.filter(p => p.living).sort((a, b) => (b.birth_year || 0) - (a.birth_year || 0)).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name_full} {p.birth_year ? `(b. ${p.birth_year})` : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Ancestors">
                {people.filter(p => !p.living).sort((a, b) => (b.birth_year || 0) - (a.birth_year || 0)).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name_full} {p.birth_year ? `(${p.birth_year}–${p.death_year || '?'})` : ''}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {loading ? (
            <div className="tree-container flex items-center justify-center">
              <p className="text-gray-500">Loading family data...</p>
            </div>
          ) : selected ? (
            <div className="card p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">{selected.name_full}</h2>
                <p className="text-gray-500">
                  {selected.birth_year && `Born ${selected.birth_year}`}
                  {selected.birth_place && ` in ${selected.birth_place}`}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-8 text-center" ref={containerRef}>
                <p className="text-gray-500 mb-4">
                  🌳 Interactive D3.js tree visualization coming soon
                </p>
                <p className="text-sm text-gray-400">
                  For now, use the People page to browse all family members
                </p>
                {selected.familysearch_id && (
                  <a
                    href={`https://www.familysearch.org/tree/person/details/${selected.familysearch_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 tree-btn"
                  >
                    View on FamilySearch ↗
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="tree-container flex items-center justify-center">
              <p className="text-gray-500">Select a person to view their family tree</p>
            </div>
          )}
        </div>
        <Footer />
      </main>
    </>
  );
}

