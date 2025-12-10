'use client';

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { ArrowRight, Users } from 'lucide-react';
import { useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button, PageHeader } from '@/components/ui';
import {
  type Person as CalcPerson,
  calculateRelationship,
} from '@/lib/relationshipCalculator';

// Custom query that includes relationship fields
const GET_PEOPLE_WITH_RELATIONSHIPS = gql`
  query GetPeopleWithRelationships {
    peopleList(limit: 10000) {
      id
      name_full
      birth_year
      parents {
        id
      }
      children {
        id
      }
      spouses {
        id
      }
    }
  }
`;

interface PersonWithRelationships {
  id: string;
  name_full: string;
  birth_year: number | null;
  parents: { id: string }[];
  children: { id: string }[];
  spouses: { id: string }[];
}

export default function RelationshipCalculatorPage() {
  const [personAId, setPersonAId] = useState<string>('');
  const [personBId, setPersonBId] = useState<string>('');
  const [result, setResult] = useState<ReturnType<
    typeof calculateRelationship
  > | null>(null);

  const { data, loading } = useQuery<{
    peopleList: PersonWithRelationships[];
  }>(GET_PEOPLE_WITH_RELATIONSHIPS);

  const people = data?.peopleList || [];

  const handleCalculate = () => {
    if (!personAId || !personBId || !data) return;

    // Build person map with relationships
    const personMap = new Map<string, CalcPerson>();

    // First pass: create all person objects
    for (const p of people) {
      personMap.set(p.id, {
        id: p.id,
        name_full: p.name_full,
        parents: p.parents,
        children: p.children,
        spouses: p.spouses,
      });
    }

    const personA = personMap.get(personAId);
    const personB = personMap.get(personBId);

    if (!personA || !personB) return;

    const relationship = calculateRelationship(personA, personB, personMap);
    setResult(relationship);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PageHeader
        title="Relationship Calculator"
        subtitle="Find out how two people are related"
        icon="GitBranch"
      />

      <div className="card mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Person A Selector */}
          <div>
            <label htmlFor="personA" className="block text-sm font-medium mb-2">
              Person A
            </label>
            <select
              id="personA"
              value={personAId}
              onChange={(e) => setPersonAId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select a person...</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_full}
                  {p.birth_year && ` (b. ${p.birth_year})`}
                </option>
              ))}
            </select>
          </div>

          {/* Person B Selector */}
          <div>
            <label htmlFor="personB" className="block text-sm font-medium mb-2">
              Person B
            </label>
            <select
              id="personB"
              value={personBId}
              onChange={(e) => setPersonBId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select a person...</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_full}
                  {p.birth_year && ` (b. ${p.birth_year})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6">
          <Button
            onClick={handleCalculate}
            disabled={!personAId || !personBId}
            icon={<Users className="w-4 h-4" />}
            className="w-full md:w-auto"
          >
            Calculate Relationship
          </Button>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className="card mt-6">
          <h2 className="text-xl font-semibold mb-4">Result</h2>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-3 text-lg">
              <span className="font-medium">{result.personA.name_full}</span>
              <ArrowRight className="w-5 h-5 text-gray-400" />
              <span className="font-medium">{result.personB.name_full}</span>
            </div>
            <div className="text-center mt-2">
              <span className="text-2xl font-bold text-green-700">
                {result.relationship}
              </span>
            </div>
          </div>

          {/* Path Visualization */}
          {result.path.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Connection Path:
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="font-medium">
                    {result.personA.name_full}
                  </span>
                </div>
                {result.path.map((step) => (
                  <div
                    key={step.person.id}
                    className="ml-6 flex items-center gap-2 text-sm"
                  >
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{step.relationship}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span>{step.person.name_full}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
