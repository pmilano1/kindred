'use client';

import { useQuery } from '@apollo/client/react';
import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CreatePersonModal from '@/components/CreatePersonModal';
import LoadingSpinner from '@/components/LoadingSpinner';
import PersonCard from '@/components/PersonCard';
import {
  Button,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { GET_PEOPLE_LIST } from '@/lib/graphql/queries';
import type { Person } from '@/lib/types';

const PAGE_SIZE = 50;

export default function PeoplePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const canEdit =
    session?.user?.role === 'admin' || session?.user?.role === 'editor';

  const { data, loading } = useQuery<{ peopleList: Person[] }>(
    GET_PEOPLE_LIST,
    {
      variables: { limit: 10000 },
    },
  );

  const people = useMemo(() => data?.peopleList || [], [data?.peopleList]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'living' | 'male' | 'female'>(
    'all',
  );
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Reset display count when filters change - valid synchronization pattern
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayCount(PAGE_SIZE);
  }, [search, filter]);

  const filteredPeople = useMemo(() => {
    let result = people;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p: Person) =>
          p.name_full.toLowerCase().includes(q) ||
          p.birth_place?.toLowerCase().includes(q) ||
          p.death_place?.toLowerCase().includes(q),
      );
    }

    if (filter === 'living') result = result.filter((p: Person) => p.living);
    else if (filter === 'male')
      result = result.filter((p: Person) => p.sex === 'M');
    else if (filter === 'female')
      result = result.filter((p: Person) => p.sex === 'F');

    return result;
  }, [search, filter, people]);

  const displayedPeople = useMemo(
    () => filteredPeople.slice(0, displayCount),
    [filteredPeople, displayCount],
  );

  const hasMore = displayCount < filteredPeople.length;

  const loadMore = useCallback(() => {
    setDisplayCount((prev) =>
      Math.min(prev + PAGE_SIZE, filteredPeople.length),
    );
  }, [filteredPeople.length]);

  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${people.length} individuals in the database`}
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
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Input
            type="text"
            placeholder="Search by name or place..."
            className="flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={filter}
            onValueChange={(value) => setFilter(value as typeof filter)}
          >
            <SelectTrigger className="w-full md:w-48">
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

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" message="Loading people..." />
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Showing {displayedPeople.length} of {filteredPeople.length} people
              {filteredPeople.length !== people.length &&
                ` (filtered from ${people.length})`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedPeople.map((person) => (
                <PersonCard key={person.id} person={person} showDetails />
              ))}
            </div>
            {hasMore && (
              <div className="text-center mt-8">
                <Button onClick={loadMore} size="lg">
                  Load More ({filteredPeople.length - displayCount} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Person Modal */}
      <CreatePersonModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(personId) => router.push(`/person/${personId}`)}
      />
    </>
  );
}
