'use client';

import { useQuery } from '@apollo/client/react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import PersonSearchSelect from '@/components/PersonSearchSelect';
import { Button, PageHeader } from '@/components/ui';
import { GET_PERSON } from '@/lib/graphql/queries';
import type { Person } from '@/lib/types';

const FamilyTreeLazy = dynamic(
  () =>
    import('@/components/tree/FamilyTreeLazy').then((mod) => ({
      default: mod.FamilyTreeLazy,
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
  const [showAncestors, setShowAncestors] = useState(true);
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
    (personId: string, ancestors: boolean) => {
      const params = new URLSearchParams();
      if (personId) params.set('person', personId);
      params.set('view', ancestors ? 'ancestors' : 'descendants');
      router.replace(`/tree?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  // Read initial state from URL params, fall back to user's linked person
  useEffect(() => {
    if (initialized) return;

    const urlPerson = searchParams.get('person');
    const urlView = searchParams.get('view');

    if (urlPerson) {
      // URL param takes priority
      setSelectedPerson(urlPerson);
      setInitialized(true);
    } else if (session?.user?.personId) {
      // Fall back to user's linked person
      setSelectedPerson(session.user.personId);
      updateUrl(session.user.personId, showAncestors);
      setInitialized(true);
    }

    if (urlView === 'descendants') {
      setShowAncestors(false);
    }
  }, [
    searchParams,
    session?.user?.personId,
    initialized,
    showAncestors,
    updateUrl,
  ]);

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
          <Button
            variant={showAncestors ? 'primary' : 'secondary'}
            onClick={() => handleViewChange(true)}
            icon={<ArrowUp className="w-4 h-4" />}
          >
            Ancestors
          </Button>
          <Button
            variant={!showAncestors ? 'primary' : 'secondary'}
            onClick={() => handleViewChange(false)}
            icon={<ArrowDown className="w-4 h-4" />}
          >
            Descendants
          </Button>
        </div>

        {loading ? (
          <div className="tree-container flex items-center justify-center">
            <LoadingSpinner size="lg" message="Loading..." />
          </div>
        ) : selected ? (
          <div className="card" style={{ height: '600px' }}>
            <FamilyTreeLazy
              rootPersonId={selectedPerson}
              showAncestors={showAncestors}
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
