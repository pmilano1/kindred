'use client';

import { useQuery } from '@apollo/client/react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PersonSearchSelect from '@/components/PersonSearchSelect';
import { PageHeader } from '@/components/ui';
import { GET_PERSON } from '@/lib/graphql/queries';
import type { Person } from '@/lib/types';

const FamilyTreeUnified = dynamic(
  () =>
    import('@/components/tree/FamilyTreeUnified').then((mod) => ({
      default: mod.FamilyTreeUnified,
    })),
  {
    ssr: false,
  },
);

function TreePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [initialized, setInitialized] = useState(false);

  // Fetch selected person details
  const { data: personData, loading } = useQuery<{ person: Person }>(
    GET_PERSON,
    {
      variables: { id: selectedPerson },
      skip: !selectedPerson,
    },
  );

  const selected = personData?.person;

  // Update URL when state changes
  const updateUrl = useCallback(
    (personId: string) => {
      const params = new URLSearchParams();
      if (personId) params.set('person', personId);
      router.replace(`/tree?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  // Read initial state from URL params, fall back to user's linked person
  useEffect(() => {
    if (initialized) return;

    const urlPerson = searchParams.get('person');

    if (urlPerson) {
      // URL param takes priority
      setSelectedPerson(urlPerson);
      setInitialized(true);
    } else if (session?.user?.personId) {
      // Fall back to user's linked person
      setSelectedPerson(session.user.personId);
      updateUrl(session.user.personId);
      setInitialized(true);
    }
  }, [searchParams, session?.user?.personId, initialized, updateUrl]);

  // Handle person selection change
  const handlePersonChange = (personId: string) => {
    setSelectedPerson(personId);
    updateUrl(personId);
  };

  // Handle tile click - navigate to that person's tree
  const handleTileClick = (personId: string) => {
    setSelectedPerson(personId);
    updateUrl(personId);
  };

  // Build subtitle with person info
  const subtitle = selected
    ? `${selected.name_full}${selected.birth_year ? ` (${selected.birth_year}` : ''}${selected.death_year ? `–${selected.death_year})` : selected.birth_year ? ')' : ''}${selected.birth_place ? ` • ${selected.birth_place}` : ''}`
    : 'Interactive visualization of family connections';

  return (
    <>
      <PageHeader
        title="Family Tree"
        subtitle={subtitle}
        icon="TreeDeciduous"
      />
      <div className="content-wrapper">
        <div className="tree-controls">
          <PersonSearchSelect
            value={selectedPerson}
            onChange={handlePersonChange}
            placeholder="Search for a person..."
          />
        </div>

        {loading ? (
          <div className="tree-container flex items-center justify-center">
            <LoadingSpinner size="lg" message="Loading..." />
          </div>
        ) : selected ? (
          <div className="card" style={{ height: '600px' }}>
            <FamilyTreeUnified
              rootPersonId={selectedPerson}
              onPersonClick={(id) => router.push(`/person/${id}`)}
              onTileClick={handleTileClick}
            />
          </div>
        ) : (
          <div className="tree-container flex items-center justify-center">
            <p className="text-gray-500">
              Search for a person to view their family tree
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function TreePage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader
            title="Family Tree"
            subtitle="Interactive visualization of family connections"
            icon="TreeDeciduous"
          />
          <div className="content-wrapper">
            <div className="tree-container flex items-center justify-center">
              <LoadingSpinner size="lg" message="Loading family tree..." />
            </div>
          </div>
        </>
      }
    >
      <TreePageContent />
    </Suspense>
  );
}
