'use client';

import { useLazyQuery } from '@apollo/client/react';
import { Clock, Search, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SEARCH_PEOPLE } from '@/lib/graphql/queries';
import { useRecentSearches } from '@/lib/hooks/useRecentSearches';
import type { Person } from '@/lib/types';

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
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [executeSearch, { data, loading }] =
    useLazyQuery<SearchResult>(SEARCH_PEOPLE);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    searches: recentSearches,
    addSearch,
    clearSearches,
  } = useRecentSearches();

  const results = data?.search?.edges?.map((e) => e.node) || [];

  // Search when query changes
  useEffect(() => {
    if (query.length >= 2) {
      executeSearch({ variables: { query, first: 8 } });
    }
  }, [query, executeSearch]);

  // Handle query change - reset selection
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(-1);
  };

  // Show dropdown when focused and either has query or has recent searches
  const showResults = query.length >= 2 && isFocused;
  const showRecent = isFocused && query.length < 2 && recentSearches.length > 0;
  const isOpen = showResults || showRecent;

  // Calculate total items for keyboard navigation
  const totalItems = showRecent
    ? recentSearches.length
    : showResults
      ? results.length +
        (data?.search?.totalCount && data.search.totalCount > 8 ? 1 : 0)
      : 0;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
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

  const handleRecentClick = (searchQuery: string) => {
    addSearch(searchQuery);
    setIsFocused(false);
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('');
      setSelectedIndex(-1);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isOpen && totalItems > 0) {
        setSelectedIndex((prev) => (prev + 1) % totalItems);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen && totalItems > 0) {
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      }
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && isOpen) {
        e.preventDefault();
        if (showRecent && selectedIndex < recentSearches.length) {
          handleRecentClick(recentSearches[selectedIndex].query);
        } else if (showResults) {
          if (selectedIndex < results.length) {
            addSearch(query);
            handleSelect(results[selectedIndex].id);
          } else {
            addSearch(query);
            router.push(`/search?q=${encodeURIComponent(query)}`);
            setIsFocused(false);
          }
        }
      } else if (query.trim()) {
        addSearch(query.trim());
        setIsFocused(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
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
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search people..."
          className="bg-transparent text-white placeholder-white/50 px-3 py-2 w-48 focus:w-64 transition-all outline-none text-sm"
        />
        {query && (
          <button
            onClick={() => handleQueryChange('')}
            className="pr-3 text-white/60 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-72 bg-[var(--card)] text-[var(--card-foreground)] rounded-lg shadow-xl border border-[var(--border)] z-50 max-h-80 overflow-y-auto">
          {/* Recent searches (when no query) */}
          {showRecent && (
            <>
              <div className="px-4 py-2 flex items-center justify-between border-b border-[var(--border)]">
                <span className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Recent Searches
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSearches();
                  }}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={search.timestamp}
                  onClick={() => handleRecentClick(search.query)}
                  className={`w-full px-4 py-2 text-left border-b border-[var(--border)] last:border-b-0 transition-colors flex items-center gap-2 ${
                    selectedIndex === index
                      ? 'bg-[var(--accent)]'
                      : 'hover:bg-[var(--accent)]'
                  }`}
                >
                  <Clock className="w-3 h-3 text-[var(--muted-foreground)]" />
                  <span className="text-sm">{search.query}</span>
                </button>
              ))}
            </>
          )}
          {/* Search results */}
          {showResults && (
            <>
              {loading ? (
                <div className="p-4 text-center text-[var(--muted-foreground)] text-sm">
                  Searching...
                </div>
              ) : results.length > 0 ? (
                <>
                  {results.map((person, index) => (
                    <button
                      key={person.id}
                      onClick={() => {
                        addSearch(query);
                        handleSelect(person.id);
                      }}
                      className={`w-full px-4 py-3 text-left border-b border-[var(--border)] last:border-b-0 transition-colors ${
                        selectedIndex === index
                          ? 'bg-[var(--accent)]'
                          : 'hover:bg-[var(--accent)]'
                      }`}
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
                      onClick={() => {
                        addSearch(query);
                        router.push(`/search?q=${encodeURIComponent(query)}`);
                        setIsFocused(false);
                      }}
                      className={`w-full px-4 py-2 text-center text-sm text-blue-600 dark:text-blue-400 ${
                        selectedIndex === results.length
                          ? 'bg-[var(--accent)]'
                          : 'hover:bg-[var(--accent)]'
                      }`}
                    >
                      View all {data.search.totalCount} results →
                    </button>
                  )}
                </>
              ) : (
                <div className="p-4 text-center text-[var(--muted-foreground)] text-sm">
                  No results found
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
