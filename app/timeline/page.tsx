'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@apollo/client/react';
import Hero from '@/components/Hero';
import { Person } from '@/lib/types';
import { GET_TIMELINE } from '@/lib/graphql/queries';

interface TimelineEvent {
  year: number;
  events: Array<{ type: 'birth' | 'death'; person: Person }>;
}

interface TimelineData {
  timeline: TimelineEvent[];
}

export default function TimelinePage() {
  const { data, loading } = useQuery<TimelineData>(GET_TIMELINE);
  const [filter, setFilter] = useState<'all' | 'births' | 'deaths'>('all');

  const filteredTimeline = useMemo(() => {
    const timeline = data?.timeline || [];
    return timeline.map(t => ({
      ...t,
      events: t.events.filter(e =>
        filter === 'all' ||
        (filter === 'births' && e.type === 'birth') ||
        (filter === 'deaths' && e.type === 'death')
      )
    })).filter(t => t.events.length > 0);
  }, [data?.timeline, filter]);

  return (
    <>
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
    </>
  );
}

