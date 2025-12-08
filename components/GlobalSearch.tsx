'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLazyQuery } from '@apollo/client/react';
import { Search, X } from 'lucide-react';
import { SEARCH_PEOPLE } from '@/lib/graphql/queries';
import { Person } from '@/lib/types';

interface SearchResult {
  search: {
    edges: Array<{ node: Person }>;
    totalCount: number;
  };
}

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [executeSearch, { data, loading }] = useLazyQuery<SearchResult>(SEARCH_PEOPLE);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = data?.search?.edges?.map(e => e.node) || [];

  // Search when query changes
  useEffect(() => {
    if (query.length >= 2) {
      executeSearch({ variables: { query, first: 8 } });
    }
  }, [query, executeSearch]);

  // Dropdown open state derived from query length and focus
  const isOpen = query.length >= 2 && isFocused;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (personId: string) => {
    setQuery('');
    setIsFocused(false);
    router.push(`/person/${personId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    } else if (e.key === 'Enter' && query.trim()) {
      // Navigate to full search page on Enter
      setIsFocused(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center bg-white/10 rounded-lg border border-white/20 focus-within:border-white/40 transition-colors">
        <Search className="w-4 h-4 text-white/60 ml-3" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search people..."
          className="bg-transparent text-white placeholder-white/50 px-3 py-2 w-48 focus:w-64 transition-all outline-none text-sm"
        />
        {query && (
          <button onClick={() => setQuery('')} className="pr-3 text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-72 bg-[var(--card)] text-[var(--card-foreground)] rounded-lg shadow-xl border border-[var(--border)] z-50 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-[var(--muted-foreground)] text-sm">Searching...</div>
          ) : results.length > 0 ? (
            <>
              {results.map((person) => (
                <button
                  key={person.id}
                  onClick={() => handleSelect(person.id)}
                  className="w-full px-4 py-3 text-left hover:bg-[var(--accent)] border-b border-[var(--border)] last:border-b-0 transition-colors"
                >
                  <div className="font-medium">{person.name_full}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {person.birth_year && `b. ${person.birth_year}`}
                    {person.birth_year && person.death_year && ' – '}
                    {person.death_year && `d. ${person.death_year}`}
                    {person.birth_place && ` • ${person.birth_place}`}
                  </div>
                </button>
              ))}
              {data?.search?.totalCount && data.search.totalCount > 8 && (
                <button
                  onClick={() => { router.push(`/search?q=${encodeURIComponent(query)}`); setIsFocused(false); }}
                  className="w-full px-4 py-2 text-center text-sm text-blue-600 dark:text-blue-400 hover:bg-[var(--accent)]"
                >
                  View all {data.search.totalCount} results →
                </button>
              )}
            </>
          ) : query.length >= 2 ? (
            <div className="p-4 text-center text-[var(--muted-foreground)] text-sm">No results found</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

