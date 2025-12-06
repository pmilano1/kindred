'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import Hero from '@/components/Hero';
import PersonCard from '@/components/PersonCard';
import { Person } from '@/lib/types';
import { GET_PEOPLE_LIST } from '@/lib/graphql/queries';

export default function PeoplePage() {
  const { data, loading } = useQuery<{ peopleList: Person[] }>(GET_PEOPLE_LIST, {
    variables: { limit: 1000 },
  });

  const people = data?.peopleList || [];
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'living' | 'male' | 'female'>('all');

  const filteredPeople = useMemo(() => {
    let result = people;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p: Person) =>
        p.name_full.toLowerCase().includes(q) ||
        p.birth_place?.toLowerCase().includes(q) ||
        p.death_place?.toLowerCase().includes(q)
      );
    }

    if (filter === 'living') result = result.filter((p: Person) => p.living);
    else if (filter === 'male') result = result.filter((p: Person) => p.sex === 'M');
    else if (filter === 'female') result = result.filter((p: Person) => p.sex === 'F');

    return result;
  }, [search, filter, people]);

  return (
    <>
      <Hero title="People" subtitle={`${people.length} individuals in the database`} />
      <div className="content-wrapper">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by name or place..."
            className="search-box flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="tree-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">All People</option>
            <option value="living">Living Only</option>
            <option value="male">Male Only</option>
            <option value="female">Female Only</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Showing {filteredPeople.length} of {people.length} people
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPeople.map((person) => (
                <PersonCard key={person.id} person={person} showDetails />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

