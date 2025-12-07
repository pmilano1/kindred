'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSession } from 'next-auth/react';
import { GET_PERSON, UPDATE_NOTABLE_STATUS } from '@/lib/graphql/queries';
import ResearchPanel from '@/components/ResearchPanel';
import TreeLink from '@/components/TreeLink';
import Hero from '@/components/Hero';
import LifeEventsEditor from '@/components/LifeEventsEditor';
import FactsEditor from '@/components/FactsEditor';
import { Person, Family, LifeEvent, Fact } from '@/lib/types';

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
    lifeEvents: LifeEvent[];
    facts: Fact[];
  } | null;
}

interface Props {
  personId: string;
}

export default function PersonPageClient({ personId }: Props) {
  const { data: session } = useSession();
  const { data, loading, error } = useQuery<PersonData>(GET_PERSON, {
    variables: { id: personId },
  });
  const [updateNotable] = useMutation(UPDATE_NOTABLE_STATUS);
  const [notableEditing, setNotableEditing] = useState(false);
  const [notableDesc, setNotableDesc] = useState('');

  const canEdit = session?.user?.role === 'admin' || session?.user?.role === 'editor';

  const handleToggleNotable = async () => {
    const person = data?.person;
    if (!person) return;

    if (!person.is_notable) {
      // If marking as notable, show description editor
      setNotableDesc(person.notable_description || '');
      setNotableEditing(true);
    } else {
      // If unmarking, just toggle off
      await updateNotable({
        variables: { id: personId, isNotable: false, notableDescription: null },
        refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
      });
    }
  };

  const handleSaveNotable = async () => {
    await updateNotable({
      variables: { id: personId, isNotable: true, notableDescription: notableDesc || null },
      refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
    });
    setNotableEditing(false);
  };

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

  const subtitle = person.living
    ? 'Living'
    : `${person.birth_year || '?'} – ${person.death_year || '?'}`;

  return (
    <>
      <Hero
        title={person.name_full}
        subtitle={person.is_notable ? `⭐ ${subtitle} • Notable Figure` : subtitle}
      />
      <div className="content-wrapper">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Notable description */}
            {person.is_notable && person.notable_description && (
              <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
                <p className="text-amber-700 italic">{person.notable_description}</p>
              </div>
            )}

        {/* Notable Editor Modal */}
        {notableEditing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <h3 className="text-lg font-semibold mb-4">⭐ Mark as Notable Figure</h3>
              <p className="text-sm text-gray-600 mb-3">
                Add a short description of why this person is notable (optional):
              </p>
              <textarea
                value={notableDesc}
                onChange={(e) => setNotableDesc(e.target.value)}
                placeholder="e.g., First Empress of France, married Napoleon Bonaparte"
                className="w-full border rounded-lg p-3 text-sm mb-4"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setNotableEditing(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotable}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Info Card */}
        <div className={`card p-6 mb-6 border-l-4 ${isFemale ? 'border-l-pink-500' : 'border-l-blue-500'}`}>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`badge ${isFemale ? 'badge-female' : 'badge-male'}`}>
              {isFemale ? 'Female' : 'Male'}
            </span>
            {person.living && <span className="badge badge-living">Living</span>}
            {canEdit && (
              <button
                onClick={handleToggleNotable}
                className={`badge cursor-pointer transition-colors ${
                  person.is_notable
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                }`}
                title={person.is_notable ? 'Click to remove notable status' : 'Click to mark as notable'}
              >
                {person.is_notable ? '⭐ Notable' : '☆ Mark Notable'}
              </button>
            )}
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

        {/* Life Events (residences, occupations, other events) */}
        <LifeEventsEditor personId={personId} lifeEvents={person.lifeEvents} canEdit={canEdit} />

        {/* Coat of Arms */}
        {person.facts.filter(f => f.fact_type === 'coat_of_arms').length > 0 && (
          <div className="card p-6 mb-6 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300">
            <h3 className="section-title">🛡️ Coat of Arms</h3>
            <div className="flex flex-wrap gap-4 justify-center">
              {person.facts.filter(f => f.fact_type === 'coat_of_arms').map((fact) => (
                <a key={fact.id} href={fact.fact_value || '#'} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="relative w-[200px] h-[250px]">
                    <Image
                      src={fact.fact_value || ''}
                      alt="Family Coat of Arms"
                      fill
                      className="object-contain rounded-lg shadow-lg border-4 border-amber-200 hover:border-amber-400 transition-all hover:scale-105"
                      unoptimized
                    />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Facts */}
        <FactsEditor personId={personId} facts={person.facts} canEdit={canEdit} />

        <Link href="/people" className="inline-block tree-btn">
          ← Back to People
        </Link>
      </div>

        {/* Sidebar with Research Panel */}
        <div className="lg:w-80 flex-shrink-0">
          <ResearchPanel personId={personId} personName={person.name_full} />
        </div>
        </div>
      </div>
    </>
  );
}

