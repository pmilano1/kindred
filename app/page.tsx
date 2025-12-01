import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import StatsCard from '@/components/StatsCard';
import PersonCard from '@/components/PersonCard';
import { getStats, getRecentPeople } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [stats, recentPeople] = await Promise.all([
    getStats(),
    getRecentPeople(6)
  ]);

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <Hero title="Milanese Family" subtitle="Exploring Our Heritage Through Generations" />
        <div className="content-wrapper">
          <div className="stats-grid">
            <StatsCard label="Total People" value={stats.total_people} icon="👥" />
            <StatsCard label="Families" value={stats.total_families} icon="👨‍👩‍👧‍👦" />
            <StatsCard label="Living" value={stats.living_count} icon="💚" />
            <StatsCard label="Linked to FamilySearch" value={stats.with_familysearch_id} icon="🔗" />
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
        <Footer />
      </main>
    </>
  );
}
