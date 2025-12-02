'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import { Person } from '@/lib/types';

const FamilyTree = dynamic(() => import('@/components/FamilyTree'), { ssr: false });

export default function TreePage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [showAncestors, setShowAncestors] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/people')
      .then(res => res.json())
      .then(data => {
        setPeople(data);
        setLoading(false);
        const peter = data.find((p: Person) => p.name_full?.toLowerCase().includes('peter milanese'));
        if (peter) setSelectedPerson(peter.id);
        else {
          const recent = data.find((p: Person) => p.birth_year && p.birth_year > 1970);
          if (recent) setSelectedPerson(recent.id);
        }
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
            <select className="tree-select" value={selectedPerson} onChange={(e) => setSelectedPerson(e.target.value)}>
              <option value="">Select a person...</option>
              <optgroup label="Living Family Members">
                {people.filter(p => p.living).sort((a, b) => (b.birth_year || 0) - (a.birth_year || 0)).map(p => (
                  <option key={p.id} value={p.id}>{p.name_full} {p.birth_year ? `(b. ${p.birth_year})` : ''}</option>
                ))}
              </optgroup>
              <optgroup label="Ancestors">
                {people.filter(p => !p.living).sort((a, b) => (b.birth_year || 0) - (a.birth_year || 0)).map(p => (
                  <option key={p.id} value={p.id}>{p.name_full} {p.birth_year ? `(${p.birth_year}–${p.death_year || '?'})` : ''}</option>
                ))}
              </optgroup>
            </select>
            <button className={`tree-btn ${showAncestors ? 'active' : ''}`} onClick={() => setShowAncestors(true)}>⬆️ Ancestors</button>
            <button className={`tree-btn ${!showAncestors ? 'active' : ''}`} onClick={() => setShowAncestors(false)}>⬇️ Descendants</button>
          </div>

          {loading ? (
            <div className="tree-container flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>
          ) : selected ? (
            <div className="card">
              <div className="text-center p-4 border-b">
                <h2 className="text-xl font-bold">{selected.name_full}</h2>
                <p className="text-gray-500 text-sm">
                  {selected.birth_year && `${selected.birth_year}`}{selected.death_year && ` – ${selected.death_year}`}
                  {selected.birth_place && ` • ${selected.birth_place}`}
                </p>
              </div>
              <div style={{ height: '500px' }}>
                <FamilyTree rootPersonId={selectedPerson} showAncestors={showAncestors} onPersonClick={(id) => router.push(`/person/${id}`)} />
              </div>
            </div>
          ) : (
            <div className="tree-container flex items-center justify-center"><p className="text-gray-500">Select a person to view their family tree</p></div>
          )}
        </div>
        <Footer />
      </main>
    </>
  );
}

