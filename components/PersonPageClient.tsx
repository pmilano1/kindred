'use client';

import Link from 'next/link';
import { useQuery } from '@apollo/client/react';
import { GET_PERSON } from '@/lib/graphql/queries';
import ResearchPanel from '@/components/ResearchPanel';
import TreeLink from '@/components/TreeLink';
import { Person, Family, Residence, Occupation, Event, Fact } from '@/lib/types';

interface PersonData {
  person: Person & {
    parents: Person[];
    siblings: Person[];
    spouses: Person[];
    children: Person[];
    families: (Family & {
      husband: Person | null;
      wife: Person | null;
      children: Person[];
    })[];
    residences: Residence[];
    occupations: Occupation[];
    events: Event[];
    facts: Fact[];
  } | null;
}

interface Props {
  personId: string;
}

export default function PersonPageClient({ personId }: Props) {
  const { data, loading, error } = useQuery<PersonData>(GET_PERSON, {
    variables: { id: personId },
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-600">Error: {error.message}</div>;
  }

  const person = data?.person;
  if (!person) {
    return <div className="p-6">Person not found</div>;
  }

  const isFemale = person.sex === 'F';

  // Get families where this person is a spouse
  const familiesAsSpouse = person.families.filter(
    f => f.husband_id === personId || f.wife_id === personId
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Hero */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">{person.name_full}</h1>
          <p className="text-gray-600">
            {person.living ? 'Living' : `${person.birth_year || '?'} – ${person.death_year || '?'}`}
          </p>
        </div>

        {/* Main Info Card */}
        <div className={`card p-6 mb-6 border-l-4 ${isFemale ? 'border-l-pink-500' : 'border-l-blue-500'}`}>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`badge ${isFemale ? 'badge-female' : 'badge-male'}`}>
              {isFemale ? 'Female' : 'Male'}
            </span>
            {person.living && <span className="badge badge-living">Living</span>}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">🎂 Birth</h3>
              <p className="text-gray-600">
                {person.birth_date || person.birth_year || 'Unknown'}
                {person.birth_place && <><br /><span className="text-sm">{person.birth_place}</span></>}
              </p>
            </div>
            {person.christening_date && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">⛪ Christening</h3>
                <p className="text-gray-600">
                  {person.christening_date}
                  {person.christening_place && <><br /><span className="text-sm">{person.christening_place}</span></>}
                </p>
              </div>
            )}
            {!person.living && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">✝️ Death</h3>
                <p className="text-gray-600">
                  {person.death_date || person.death_year || 'Unknown'}
                  {person.death_place && <><br /><span className="text-sm">{person.death_place}</span></>}
                </p>
              </div>
            )}
            {(person.burial_date || person.burial_place) && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">🪦 Burial</h3>
                <p className="text-gray-600">
                  {person.burial_date}
                  {person.burial_place && <><br /><span className="text-sm">{person.burial_place}</span></>}
                </p>
              </div>
            )}
            {person.immigration_date && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">🚢 Immigration</h3>
                <p className="text-gray-600">
                  {person.immigration_date}
                  {person.immigration_place && <><br /><span className="text-sm">{person.immigration_place}</span></>}
                </p>
              </div>
            )}
            {person.naturalization_date && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">🏛️ Naturalization</h3>
                <p className="text-gray-600">
                  {person.naturalization_date}
                  {person.naturalization_place && <><br /><span className="text-sm">{person.naturalization_place}</span></>}
                </p>
              </div>
            )}
            {person.religion && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">✡️ Religion</h3>
                <p className="text-gray-600">{person.religion}</p>
              </div>
            )}
          </div>
          {person.description && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-semibold text-gray-700 mb-2">📝 Notes</h3>
              <p className="text-gray-600 text-sm">{person.description}</p>
            </div>
          )}
          {person.familysearch_id && (
            <div className="mt-4 pt-4 border-t">
              <a href={`https://www.familysearch.org/tree/person/details/${person.familysearch_id}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1">
                🌳 View on FamilySearch
              </a>
            </div>
          )}
        </div>

        {/* Spouse & Children */}
        {familiesAsSpouse.length > 0 && familiesAsSpouse.map((family, i) => {
          const spouse = family.husband_id === personId ? family.wife : family.husband;
          return (
            <div key={family.id} className="card p-6 mb-6">
              <h3 className="section-title">Family {familiesAsSpouse.length > 1 ? i + 1 : ''}</h3>
              {spouse && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Spouse</p>
                  <div className={`p-4 rounded-lg border-l-4 ${spouse.sex === 'F' ? 'border-l-pink-400 bg-pink-50' : 'border-l-blue-400 bg-blue-50'} hover:shadow-md transition flex justify-between items-start`}>
                    <Link href={`/person/${spouse.id}`} className="flex-1">
                      <p className="font-semibold">{spouse.name_full}</p>
                      <p className="text-sm text-gray-500">
                        {family.marriage_place && `Married in ${family.marriage_place}`}
                        {family.marriage_year && ` (${family.marriage_year})`}
                      </p>
                    </Link>
                    <TreeLink personId={spouse.id} />
                  </div>
                </div>
              )}
              {family.children.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Children ({family.children.length})</p>
                  <div className="grid md:grid-cols-2 gap-2">
                    {family.children.map(child => (
                      <div key={child.id} className={`p-3 rounded border-l-4 ${child.sex === 'F' ? 'border-l-pink-300 bg-pink-50/50' : 'border-l-blue-300 bg-blue-50/50'} hover:shadow-sm transition text-sm flex justify-between items-center`}>
                        <Link href={`/person/${child.id}`} className="flex-1">
                          {child.name_full} {child.birth_year ? `(b. ${child.birth_year})` : ''}
                        </Link>
                        <TreeLink personId={child.id} className="text-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Parents */}
        {person.parents.length > 0 && (
          <div className="card p-6 mb-6">
            <h3 className="section-title">Parents</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {person.parents.map(parent => (
                <div key={parent.id} className={`p-4 rounded-lg border-l-4 ${parent.sex === 'F' ? 'border-l-pink-400 bg-pink-50' : 'border-l-blue-400 bg-blue-50'} hover:shadow-md transition flex justify-between items-start`}>
                  <Link href={`/person/${parent.id}`} className="flex-1">
                    <p className="font-semibold">{parent.name_full}</p>
                    <p className="text-sm text-gray-500">{parent.birth_year || '?'} – {parent.death_year || (parent.living ? 'Living' : '?')}</p>
                  </Link>
                  <TreeLink personId={parent.id} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Siblings */}
        {person.siblings.length > 0 && (
          <div className="card p-6 mb-6">
            <h3 className="section-title">Siblings ({person.siblings.length})</h3>
            <div className="grid md:grid-cols-2 gap-2">
              {person.siblings.map(sibling => (
                <div key={sibling.id} className={`p-3 rounded border-l-4 ${sibling.sex === 'F' ? 'border-l-pink-300 bg-pink-50/50' : 'border-l-blue-300 bg-blue-50/50'} hover:shadow-sm transition text-sm flex justify-between items-center`}>
                  <Link href={`/person/${sibling.id}`} className="flex-1">
                    {sibling.name_full} {sibling.birth_year ? `(b. ${sibling.birth_year})` : ''}
                  </Link>
                  <TreeLink personId={sibling.id} className="text-sm" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Occupations */}
        {person.occupations.length > 0 && (
          <div className="card p-6 mb-6">
            <h3 className="section-title">💼 Occupations</h3>
            <div className="space-y-2">
              {person.occupations.map((occ) => (
                <div key={occ.id} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-800 font-medium">{occ.title || 'Unknown'}</span>
                  {(occ.occupation_date || occ.occupation_place) && (
                    <span className="text-gray-500">
                      {occ.occupation_date && `(${occ.occupation_date})`}
                      {occ.occupation_place && ` - ${occ.occupation_place}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Residences */}
        {person.residences.length > 0 && (
          <div className="card p-6 mb-6">
            <h3 className="section-title">🏠 Residences</h3>
            <div className="space-y-2">
              {person.residences.map((res) => (
                <div key={res.id} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-500">{res.residence_date || res.residence_year || ''}</span>
                  <span className="text-gray-800">{res.residence_place || 'Unknown location'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Life Events */}
        {person.events.length > 0 && (
          <div className="card p-6 mb-6">
            <h3 className="section-title">📅 Life Events</h3>
            <div className="space-y-2">
              {person.events.map((evt) => (
                <div key={evt.id} className="flex items-start gap-2 text-sm">
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{evt.event_type || 'Event'}</span>
                  {evt.event_date && <span className="text-gray-500">{evt.event_date}</span>}
                  {evt.event_place && <span className="text-gray-800">{evt.event_place}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coat of Arms */}
        {person.facts.filter(f => f.fact_type === 'coat_of_arms').length > 0 && (
          <div className="card p-6 mb-6 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300">
            <h3 className="section-title">🛡️ Coat of Arms</h3>
            <div className="flex flex-wrap gap-4 justify-center">
              {person.facts.filter(f => f.fact_type === 'coat_of_arms').map((fact) => (
                <a key={fact.id} href={fact.fact_value || '#'} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={fact.fact_value || ''}
                    alt="Family Coat of Arms"
                    className="max-w-[200px] max-h-[250px] rounded-lg shadow-lg border-4 border-amber-200 hover:border-amber-400 transition-all hover:scale-105"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Facts */}
        {person.facts.filter(f => f.fact_type !== 'coat_of_arms').length > 0 && (
          <div className="card p-6 mb-6">
            <h3 className="section-title">📋 Additional Information</h3>
            <div className="space-y-2">
              {person.facts.filter(f => f.fact_type !== 'coat_of_arms').map((fact) => (
                <div key={fact.id} className="text-sm">
                  <span className="text-gray-600 font-medium">{fact.fact_type || 'Fact'}:</span>{' '}
                  <span className="text-gray-800">{fact.fact_value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link href="/people" className="inline-block tree-btn">
          ← Back to People
        </Link>
      </div>

      {/* Sidebar with Research Panel */}
      <div className="lg:w-80 flex-shrink-0">
        <ResearchPanel personId={personId} personName={person.name_full} />
      </div>
    </div>
  );
}

