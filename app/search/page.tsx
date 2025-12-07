'use client';

import { useState } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import PersonCard from '@/components/PersonCard';
import { Person } from '@/lib/types';
import { SEARCH_PEOPLE } from '@/lib/graphql/queries';

interface SearchResult {
  search: {
    edges: Array<{ node: Person }>;
    totalCount: number;
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [executeSearch, { data, loading }] = useLazyQuery<SearchResult>(SEARCH_PEOPLE);

  const results = data?.search?.edges?.map(e => e.node) || [];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    executeSearch({ variables: { query, first: 100 } });
    setSearched(true);
  };

  return (
    <>
      <PageHeader
        title="Search"
        subtitle="Find ancestors by name, place, or date"
        icon={Search}
      />
      <div className="content-wrapper">
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search for a person, place, or year..."
              className="search-box flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="tree-btn" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {searched && (
          <div>
            <p className="text-sm text-gray-500 mb-4 text-center">
              Found {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((person) => (
                <PersonCard key={person.id} person={person} showDetails />
              ))}
            </div>
            {results.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No results found. Try a different search term.
              </div>
            )}
          </div>
        )}

        {!searched && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-4">🔍</p>
            <p>Enter a search term to find family members</p>
          </div>
        )}
      </div>
    </>
  );
}

