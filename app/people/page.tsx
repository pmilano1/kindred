'use client';

import { NetworkStatus } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Loader2, UserPlus, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import CreatePersonModal from '@/components/CreatePersonModal';
import LoadingSpinner from '@/components/LoadingSpinner';
import PersonCard from '@/components/PersonCard';
import {
  Button,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { GET_PEOPLE } from '@/lib/graphql/queries';
import { useInfiniteScroll } from '@/lib/hooks';
import type { Person } from '@/lib/types';

const PAGE_SIZE = 50;

interface PersonEdge {
  node: Person;
  cursor: string;
}

interface PersonConnection {
  edges: PersonEdge[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
    totalCount: number;
  };
}

function PeoplePageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEdit =
    session?.user?.role === 'admin' || session?.user?.role === 'editor';

  const [filter, setFilter] = useState<'all' | 'living' | 'male' | 'female'>(
    'all',
  );
  const [surnameFilter, setSurnameFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Read surname from URL query params
  useEffect(() => {
    const surname = searchParams.get('surname');
    if (surname) {
      setSurnameFilter(surname);
    }
  }, [searchParams]);

  const { data, loading, fetchMore, networkStatus } = useQuery<{
    people: PersonConnection;
  }>(GET_PEOPLE, {
    variables: { first: PAGE_SIZE },
    notifyOnNetworkStatusChange: true,
  });

  // Only show full-page loading on initial load, not during fetchMore
  const isInitialLoading = loading && networkStatus === NetworkStatus.loading;
  const isFetchingMore = networkStatus === NetworkStatus.fetchMore;

  const people = useMemo(
    () => data?.people.edges.map((e) => e.node) || [],
    [data],
  );

  const totalCount = data?.people.pageInfo.totalCount ?? 0;
  const hasNextPage = data?.people.pageInfo.hasNextPage ?? false;
  const endCursor = data?.people.pageInfo.endCursor;

  // Apply client-side filter for sex/living/surname
  const filteredPeople = useMemo(() => {
    let result = people;
    if (filter === 'living') result = result.filter((p) => p.living);
    else if (filter === 'male') result = result.filter((p) => p.sex === 'M');
    else if (filter === 'female') result = result.filter((p) => p.sex === 'F');
    if (surnameFilter) {
      result = result.filter(
        (p) => p.name_surname?.toLowerCase() === surnameFilter.toLowerCase(),
      );
    }
    return result;
  }, [filter, people, surnameFilter]);

  const loadMore = useCallback(() => {
    if (!hasNextPage || !endCursor || loading) return;
    fetchMore({
      variables: { first: PAGE_SIZE, after: endCursor },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          people: {
            ...fetchMoreResult.people,
            edges: [...prev.people.edges, ...fetchMoreResult.people.edges],
          },
        };
      },
    });
  }, [hasNextPage, endCursor, loading, fetchMore]);

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage,
    loading: isFetchingMore,
    onLoadMore: loadMore,
  });

  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${totalCount} individuals in the database`}
        icon="Users"
        actions={
          canEdit && (
            <Button
              onClick={() => setShowCreateModal(true)}
              icon={<UserPlus className="w-4 h-4" />}
            >
              Add Person
            </Button>
          )
        }
      />
      <div className="content-wrapper">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
          {surnameFilter && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-sm text-gray-700">
                Surname: <strong>{surnameFilter}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSurnameFilter('');
                  router.push('/people');
                }}
                className="text-gray-500 hover:text-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Clear surname filter"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div
            className={`w-full sm:w-auto ${surnameFilter ? 'sm:ml-auto' : ''}`}
          >
            <Select
              value={filter}
              onValueChange={(value) => setFilter(value as typeof filter)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All People</SelectItem>
                <SelectItem value="living">Living Only</SelectItem>
                <SelectItem value="male">Male Only</SelectItem>
                <SelectItem value="female">Female Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isInitialLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" message="Loading people..." />
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Showing {filteredPeople.length} of {people.length} loaded
              {filter !== 'all' && ` (filtered)`}
              {hasNextPage && ` • ${totalCount} total`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPeople.map((person) => (
                <PersonCard key={person.id} person={person} showDetails />
              ))}
            </div>
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4" aria-hidden="true" />
            {isFetchingMore && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                <span className="ml-2 text-gray-600">Loading more...</span>
              </div>
            )}
          </>
        )}
      </div>

      <CreatePersonModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(personId) => router.push(`/person/${personId}`)}
      />
    </>
  );
}

export default function PeoplePage() {
  return (
    <Suspense
      fallback={<LoadingSpinner size="lg" message="Loading people..." />}
    >
      <PeoplePageContent />
    </Suspense>
  );
}
