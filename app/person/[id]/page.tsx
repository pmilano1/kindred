import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import { getPerson, getPersonFamilies, getChildren, getPeople } from '@/lib/db';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;
  const person = await getPerson(id);
  
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
                  <h3 className="font-semibold text-gray-700 mb-2">Birth</h3>
                  <p className="text-gray-600">
                    {person.birth_date || person.birth_year || 'Unknown'}
                    {person.birth_place && <><br /><span className="text-sm">{person.birth_place}</span></>}
                  </p>
                </div>
                {!person.living && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Death</h3>
                    <p className="text-gray-600">
                      {person.death_date || person.death_year || 'Unknown'}
                      {person.death_place && <><br /><span className="text-sm">{person.death_place}</span></>}
                    </p>
                  </div>
                )}
                {person.burial_place && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Burial</h3>
                    <p className="text-gray-600">{person.burial_place}</p>
                  </div>
                )}
              </div>
            </div>

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

