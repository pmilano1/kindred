'use client';

import { useLazyQuery, useQuery } from '@apollo/client/react';
import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { GET_RECENT_PEOPLE, SEARCH_PEOPLE } from '@/lib/graphql/queries';
import type { Person } from '@/lib/types';

interface SearchResult {
  search: {
    edges: Array<{ node: Person }>;
    pageInfo: { totalCount: number };
  };
}

interface Props {
  value: string;
  onChange: (personId: string) => void;
  placeholder?: string;
}

export default function PersonSearchSelect({
  value,
  onChange,
  placeholder = 'Search for a person...',
}: Props) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get recent people for initial suggestions
  const { data: recentData } = useQuery<{ recentPeople: Person[] }>(
    GET_RECENT_PEOPLE,
    { variables: { limit: 10 } },
  );

  // Search query
  const [executeSearch, { data: searchData, loading }] =
    useLazyQuery<SearchResult>(SEARCH_PEOPLE);

  const recentPeople = recentData?.recentPeople || [];
  const searchResults = searchData?.search?.edges?.map((e) => e.node) || [];

  // Determine which list to show
  const showSearch = query.length >= 2;
  const results = showSearch ? searchResults : recentPeople;

  // Search when query changes
  useEffect(() => {
    if (query.length >= 2) {
      executeSearch({ variables: { query, first: 10 } });
    }
  }, [query, executeSearch]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (person: Person) => {
    onChange(person.id);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  // Find selected person for display
  const selectedPerson = recentPeople.find((p) => p.id === value);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500">
        <Search className="w-4 h-4 text-gray-400 ml-3" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedPerson ? selectedPerson.name_full : placeholder}
          className="bg-transparent px-3 py-2 flex-1 outline-none text-sm min-w-[200px]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="pr-3 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto">
          {!showSearch && (
            <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b">
              Recent People
            </div>
          )}
          {loading ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              Searching...
            </div>
          ) : results.length > 0 ? (
            results.map((person, index) => (
              <button
                type="button"
                key={person.id}
                onClick={() => handleSelect(person)}
                className={`w-full px-3 py-2 text-left border-b last:border-b-0 transition-colors ${
                  selectedIndex === index || person.id === value
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="font-medium text-sm">{person.name_full}</div>
                <div className="text-xs text-gray-500">
                  {person.birth_year && `b. ${person.birth_year}`}
                  {person.death_year && ` – d. ${person.death_year}`}
                  {person.birth_place && ` • ${person.birth_place}`}
                </div>
              </button>
            ))
          ) : showSearch ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              No results found
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
