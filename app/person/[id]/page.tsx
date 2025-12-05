import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import ResearchPanel from '@/components/ResearchPanel';
import { getPerson, getPersonFamilies, getChildren, getPeople, getPersonResidences, getPersonOccupations, getPersonEvents, getPersonFacts, getNotableRelatives, getSiblings } from '@/lib/db';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;
  const [person, residences, occupations, events, facts, notableRelatives, siblings] = await Promise.all([
    getPerson(id),
    getPersonResidences(id),
    getPersonOccupations(id),
    getPersonEvents(id),
    getPersonFacts(id),
    getNotableRelatives(id),
    getSiblings(id)
  ]);

  if (!person) {
    notFound();
  }

  const { asSpouse, asChild } = await getPersonFamilies(id);
  const allPeople = await getPeople();
  const peopleMap = new Map(allPeople.map(p => [p.id, p]));

  // Get children for each family where person is a spouse
  const familiesWithChildren = await Promise.all(
    asSpouse.map(async (family) => ({
      family,
      children: await getChildren(family.id),
      spouse: family.husband_id === id
        ? peopleMap.get(family.wife_id || '')
        : peopleMap.get(family.husband_id || '')
    }))
  );

  const isFemale = person.sex === 'F';

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <Hero title={person.name_full} subtitle={person.living ? 'Living' : `${person.birth_year || '?'} – ${person.death_year || '?'}`} />
        <div className="content-wrapper">
          <div className="max-w-4xl mx-auto">
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

            {/* Research Panel */}
            <ResearchPanel personId={id} personName={person.name_full} />

            {/* Parents */}
            {asChild.length > 0 && (
              <div className="card p-6 mb-6">
                <h3 className="section-title">Parents</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {asChild[0].parents.map(parent => (
                    <Link key={parent.id} href={`/person/${parent.id}`} className="block">
                      <div className={`p-4 rounded-lg border-l-4 ${parent.sex === 'F' ? 'border-l-pink-400 bg-pink-50' : 'border-l-blue-400 bg-blue-50'} hover:shadow-md transition`}>
                        <p className="font-semibold">{parent.name_full}</p>
                        <p className="text-sm text-gray-500">{parent.birth_year || '?'} – {parent.death_year || (parent.living ? 'Living' : '?')}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Siblings */}
            {siblings.length > 0 && (
              <div className="card p-6 mb-6">
                <h3 className="section-title">Siblings ({siblings.length})</h3>
                <div className="grid md:grid-cols-2 gap-2">
                  {siblings.map(sibling => (
                    <Link key={sibling.id} href={`/person/${sibling.id}`}>
                      <div className={`p-3 rounded border-l-4 ${sibling.sex === 'F' ? 'border-l-pink-300 bg-pink-50/50' : 'border-l-blue-300 bg-blue-50/50'} hover:shadow-sm transition text-sm`}>
                        {sibling.name_full} {sibling.birth_year ? `(b. ${sibling.birth_year})` : ''}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Siblings */}
            {siblings.length > 0 && (
              <div className="card p-6 mb-6">
                <h3 className="section-title">Siblings ({siblings.length})</h3>
                <div className="grid md:grid-cols-2 gap-2">
                  {siblings.map(sibling => (
                    <Link key={sibling.id} href={`/person/${sibling.id}`}>
                      <div className={`p-3 rounded border-l-4 ${sibling.sex === 'F' ? 'border-l-pink-300 bg-pink-50/50' : 'border-l-blue-300 bg-blue-50/50'} hover:shadow-sm transition text-sm`}>
                        {sibling.name_full} {sibling.birth_year ? `(b. ${sibling.birth_year})` : ''}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Spouse & Children */}
            {familiesWithChildren.length > 0 && familiesWithChildren.map(({ family, children, spouse }, i) => (
              <div key={family.id} className="card p-6 mb-6">
                <h3 className="section-title">Family {familiesWithChildren.length > 1 ? i + 1 : ''}</h3>
                {spouse && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-2">Spouse</p>
                    <Link href={`/person/${spouse.id}`}>
                      <div className={`p-4 rounded-lg border-l-4 ${spouse.sex === 'F' ? 'border-l-pink-400 bg-pink-50' : 'border-l-blue-400 bg-blue-50'} hover:shadow-md transition`}>
                        <p className="font-semibold">{spouse.name_full}</p>
                        <p className="text-sm text-gray-500">
                          {family.marriage_place && `Married in ${family.marriage_place}`}
                          {family.marriage_year && ` (${family.marriage_year})`}
                        </p>
                      </div>
                    </Link>
                  </div>
                )}
                {children.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Children ({children.length})</p>
                    <div className="grid md:grid-cols-2 gap-2">
                      {children.map(childId => {
                        const child = peopleMap.get(childId);
                        if (!child) return null;
                        return (
                          <Link key={childId} href={`/person/${childId}`}>
                            <div className={`p-3 rounded border-l-4 ${child.sex === 'F' ? 'border-l-pink-300 bg-pink-50/50' : 'border-l-blue-300 bg-blue-50/50'} hover:shadow-sm transition text-sm`}>
                              {child.name_full} {child.birth_year ? `(b. ${child.birth_year})` : ''}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Occupations */}
            {occupations.length > 0 && (
              <div className="card p-6 mb-6">
                <h3 className="section-title">💼 Occupations</h3>
                <div className="space-y-2">
                  {occupations.map((occ) => (
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
            {residences.length > 0 && (
              <div className="card p-6 mb-6">
                <h3 className="section-title">🏠 Residences</h3>
                <div className="space-y-2">
                  {residences.map((res) => (
                    <div key={res.id} className="flex items-start gap-2 text-sm">
                      <span className="text-gray-500">{res.residence_date || res.residence_year || ''}</span>
                      <span className="text-gray-800">{res.residence_place || 'Unknown location'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Life Events */}
            {events.length > 0 && (
              <div className="card p-6 mb-6">
                <h3 className="section-title">📅 Life Events</h3>
                <div className="space-y-2">
                  {events.map((evt) => (
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
            {facts.filter(f => f.fact_type === 'coat_of_arms').length > 0 && (
              <div className="card p-6 mb-6 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300">
                <h3 className="section-title">🛡️ Coat of Arms</h3>
                <div className="flex flex-wrap gap-4 justify-center">
                  {facts.filter(f => f.fact_type === 'coat_of_arms').map((fact) => (
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
            {facts.filter(f => f.fact_type !== 'coat_of_arms').length > 0 && (
              <div className="card p-6 mb-6">
                <h3 className="section-title">📋 Additional Information</h3>
                <div className="space-y-2">
                  {facts.filter(f => f.fact_type !== 'coat_of_arms').map((fact) => (
                    <div key={fact.id} className="text-sm">
                      <span className="text-gray-600 font-medium">{fact.fact_type || 'Fact'}:</span>{' '}
                      <span className="text-gray-800">{fact.fact_value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notable Relatives */}
            {notableRelatives.length > 0 && (
              <div className="card p-6 mb-6 border-2 border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50">
                <h3 className="section-title">👑 Notable Relatives</h3>
                <p className="text-sm text-gray-600 mb-4">Famous or historically significant people connected to this person through family lines.</p>
                <div className="space-y-4">
                  {notableRelatives.map((nr) => (
                    <Link key={nr.person.id} href={`/person/${nr.person.id}`}>
                      <div className="p-4 rounded-lg bg-white border-l-4 border-l-yellow-500 hover:shadow-md transition">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">👑</span>
                          <div>
                            <p className="font-semibold text-gray-800">{nr.person.name_full}</p>
                            <p className="text-sm text-gray-500">
                              {nr.person.birth_year || '?'} – {nr.person.death_year || (nr.person.living ? 'Living' : '?')}
                              {nr.person.birth_place && ` • ${nr.person.birth_place}`}
                            </p>
                            <p className="text-xs text-amber-700 mt-1">{nr.relationship}</p>
                            {nr.person.description && (
                              <p className="text-xs text-gray-600 mt-2 italic">{nr.person.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <Link href="/people" className="inline-block tree-btn">
              ← Back to People
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    </>
  );
}

