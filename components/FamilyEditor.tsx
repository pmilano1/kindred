'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@apollo/client/react';
import { 
  CREATE_FAMILY, UPDATE_FAMILY, DELETE_FAMILY, 
  ADD_CHILD_TO_FAMILY, REMOVE_CHILD_FROM_FAMILY,
  GET_PERSON
} from '@/lib/graphql/queries';
import TreeLink from '@/components/TreeLink';
import { Person, Family } from '@/lib/types';
import { gql } from '@apollo/client';

const SEARCH_PEOPLE = gql`
  query SearchPeople($query: String!) {
    search(query: $query, first: 10) {
      edges { node { id name_full sex birth_year } }
    }
  }
`;

interface FamilyWithDetails extends Family {
  husband: Person | null;
  wife: Person | null;
  children: Person[];
}

interface SearchResult {
  search: {
    edges: { node: Person }[];
  };
}

interface Props {
  personId: string;
  personSex: string;
  families: FamilyWithDetails[];
  canEdit: boolean;
}

export default function FamilyEditor({ personId, personSex, families, canEdit }: Props) {
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [editingFamily, setEditingFamily] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingChildTo, setAddingChildTo] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    spouse_id: '',
    marriage_date: '',
    marriage_year: '',
    marriage_place: '',
  });

  const { data: searchData } = useQuery<SearchResult>(SEARCH_PEOPLE, {
    variables: { query: searchQuery },
    skip: searchQuery.length < 2,
  });

  const [createFamily] = useMutation(CREATE_FAMILY, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });
  const [updateFamily] = useMutation(UPDATE_FAMILY, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });
  const [deleteFamily] = useMutation(DELETE_FAMILY, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });
  const [addChild] = useMutation(ADD_CHILD_TO_FAMILY, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });
  const [removeChild] = useMutation(REMOVE_CHILD_FROM_FAMILY, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });

  const handleCreateFamily = async () => {
    const input: Record<string, unknown> = {
      marriage_date: formData.marriage_date || null,
      marriage_year: formData.marriage_year ? parseInt(formData.marriage_year) : null,
      marriage_place: formData.marriage_place || null,
    };
    // Set spouse based on current person's sex
    if (personSex === 'M') {
      input.husband_id = personId;
      input.wife_id = formData.spouse_id || null;
    } else {
      input.wife_id = personId;
      input.husband_id = formData.spouse_id || null;
    }
    await createFamily({ variables: { input } });
    setShowAddFamily(false);
    setFormData({ spouse_id: '', marriage_date: '', marriage_year: '', marriage_place: '' });
  };

  const handleUpdateFamily = async (familyId: string) => {
    await updateFamily({
      variables: {
        id: familyId,
        input: {
          marriage_date: formData.marriage_date || null,
          marriage_year: formData.marriage_year ? parseInt(formData.marriage_year) : null,
          marriage_place: formData.marriage_place || null,
        },
      },
    });
    setEditingFamily(null);
  };

  const handleAddChild = async (familyId: string, childId: string) => {
    await addChild({ variables: { familyId, personId: childId } });
    setAddingChildTo(null);
    setSearchQuery('');
  };

  const searchResults = searchData?.search?.edges?.map((e: { node: Person }) => e.node) || [];

  return (
    <div className="space-y-4">
      {families.map((family, i) => {
        const spouse = family.husband_id === personId ? family.wife : family.husband;
        const isEditing = editingFamily === family.id;

        return (
          <div key={family.id} className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="section-title">Family {families.length > 1 ? i + 1 : ''}</h3>
              {canEdit && (
                <div className="flex gap-2">
                  <button onClick={() => {
                    setEditingFamily(isEditing ? null : family.id);
                    setFormData({
                      spouse_id: '',
                      marriage_date: family.marriage_date || '',
                      marriage_year: family.marriage_year?.toString() || '',
                      marriage_place: family.marriage_place || '',
                    });
                  }} className="text-sm text-blue-600 hover:underline">
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                  <button onClick={() => deleteFamily({ variables: { id: family.id } })}
                    className="text-sm text-red-600 hover:underline">Delete</button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3 mb-4">
                <input type="text" placeholder="Marriage Date" value={formData.marriage_date}
                  onChange={e => setFormData({ ...formData, marriage_date: e.target.value })}
                  className="w-full p-2 border rounded" />
                <input type="number" placeholder="Marriage Year" value={formData.marriage_year}
                  onChange={e => setFormData({ ...formData, marriage_year: e.target.value })}
                  className="w-full p-2 border rounded" />
                <input type="text" placeholder="Marriage Place" value={formData.marriage_place}
                  onChange={e => setFormData({ ...formData, marriage_place: e.target.value })}
                  className="w-full p-2 border rounded" />
                <button onClick={() => handleUpdateFamily(family.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
              </div>
            ) : (
              <>
                {spouse && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-2">Spouse</p>
                    <div className={`p-4 rounded-lg border-l-4 ${spouse.sex === 'F' ? 'border-l-pink-400 bg-pink-50' : 'border-l-blue-400 bg-blue-50'} flex justify-between items-start`}>
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

                {/* Children */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-500">Children ({family.children.length})</p>
                    {canEdit && (
                      <button onClick={() => setAddingChildTo(addingChildTo === family.id ? null : family.id)}
                        className="text-sm text-blue-600 hover:underline">
                        {addingChildTo === family.id ? 'Cancel' : '+ Add Child'}
                      </button>
                    )}
                  </div>

                  {addingChildTo === family.id && (
                    <div className="mb-3 p-3 bg-gray-50 rounded">
                      <input type="text" placeholder="Search for person..." value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full p-2 border rounded mb-2" />
                      {searchResults.length > 0 && (
                        <div className="max-h-40 overflow-y-auto border rounded bg-white">
                          {searchResults.map((p: Person) => (
                            <button key={p.id} onClick={() => handleAddChild(family.id, p.id)}
                              className="w-full text-left p-2 hover:bg-gray-100 border-b last:border-b-0">
                              {p.name_full} {p.birth_year ? `(b. ${p.birth_year})` : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {family.children.length > 0 && (
                    <div className="grid md:grid-cols-2 gap-2">
                      {family.children.map(child => (
                        <div key={child.id} className={`p-3 rounded border-l-4 ${child.sex === 'F' ? 'border-l-pink-300 bg-pink-50/50' : 'border-l-blue-300 bg-blue-50/50'} flex justify-between items-center group`}>
                          <Link href={`/person/${child.id}`} className="flex-1">
                            {child.name_full} {child.birth_year ? `(b. ${child.birth_year})` : ''}
                          </Link>
                          <div className="flex items-center gap-2">
                            {canEdit && (
                              <button onClick={() => removeChild({ variables: { familyId: family.id, personId: child.id } })}
                                className="text-red-500 opacity-0 group-hover:opacity-100 text-sm">✕</button>
                            )}
                            <TreeLink personId={child.id} className="text-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Add New Family */}
      {canEdit && (
        <div className="card p-6">
          {showAddFamily ? (
            <div className="space-y-3">
              <h3 className="section-title">Add New Family</h3>
              <div>
                <label className="text-sm text-gray-500">Spouse (optional)</label>
                <input type="text" placeholder="Search for spouse..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full p-2 border rounded" />
                {searchQuery.length >= 2 && searchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded bg-white mt-1">
                    {searchResults.map((p: Person) => (
                      <button key={p.id} onClick={() => {
                        setFormData({ ...formData, spouse_id: p.id });
                        setSearchQuery(p.name_full);
                      }} className="w-full text-left p-2 hover:bg-gray-100 border-b last:border-b-0">
                        {p.name_full} {p.birth_year ? `(b. ${p.birth_year})` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input type="text" placeholder="Marriage Date (e.g., 15 Jun 1920)" value={formData.marriage_date}
                onChange={e => setFormData({ ...formData, marriage_date: e.target.value })}
                className="w-full p-2 border rounded" />
              <input type="number" placeholder="Marriage Year" value={formData.marriage_year}
                onChange={e => setFormData({ ...formData, marriage_year: e.target.value })}
                className="w-full p-2 border rounded" />
              <input type="text" placeholder="Marriage Place" value={formData.marriage_place}
                onChange={e => setFormData({ ...formData, marriage_place: e.target.value })}
                className="w-full p-2 border rounded" />
              <div className="flex gap-2">
                <button onClick={handleCreateFamily}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create Family</button>
                <button onClick={() => { setShowAddFamily(false); setSearchQuery(''); }}
                  className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddFamily(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">
              + Add Family / Spouse
            </button>
          )}
        </div>
      )}
    </div>
  );
}
