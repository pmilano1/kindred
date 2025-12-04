import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import { getResearchQueue } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'bg-gray-200 text-gray-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  partial: { label: 'Partial', color: 'bg-yellow-100 text-yellow-800' },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-800' },
  needs_review: { label: 'Needs Review', color: 'bg-orange-100 text-orange-800' },
  brick_wall: { label: 'Brick Wall', color: 'bg-red-100 text-red-800' },
};

export default async function ResearchQueuePage() {
  const queue = await getResearchQueue();

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <Hero
          title="Research Queue"
          subtitle={`${queue.length} people prioritized for research`}
        />
        <div className="content-wrapper">
          <div className="max-w-6xl mx-auto">
            <div className="card p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">📋 Research Priority List</h2>
                <p className="text-sm text-gray-500">
                  Right-click any person in the tree view to set priority
                </p>
              </div>

              {queue.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No people in the research queue yet. Set priority on people in the tree view to add them here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 px-3 text-sm font-semibold">Priority</th>
                        <th className="py-2 px-3 text-sm font-semibold">Name</th>
                        <th className="py-2 px-3 text-sm font-semibold">Years</th>
                        <th className="py-2 px-3 text-sm font-semibold">Status</th>
                        <th className="py-2 px-3 text-sm font-semibold">Notes</th>
                        <th className="py-2 px-3 text-sm font-semibold">Last Researched</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((person) => {
                        const statusInfo = STATUS_LABELS[person.research_status] || STATUS_LABELS.not_started;
                        const years = person.birth_year || person.death_year
                          ? `${person.birth_year || '?'} – ${person.death_year || '?'}`
                          : 'Unknown';
                        return (
                          <tr key={person.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-3">
                              <span className={`inline-block w-8 h-8 rounded-full text-center leading-8 font-bold text-white ${
                                person.research_priority >= 7 ? 'bg-red-500' :
                                person.research_priority >= 4 ? 'bg-orange-500' : 'bg-blue-500'
                              }`}>
                                {person.research_priority}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <Link href={`/person/${person.id}`} className="text-blue-600 hover:underline font-medium">
                                {person.name_full}
                              </Link>
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-600">{years}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-600">
                              {person.research_notes_count} notes
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-500">
                              {person.last_researched
                                ? new Date(person.last_researched).toLocaleDateString()
                                : 'Never'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="card p-4 mt-6">
              <h3 className="font-semibold mb-3">Legend</h3>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-red-500"></span>
                  <span>High Priority (7-10)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-orange-500"></span>
                  <span>Medium Priority (4-6)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                  <span>Low Priority (1-3)</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm mt-3">
                {Object.entries(STATUS_LABELS).map(([key, info]) => (
                  <span key={key} className={`px-2 py-1 rounded-full ${info.color}`}>
                    {info.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </>
  );
}

