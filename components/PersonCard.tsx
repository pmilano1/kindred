import { TreeDeciduous, Users } from 'lucide-react';
import Link from 'next/link';
import type { Person } from '@/lib/types';

interface PersonCardProps {
  person: Person;
  showDetails?: boolean;
  showCompleteness?: boolean;
}

function CompletenessIndicator({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 50) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getColor()}`}
      title={`${score}% complete`}
    >
      <svg
        className="w-3 h-3"
        viewBox="0 0 36 36"
        role="img"
        aria-label={`${score}% complete`}
      >
        <path
          className="opacity-20"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${score}, 100`}
          strokeLinecap="round"
        />
      </svg>
      <span>{score}%</span>
    </div>
  );
}

export default function PersonCard({
  person,
  showDetails = false,
  showCompleteness = true,
}: PersonCardProps) {
  const isFemale = person.sex === 'F';
  const isLiving = person.living;

  const formatDate = (year: number | null, place: string | null) => {
    if (!year && !place) return null;
    const parts = [];
    if (year) parts.push(year);
    if (place) parts.push(place);
    return parts.join(' • ');
  };

  return (
    <div
      className={`card person-card ${isFemale ? 'female' : ''} ${isLiving ? 'living' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Link
            href={`/person/${person.id}`}
            className="text-lg font-semibold text-gray-900 hover:text-green-700"
          >
            {person.name_full}
          </Link>
          <div className="flex flex-wrap gap-2 mt-2">
            <span
              className={`badge ${isFemale ? 'badge-female' : 'badge-male'}`}
            >
              {isFemale ? 'Female' : 'Male'}
            </span>
            {isLiving && <span className="badge badge-living">Living</span>}
            {showCompleteness && person.completeness_score !== undefined && (
              <CompletenessIndicator score={person.completeness_score} />
            )}
          </div>
        </div>
        {/* Tree navigation icons */}
        <div className="flex gap-1 ml-2">
          <Link
            href={`/tree?person=${person.id}&view=ancestors`}
            className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
            title="View ancestor tree"
            aria-label={`View ancestor tree for ${person.name_full}`}
          >
            <TreeDeciduous className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/tree?person=${person.id}&view=descendants`}
            className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
            title="View descendant tree"
            aria-label={`View descendant tree for ${person.name_full}`}
          >
            <Users className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 space-y-2 text-sm text-gray-600">
          {formatDate(person.birth_year, person.birth_place) && (
            <p>🎂 Born: {formatDate(person.birth_year, person.birth_place)}</p>
          )}
          {!isLiving && formatDate(person.death_year, person.death_place) && (
            <p>✝️ Died: {formatDate(person.death_year, person.death_place)}</p>
          )}
          {person.burial_place && <p>🪦 Burial: {person.burial_place}</p>}
        </div>
      )}
    </div>
  );
}
