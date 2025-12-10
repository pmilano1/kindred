'use client';

import { useQuery } from '@apollo/client/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button, PageHeader } from '@/components/ui';
import { GET_TIMELINE } from '@/lib/graphql/queries';
import type { Person } from '@/lib/types';

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
    return timeline
      .map((t) => ({
        ...t,
        events: t.events.filter(
          (e) =>
            filter === 'all' ||
            (filter === 'births' && e.type === 'birth') ||
            (filter === 'deaths' && e.type === 'death'),
        ),
      }))
      .filter((t) => t.events.length > 0);
  }, [data?.timeline, filter]);

  return (
    <>
      <PageHeader
        title="Timeline"
        subtitle="Family events through history"
        icon="Calendar"
      />
      <div className="content-wrapper">
        <fieldset className="flex flex-wrap gap-2 mb-6 border-0 p-0">
          <legend className="sr-only">Filter timeline events</legend>
          {(['all', 'births', 'deaths'] as const).map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              variant={filter === f ? 'primary' : 'secondary'}
              aria-pressed={filter === f}
              className="flex-1 sm:flex-none min-w-[120px]"
            >
              {f === 'all'
                ? 'All Events'
                : f === 'births'
                  ? '🎂 Births'
                  : '✝️ Deaths'}
            </Button>
          ))}
        </fieldset>

        {loading ? (
          <div className="text-center py-12 text-gray-500">
            Loading timeline...
          </div>
        ) : (
          <div className="timeline">
            {filteredTimeline.map(({ year, events }) => (
              <div key={year} className="timeline-item">
                <div className="timeline-marker"></div>
                <div className="card p-4">
                  <h3 className="text-xl font-bold text-gray-800 mb-3">
                    {year}
                  </h3>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <Link
                        key={`${event.person.id}-${event.type}`}
                        href={`/person/${event.person.id}`}
                        className="flex items-center gap-2 text-sm hover:text-green-700"
                      >
                        <span>{event.type === 'birth' ? '🎂' : '✝️'}</span>
                        <span
                          className={
                            event.type === 'birth'
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }
                        >
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
