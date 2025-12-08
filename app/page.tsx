import {
  BookOpen,
  Calendar,
  GitBranch,
  Search,
  TreePine,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import PersonCard from '@/components/PersonCard';
import StatsCard from '@/components/StatsCard';
import { ButtonLink, PageHeader } from '@/components/ui';
import { GET_DASHBOARD } from '@/lib/graphql/queries';
import { query } from '@/lib/graphql/server';
import type { Person } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface DashboardStats {
  total_people: number;
  total_families: number;
  total_sources: number;
  total_media: number;
  earliest_birth: number | null;
  latest_birth: number | null;
  living_count: number;
  incomplete_count: number;
}

interface ActivityEntry {
  id: string;
  action: string;
  details: string | null;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
  person_id: string | null;
  person_name: string | null;
}

interface IncompleteProfile {
  person: Person;
  missing_fields: string[];
  suggestion: string;
}

interface DashboardData {
  dashboardStats: DashboardStats;
  recentActivity: ActivityEntry[];
  incompleteProfiles: IncompleteProfile[];
  recentPeople: Person[];
}

function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    create_person: 'Added person',
    update_person: 'Updated person',
    delete_person: 'Deleted person',
    create_family: 'Created family',
    add_source: 'Added source',
    login: 'Logged in',
    set_my_person: 'Linked to profile',
  };
  return actionMap[action] || action.replace(/_/g, ' ');
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default async function Home() {
  const result = await query<DashboardData>(GET_DASHBOARD, {
    activityLimit: 8,
    incompleteLimit: 5,
    recentLimit: 6,
  });

  const { dashboardStats, recentActivity, incompleteProfiles, recentPeople } =
    result;

  const generations = dashboardStats.earliest_birth
    ? Math.ceil((new Date().getFullYear() - dashboardStats.earliest_birth) / 25)
    : 0;

  return (
    <>
      <PageHeader icon="LayoutDashboard" title="Dashboard" />
      <div className="content-wrapper">
        {/* Statistics Cards */}
        <div className="stats-grid mb-8">
          <StatsCard
            label="Total People"
            value={dashboardStats.total_people}
            icon="👥"
          />
          <StatsCard
            label="Families"
            value={dashboardStats.total_families}
            icon="👨‍👩‍👧‍👦"
          />
          <StatsCard
            label="Sources"
            value={dashboardStats.total_sources}
            icon="📚"
          />
          <StatsCard label="Generations" value={generations} icon="🌳" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Activity */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                Recent Activity
              </h2>
            </div>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 text-sm border-b border-gray-100 pb-3 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {formatAction(activity.action)}
                        {activity.person_name && (
                          <>
                            {': '}
                            {activity.person_id ? (
                              <Link
                                href={`/person/${activity.person_id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {activity.person_name}
                              </Link>
                            ) : (
                              activity.person_name
                            )}
                          </>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {activity.user_name || activity.user_email || 'System'}{' '}
                        • {formatTimeAgo(activity.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No recent activity</p>
            )}
          </div>

          {/* Research Suggestions */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                Research Suggestions
              </h2>
              <Link
                href="/research"
                className="text-sm text-blue-600 hover:underline"
              >
                View all →
              </Link>
            </div>
            {incompleteProfiles.length > 0 ? (
              <div className="space-y-3">
                {incompleteProfiles.map((item) => (
                  <Link
                    key={item.person.id}
                    href={`/person/${item.person.id}`}
                    className="block p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <div className="font-medium text-gray-900">
                      {item.person.name_full}
                    </div>
                    <div className="text-sm text-amber-700">
                      {item.suggestion}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Missing: {item.missing_fields.join(', ')}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                All profiles are complete! 🎉
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ButtonLink
              href="/tree"
              variant="secondary"
              className="flex flex-col items-center gap-2 py-4"
            >
              <TreePine className="w-6 h-6" />
              <span>View Tree</span>
            </ButtonLink>
            <ButtonLink
              href="/search"
              variant="secondary"
              className="flex flex-col items-center gap-2 py-4"
            >
              <Search className="w-6 h-6" />
              <span>Search</span>
            </ButtonLink>
            <ButtonLink
              href="/people"
              variant="secondary"
              className="flex flex-col items-center gap-2 py-4"
            >
              <Users className="w-6 h-6" />
              <span>All People</span>
            </ButtonLink>
            <ButtonLink
              href="/research"
              variant="secondary"
              className="flex flex-col items-center gap-2 py-4"
            >
              <BookOpen className="w-6 h-6" />
              <span>Research</span>
            </ButtonLink>
          </div>
        </div>

        {/* Recently Added */}
        <h2 className="section-title flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Recently Born
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {recentPeople.map((person) => (
            <PersonCard key={person.id} person={person} showDetails />
          ))}
        </div>

        {/* Additional Stats */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Family Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {dashboardStats.living_count}
              </div>
              <div className="text-sm text-gray-500">Living</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">
                {dashboardStats.incomplete_count}
              </div>
              <div className="text-sm text-gray-500">Need Research</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {dashboardStats.earliest_birth || '—'}
              </div>
              <div className="text-sm text-gray-500">Earliest Birth</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {dashboardStats.latest_birth || '—'}
              </div>
              <div className="text-sm text-gray-500">Latest Birth</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
