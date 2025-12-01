'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import { Person } from '@/lib/types';

interface TimelineEvent {
  year: number;
  events: Array<{ type: 'birth' | 'death'; person: Person }>;
}

export default function TimelinePage() {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'births' | 'deaths'>('all');

  useEffect(() => {
    fetch('/api/timeline')
      .then(res => res.json())
      .then(data => {
        setTimeline(data);
        setLoading(false);
      });
  }, []);

  const filteredTimeline = timeline.map(t => ({
    ...t,
    events: t.events.filter(e => 
      filter === 'all' || 
      (filter === 'births' && e.type === 'birth') ||
      (filter === 'deaths' && e.type === 'death')
    )
  })).filter(t => t.events.length > 0);

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <Hero title="Timeline" subtitle="Family events through history" />
        <div className="content-wrapper">
          <div className="flex gap-2 mb-6">
            {(['all', 'births', 'deaths'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`tree-btn ${filter === f ? '' : 'opacity-60'}`}
              >
                {f === 'all' ? 'All Events' : f === 'births' ? '🎂 Births' : '✝️ Deaths'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading timeline...</div>
          ) : (
            <div className="timeline">
              {filteredTimeline.map(({ year, events }) => (
                <div key={year} className="timeline-item">
                  <div className="timeline-marker"></div>
                  <div className="card p-4">
                    <h3 className="text-xl font-bold text-gray-800 mb-3">{year}</h3>
                    <div className="space-y-2">
                      {events.map((event, i) => (
                        <Link 
                          key={i} 
                          href={`/person/${event.person.id}`}
                          className="flex items-center gap-2 text-sm hover:text-green-700"
                        >
                          <span>{event.type === 'birth' ? '🎂' : '✝️'}</span>
                          <span className={event.type === 'birth' ? 'text-green-600' : 'text-gray-600'}>
                            {event.person.name_full}
                          </span>
                          <span className="text-gray-400">
                            {event.type === 'birth' ? 'born' : 'died'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Footer />
      </main>
    </>
  );
}

