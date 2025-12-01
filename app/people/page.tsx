'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import PersonCard from '@/components/PersonCard';
import { Person } from '@/lib/types';

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'living' | 'male' | 'female'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/people')
      .then(res => res.json())
      .then(data => {
        setPeople(data);
        setFilteredPeople(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let result = people;
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => 
        p.name_full.toLowerCase().includes(q) ||
        p.birth_place?.toLowerCase().includes(q) ||
        p.death_place?.toLowerCase().includes(q)
      );
    }
    
    if (filter === 'living') result = result.filter(p => p.living);
    else if (filter === 'male') result = result.filter(p => p.sex === 'M');
    else if (filter === 'female') result = result.filter(p => p.sex === 'F');
    
    setFilteredPeople(result);
  }, [search, filter, people]);

  return (
    <>
      <Sidebar />
      <main className="main-content">
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
        <Footer />
      </main>
    </>
  );
}

