import Hero from '@/components/Hero';
import StatsCard from '@/components/StatsCard';
import PersonCard from '@/components/PersonCard';
import { query } from '@/lib/graphql/server';
import { GET_STATS, GET_RECENT_PEOPLE } from '@/lib/graphql/queries';
import type { Stats, Person } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [statsResult, recentResult] = await Promise.all([
    query<{ stats: Stats }>(GET_STATS),
    query<{ recentPeople: Person[] }>(GET_RECENT_PEOPLE, { limit: 6 })
  ]);

  const stats = statsResult.stats;
  const recentPeople = recentResult.recentPeople;

  return (
    <>
      <Hero />
      <div className="content-wrapper">
        <div className="stats-grid">
          <StatsCard label="Total People" value={stats.total_people} icon="👥" />
          <StatsCard label="Families" value={stats.total_families} icon="👨‍👩‍👧‍👦" />
          <StatsCard label="Living" value={stats.living_count} icon="💚" />
          <StatsCard label="Generations" value={stats.earliest_birth ? Math.ceil((new Date().getFullYear() - stats.earliest_birth) / 25) : 0} icon="🌳" />
        </div>

        <h2 className="section-title">Recently Born</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {recentPeople.map((person) => (
            <PersonCard key={person.id} person={person} showDetails />
          ))}
        </div>

        <div className="card p-6">
          <h2 className="section-title">Family Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats.male_count}</div>
              <div className="text-sm text-gray-500">Male</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-pink-600">{stats.female_count}</div>
              <div className="text-sm text-gray-500">Female</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats.earliest_birth || '—'}</div>
              <div className="text-sm text-gray-500">Earliest Birth</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{stats.latest_birth || '—'}</div>
              <div className="text-sm text-gray-500">Latest Birth</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
