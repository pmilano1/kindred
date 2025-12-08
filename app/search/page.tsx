'use client';

import { useLazyQuery } from '@apollo/client/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import PersonCard from '@/components/PersonCard';
import { PageHeader } from '@/components/ui';
import { SEARCH_PEOPLE } from '@/lib/graphql/queries';
import type { Person } from '@/lib/types';

interface SearchResult {
  search: {
    edges: Array<{ node: Person; cursor: string }>;
    pageInfo: {
      totalCount: number;
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

type SortOption = 'relevance' | 'name' | 'birth_year_asc' | 'birth_year_desc';
type LivingFilter = 'all' | 'living' | 'deceased';

function SearchContent() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') || '';

  const searchTermRef = useRef(urlQuery);
  const [executeSearch, { data, called }] =
    useLazyQuery<SearchResult>(SEARCH_PEOPLE);
  const lastUrlQuery = useRef<string>('');

  // Filter and sort state
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [livingFilter, setLivingFilter] = useState<LivingFilter>('all');
  const [surnameFilter, setSurnameFilter] = useState<string>('');

  const searched = called;
  // Derive displayed search term from URL or last searched
  // eslint-disable-next-line react-hooks/refs -- ref is updated before executeSearch, safe to read
  const displayedSearchTerm = urlQuery || searchTermRef.current;

  const rawResults = useMemo(
    () => data?.search?.edges?.map((e) => e.node) || [],
    [data?.search?.edges],
  );
  const totalCount = data?.search?.pageInfo?.totalCount || 0;

  // Extract unique surnames for filter dropdown
  const uniqueSurnames = useMemo(() => {
    const surnames = rawResults
      .map((p) => p.name_surname)
      .filter((s): s is string => !!s);
    return [...new Set(surnames)].sort();
  }, [rawResults]);

  // Apply client-side filters and sorting
  const results = useMemo(() => {
    let filtered = [...rawResults];

    // Apply living filter
    if (livingFilter === 'living') {
      filtered = filtered.filter((p) => p.living === true);
    } else if (livingFilter === 'deceased') {
      filtered = filtered.filter((p) => p.living === false || p.death_year);
    }

    // Apply surname filter
    if (surnameFilter) {
      filtered = filtered.filter((p) => p.name_surname === surnameFilter);
    }

    // Apply sorting
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) =>
          (a.name_full || '').localeCompare(b.name_full || ''),
        );
        break;
      case 'birth_year_asc':
        filtered.sort(
          (a, b) => (a.birth_year || 9999) - (b.birth_year || 9999),
        );
        break;
      case 'birth_year_desc':
        filtered.sort((a, b) => (b.birth_year || 0) - (a.birth_year || 0));
        break;
      // 'relevance' is the default order from the server
    }

    return filtered;
  }, [rawResults, sortBy, livingFilter, surnameFilter]);

  // Sync with URL query param - triggers search when URL changes (from GlobalSearch)
  useEffect(() => {
    if (urlQuery && urlQuery !== lastUrlQuery.current) {
      lastUrlQuery.current = urlQuery;
      searchTermRef.current = urlQuery;
      executeSearch({ variables: { query: urlQuery, first: 100 } });
    }
  }, [urlQuery, executeSearch]);

  return (
    <>
      <PageHeader
        title="Search Results"
        subtitle={
          searched
            ? `Found ${totalCount} result${totalCount !== 1 ? 's' : ''} for "${displayedSearchTerm}"`
            : 'Use the search bar above to find family members'
        }
        icon="Search"
      />
      <div className="content-wrapper">
        {searched && (
          <div>
            {/* Results summary */}
            <p className="text-sm text-[var(--text-muted)] mb-4 text-center">
              Found {totalCount} result{totalCount !== 1 ? 's' : ''} for &ldquo;
              {displayedSearchTerm}&rdquo;
              {results.length !== totalCount &&
                ` (showing ${results.length} after filters)`}
            </p>

            {/* Filter and Sort Controls */}
            {rawResults.length > 0 && (
              <div className="card p-4 mb-6">
                <div className="flex flex-wrap gap-4 items-center">
                  {/* Sort */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="sort-select"
                      className="text-sm font-medium text-[var(--text-muted)]"
                    >
                      Sort:
                    </label>
                    <select
                      id="sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="input-field text-sm py-1 px-2"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="name">Name (A-Z)</option>
                      <option value="birth_year_asc">
                        Birth Year (oldest)
                      </option>
                      <option value="birth_year_desc">
                        Birth Year (newest)
                      </option>
                    </select>
                  </div>

                  {/* Living Filter */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="living-select"
                      className="text-sm font-medium text-[var(--text-muted)]"
                    >
                      Status:
                    </label>
                    <select
                      id="living-select"
                      value={livingFilter}
                      onChange={(e) =>
                        setLivingFilter(e.target.value as LivingFilter)
                      }
                      className="input-field text-sm py-1 px-2"
                    >
                      <option value="all">All</option>
                      <option value="living">Living</option>
                      <option value="deceased">Deceased</option>
                    </select>
                  </div>

                  {/* Surname Filter */}
                  {uniqueSurnames.length > 1 && (
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="surname-select"
                        className="text-sm font-medium text-[var(--text-muted)]"
                      >
                        Surname:
                      </label>
                      <select
                        id="surname-select"
                        value={surnameFilter}
                        onChange={(e) => setSurnameFilter(e.target.value)}
                        className="input-field text-sm py-1 px-2"
                      >
                        <option value="">All surnames</option>
                        {uniqueSurnames.map((surname) => (
                          <option key={surname} value={surname}>
                            {surname}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Clear filters */}
                  {(livingFilter !== 'all' ||
                    surnameFilter ||
                    sortBy !== 'relevance') && (
                    <button
                      type="button"
                      onClick={() => {
                        setLivingFilter('all');
                        setSurnameFilter('');
                        setSortBy('relevance');
                      }}
                      className="text-sm text-[var(--accent)] hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Results grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((person) => (
                <PersonCard key={person.id} person={person} showDetails />
              ))}
            </div>
            {results.length === 0 && (
              <div className="text-center py-12 text-[var(--text-muted)]">
                {rawResults.length > 0
                  ? 'No results match your filters. Try adjusting them.'
                  : 'No results found. Try a different search term.'}
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

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
