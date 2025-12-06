'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useQuery } from '@apollo/client/react';
import Hero from '@/components/Hero';
import { Person } from '@/lib/types';
import { GET_PEOPLE_LIST } from '@/lib/graphql/queries';

const FamilyTree = dynamic(() => import('@/components/FamilyTree'), { ssr: false });

function TreePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, loading } = useQuery<{ peopleList: Person[] }>(GET_PEOPLE_LIST, {
    variables: { limit: 1000 },
  });
  const people = data?.peopleList || [];
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [showAncestors, setShowAncestors] = useState(true);

  // Update URL when state changes
  const updateUrl = useCallback((personId: string, ancestors: boolean) => {
    const params = new URLSearchParams();
    if (personId) params.set('person', personId);
    params.set('view', ancestors ? 'ancestors' : 'descendants');
    router.replace(`/tree?${params.toString()}`, { scroll: false });
  }, [router]);

  // Read initial state from URL params and set default person
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (people.length === 0) return;

    const urlPerson = searchParams.get('person');
    const urlView = searchParams.get('view');

    // Use URL param if valid, otherwise find default
    if (urlPerson && people.find((p: Person) => p.id === urlPerson)) {
      setSelectedPerson(urlPerson);
    } else if (!selectedPerson) {
      // Find a recent person as the default starting point
      const defaultPerson = people.find((p: Person) => p.birth_year && p.birth_year > 1950);
      if (defaultPerson) {
        setSelectedPerson(defaultPerson.id);
        updateUrl(defaultPerson.id, urlView !== 'descendants');
      } else {
        const recent = people.find((p: Person) => p.birth_year && p.birth_year > 1900);
        if (recent) {
          setSelectedPerson(recent.id);
          updateUrl(recent.id, urlView !== 'descendants');
        }
      }
    }

    // Set view mode from URL
    if (urlView === 'descendants') {
      setShowAncestors(false);
    }
  }, [people, searchParams, updateUrl, selectedPerson]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle person selection change
  const handlePersonChange = (personId: string) => {
    setSelectedPerson(personId);
    updateUrl(personId, showAncestors);
  };

  // Handle view mode change
  const handleViewChange = (ancestors: boolean) => {
    setShowAncestors(ancestors);
    updateUrl(selectedPerson, ancestors);
  };

  // Handle tile click - navigate to that person's tree
  const handleTileClick = (personId: string) => {
    setSelectedPerson(personId);
    updateUrl(personId, showAncestors);
  };

  const selected = people.find(p => p.id === selectedPerson);

  return (
    <>
      <Hero title="Family Tree" subtitle="Interactive visualization of family connections" />
      <div className="content-wrapper">
        <div className="tree-controls">
          <select className="tree-select" value={selectedPerson} onChange={(e) => handlePersonChange(e.target.value)}>
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
          <button className={`tree-btn ${showAncestors ? 'active' : ''}`} onClick={() => handleViewChange(true)}>⬆️ Ancestors</button>
          <button className={`tree-btn ${!showAncestors ? 'active' : ''}`} onClick={() => handleViewChange(false)}>⬇️ Descendants</button>
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
              <FamilyTree
                rootPersonId={selectedPerson}
                showAncestors={showAncestors}
                onPersonClick={(id) => router.push(`/person/${id}`)}
                onTileClick={handleTileClick}
              />
            </div>
          </div>
        ) : (
          <div className="tree-container flex items-center justify-center"><p className="text-gray-500">Select a person to view their family tree</p></div>
        )}
      </div>
    </>
  );
}

export default function TreePage() {
  return (
    <Suspense fallback={
      <>
        <Hero title="Family Tree" subtitle="Interactive visualization of family connections" />
        <div className="content-wrapper">
          <div className="tree-container flex items-center justify-center">
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      </>
    }>
      <TreePageContent />
    </Suspense>
  );
}
