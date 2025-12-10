'use client';

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import TreeLink from '@/components/TreeLink';
import { Button, Input } from '@/components/ui';
import {
  ADD_CHILD,
  ADD_SPOUSE,
  GET_PERSON,
  REMOVE_CHILD,
  REMOVE_SPOUSE,
  UPDATE_FAMILY,
} from '@/lib/graphql/queries';
import type { Family, Person } from '@/lib/types';

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
  families: FamilyWithDetails[];
  canEdit: boolean;
}

export default function FamilyManagementNew({
  personId,
  families,
  canEdit,
}: Props) {
  const [showAddSpouse, setShowAddSpouse] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingFamily, setEditingFamily] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [spouseFormData, setSpouseFormData] = useState({
    spouse_id: '',
    marriage_date: '',
    marriage_year: '',
    marriage_place: '',
  });
  const [childFormData, setChildFormData] = useState({
    child_id: '',
    other_parent_id: '',
  });
  const [familyFormData, setFamilyFormData] = useState({
    marriage_date: '',
    marriage_year: '',
    marriage_place: '',
  });

  const { data: searchData } = useQuery<SearchResult>(SEARCH_PEOPLE, {
    variables: { query: searchQuery },
    skip: searchQuery.length < 2,
  });

  const [addSpouse] = useMutation(ADD_SPOUSE, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });
  const [addChild] = useMutation(ADD_CHILD, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });
  const [removeSpouse] = useMutation(REMOVE_SPOUSE, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });
  const [removeChild] = useMutation(REMOVE_CHILD, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });
  const [updateFamily] = useMutation(UPDATE_FAMILY, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });

  const handleAddSpouse = async () => {
    if (!spouseFormData.spouse_id) return;
    await addSpouse({
      variables: {
        personId,
        spouseId: spouseFormData.spouse_id,
        marriageDate: spouseFormData.marriage_date || null,
        marriageYear: spouseFormData.marriage_year
          ? parseInt(spouseFormData.marriage_year, 10)
          : null,
        marriagePlace: spouseFormData.marriage_place || null,
      },
    });
    setShowAddSpouse(false);
    setSpouseFormData({
      spouse_id: '',
      marriage_date: '',
      marriage_year: '',
      marriage_place: '',
    });
    setSearchQuery('');
  };

  const handleAddChild = async () => {
    if (!childFormData.child_id) return;
    await addChild({
      variables: {
        personId,
        childId: childFormData.child_id,
        otherParentId: childFormData.other_parent_id || null,
      },
    });
    setShowAddChild(false);
    setChildFormData({ child_id: '', other_parent_id: '' });
    setSearchQuery('');
  };

  const handleUpdateFamily = async (familyId: string) => {
    await updateFamily({
      variables: {
        id: familyId,
        input: {
          marriage_date: familyFormData.marriage_date || null,
          marriage_year: familyFormData.marriage_year
            ? parseInt(familyFormData.marriage_year, 10)
            : null,
          marriage_place: familyFormData.marriage_place || null,
        },
      },
    });
    setEditingFamily(null);
  };

  const searchResults =
    searchData?.search?.edges?.map((e: { node: Person }) => e.node) || [];

  return (
    <div className="space-y-6">
      {/* Header with action buttons */}
      {canEdit && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddSpouse(!showAddSpouse);
              setShowAddChild(false);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Spouse
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddChild(!showAddChild);
              setShowAddSpouse(false);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Child
          </Button>
        </div>
      )}

      {/* Add Spouse Form */}
      {showAddSpouse && (
        <div className="card p-4 bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-400">
          <h4 className="font-semibold mb-3">Add Spouse</h4>
          <div className="space-y-3">
            <div>
              <Input
                type="text"
                placeholder="Search for spouse..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="mt-2 border rounded-md bg-white dark:bg-gray-800 max-h-48 overflow-y-auto">
                  {searchResults.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b last:border-b-0"
                      onClick={() => {
                        setSpouseFormData({
                          ...spouseFormData,
                          spouse_id: person.id,
                        });
                        setSearchQuery(person.name_full || '');
                      }}
                    >
                      <div className="font-medium">{person.name_full}</div>
                      <div className="text-sm text-gray-500">
                        {person.birth_year && `b. ${person.birth_year}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input
              type="text"
              placeholder="Marriage Date (e.g., 1975-06-15)"
              value={spouseFormData.marriage_date}
              onChange={(e) =>
                setSpouseFormData({
                  ...spouseFormData,
                  marriage_date: e.target.value,
                })
              }
            />
            <Input
              type="number"
              placeholder="Marriage Year"
              value={spouseFormData.marriage_year}
              onChange={(e) =>
                setSpouseFormData({
                  ...spouseFormData,
                  marriage_year: e.target.value,
                })
              }
            />
            <Input
              type="text"
              placeholder="Marriage Place"
              value={spouseFormData.marriage_place}
              onChange={(e) =>
                setSpouseFormData({
                  ...spouseFormData,
                  marriage_place: e.target.value,
                })
              }
            />
            <div className="flex gap-2">
              <Button
                onClick={handleAddSpouse}
                disabled={!spouseFormData.spouse_id}
              >
                Add Spouse
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddSpouse(false);
                  setSpouseFormData({
                    spouse_id: '',
                    marriage_date: '',
                    marriage_year: '',
                    marriage_place: '',
                  });
                  setSearchQuery('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Child Form */}
      {showAddChild && (
        <div className="card p-4 bg-green-50 dark:bg-green-950 border-l-4 border-l-green-400">
          <h4 className="font-semibold mb-3">Add Child</h4>
          <div className="space-y-3">
            <div>
              <Input
                type="text"
                placeholder="Search for child..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="mt-2 border rounded-md bg-white dark:bg-gray-800 max-h-48 overflow-y-auto">
                  {searchResults.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b last:border-b-0"
                      onClick={() => {
                        setChildFormData({
                          ...childFormData,
                          child_id: person.id,
                        });
                        setSearchQuery(person.name_full || '');
                      }}
                    >
                      <div className="font-medium">{person.name_full}</div>
                      <div className="text-sm text-gray-500">
                        {person.birth_year && `b. ${person.birth_year}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Optional: Select other parent if known
            </p>
            <select
              className="w-full px-3 py-2 border rounded-md"
              value={childFormData.other_parent_id}
              onChange={(e) =>
                setChildFormData({
                  ...childFormData,
                  other_parent_id: e.target.value,
                })
              }
            >
              <option value="">No other parent</option>
              {families.map((family) => {
                const spouse =
                  family.husband_id === personId ? family.wife : family.husband;
                if (spouse) {
                  return (
                    <option key={spouse.id} value={spouse.id}>
                      {spouse.name_full}
                    </option>
                  );
                }
                return null;
              })}
            </select>
            <div className="flex gap-2">
              <Button
                onClick={handleAddChild}
                disabled={!childFormData.child_id}
              >
                Add Child
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddChild(false);
                  setChildFormData({ child_id: '', other_parent_id: '' });
                  setSearchQuery('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Display Families */}
      {families.map((family) => {
        const spouse =
          family.husband_id === personId ? family.wife : family.husband;
        const isEditing = editingFamily === family.id;

        return (
          <div key={family.id} className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="section-title">
                {spouse ? `Family with ${spouse.name_full}` : 'Family'}
              </h3>
              {canEdit && (
                <div className="flex gap-2">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setEditingFamily(isEditing ? null : family.id);
                      setFamilyFormData({
                        marriage_date: family.marriage_date || '',
                        marriage_year: family.marriage_year?.toString() || '',
                        marriage_place: family.marriage_place || '',
                      });
                    }}
                  >
                    {isEditing ? 'Cancel' : 'Edit Marriage'}
                  </Button>
                </div>
              )}
            </div>

            {/* Spouse */}
            {spouse && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Spouse
                  </p>
                  {canEdit && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (
                          confirm(
                            `Remove ${spouse.name_full} as spouse? This will delete the family if there are no children.`,
                          )
                        ) {
                          removeSpouse({
                            variables: { personId, spouseId: spouse.id },
                          });
                        }
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div
                  className={`p-4 rounded-lg border-l-4 ${spouse.sex === 'F' ? 'border-l-pink-400 bg-pink-50 dark:bg-pink-950' : 'border-l-blue-400 bg-blue-50 dark:bg-blue-950'} flex justify-between items-start`}
                >
                  <Link href={`/person/${spouse.id}`} className="flex-1">
                    <p className="font-semibold">{spouse.name_full}</p>
                    {!isEditing && (
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {family.marriage_place &&
                          `Married in ${family.marriage_place}`}
                        {family.marriage_year && ` (${family.marriage_year})`}
                      </p>
                    )}
                  </Link>
                  <TreeLink personId={spouse.id} />
                </div>
              </div>
            )}

            {/* Edit Marriage Details */}
            {isEditing && (
              <div className="space-y-3 mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
                <Input
                  type="text"
                  placeholder="Marriage Date (e.g., 1975-06-15)"
                  value={familyFormData.marriage_date}
                  onChange={(e) =>
                    setFamilyFormData({
                      ...familyFormData,
                      marriage_date: e.target.value,
                    })
                  }
                />
                <Input
                  type="number"
                  placeholder="Marriage Year"
                  value={familyFormData.marriage_year}
                  onChange={(e) =>
                    setFamilyFormData({
                      ...familyFormData,
                      marriage_year: e.target.value,
                    })
                  }
                />
                <Input
                  type="text"
                  placeholder="Marriage Place"
                  value={familyFormData.marriage_place}
                  onChange={(e) =>
                    setFamilyFormData({
                      ...familyFormData,
                      marriage_place: e.target.value,
                    })
                  }
                />
                <Button onClick={() => handleUpdateFamily(family.id)}>
                  Save Marriage Details
                </Button>
              </div>
            )}

            {/* Children */}
            <div>
              <p className="text-sm text-[var(--muted-foreground)] mb-2">
                Children ({family.children.length})
              </p>
              {family.children.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-2">
                  {family.children.map((child) => (
                    <div
                      key={child.id}
                      className={`p-3 rounded border-l-4 ${child.sex === 'F' ? 'border-l-pink-300 bg-pink-50/50 dark:bg-pink-950/50' : 'border-l-blue-300 bg-blue-50/50 dark:bg-blue-950/50'} flex justify-between items-center`}
                    >
                      <Link href={`/person/${child.id}`} className="flex-1">
                        <div className="text-sm">
                          {child.name_full}{' '}
                          {child.birth_year && `(b. ${child.birth_year})`}
                        </div>
                      </Link>
                      <div className="flex gap-1">
                        <TreeLink personId={child.id} />
                        {canEdit && (
                          <button
                            type="button"
                            className="text-destructive hover:text-destructive/80"
                            onClick={() => {
                              if (
                                confirm(
                                  `Remove ${child.name_full} from this family?`,
                                )
                              ) {
                                removeChild({
                                  variables: { personId, childId: child.id },
                                });
                              }
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No children</p>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty State */}
      {families.length === 0 && !showAddSpouse && !showAddChild && (
        <div className="card p-6 text-center text-gray-500">
          <p className="mb-4">No family relationships recorded</p>
          {canEdit && (
            <p className="text-sm">
              Click "Add Spouse" or "Add Child" above to get started
            </p>
          )}
        </div>
      )}
    </div>
  );
}
