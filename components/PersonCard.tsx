import Link from 'next/link';
import { Person } from '@/lib/types';

interface PersonCardProps {
  person: Person;
  showDetails?: boolean;
}

export default function PersonCard({ person, showDetails = false }: PersonCardProps) {
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
    <div className={`card person-card ${isFemale ? 'female' : ''} ${isLiving ? 'living' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Link href={`/person/${person.id}`} className="text-lg font-semibold text-gray-900 hover:text-green-700">
            {person.name_full}
          </Link>
          <div className="flex gap-2 mt-2">
            <span className={`badge ${isFemale ? 'badge-female' : 'badge-male'}`}>
              {isFemale ? 'Female' : 'Male'}
            </span>
            {isLiving && <span className="badge badge-living">Living</span>}
          </div>
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
          {person.burial_place && (
            <p>🪦 Burial: {person.burial_place}</p>
          )}
        </div>
      )}
    </div>
  );
}

