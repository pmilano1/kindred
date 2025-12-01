'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import PersonCard from '@/components/PersonCard';
import { Person } from '@/lib/types';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <Hero title="Search" subtitle="Find ancestors by name, place, or date" />
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
                Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
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
        <Footer />
      </main>
    </>
  );
}

