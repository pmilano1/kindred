'use client';

import { useMutation, useQuery } from '@apollo/client/react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import {
  GET_RESEARCH_QUEUE,
  UPDATE_RESEARCH_PRIORITY,
  UPDATE_RESEARCH_STATUS,
} from '@/lib/graphql/queries';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'bg-gray-200 text-gray-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  partial: { label: 'Partial', color: 'bg-yellow-100 text-yellow-800' },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-800' },
  needs_review: {
    label: 'Needs Review',
    color: 'bg-orange-100 text-orange-800',
  },
  brick_wall: { label: 'Brick Wall', color: 'bg-red-100 text-red-800' },
};

interface ResearchPerson {
  id: string;
  name_full: string;
  birth_year: number | null;
  death_year: number | null;
  research_status: string | null;
  research_priority: number | null;
  research_notes_count?: number;
  last_researched?: string | null;
}

export default function ResearchQueueClient() {
  const { data, loading, error } = useQuery<{
    researchQueue: ResearchPerson[];
  }>(GET_RESEARCH_QUEUE, {
    variables: { limit: 100 },
  });
  const [updatePriority] = useMutation(UPDATE_RESEARCH_PRIORITY);
  const [updateStatus] = useMutation(UPDATE_RESEARCH_STATUS);

  const queue = data?.researchQueue || [];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card p-6 text-center text-gray-500">
          Loading research queue...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card p-6 text-center text-red-500">
          Error loading research queue: {error.message}
        </div>
      </div>
    );
  }

  const handlePriorityChange = async (personId: string, priority: number) => {
    await updatePriority({
      variables: { personId, priority },
      refetchQueries: [
        { query: GET_RESEARCH_QUEUE, variables: { limit: 100 } },
      ],
    });
  };

  const handleStatusChange = async (personId: string, status: string) => {
    await updateStatus({
      variables: { personId, status },
      refetchQueries: [
        { query: GET_RESEARCH_QUEUE, variables: { limit: 100 } },
      ],
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">📋 Research Priority List</h2>
          <p className="text-sm text-gray-500">
            {queue.length} people in queue
          </p>
        </div>

        {queue.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No people in the research queue yet. Set priority on people in the
            tree view to add them here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 px-3 text-sm font-semibold w-48">
                    Priority
                  </th>
                  <th className="py-2 px-3 text-sm font-semibold">Name</th>
                  <th className="py-2 px-3 text-sm font-semibold">Years</th>
                  <th className="py-2 px-3 text-sm font-semibold">Status</th>
                  <th className="py-2 px-3 text-sm font-semibold">
                    Last Researched
                  </th>
                </tr>
              </thead>
              <tbody>
                {queue.map((person) => {
                  const statusInfo =
                    STATUS_LABELS[person.research_status || 'not_started'] ||
                    STATUS_LABELS.not_started;
                  const years =
                    person.birth_year || person.death_year
                      ? `${person.birth_year || '?'} – ${person.death_year || '?'}`
                      : 'Unknown';
                  const priority = person.research_priority || 0;
                  return (
                    <tr key={person.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block w-8 h-8 rounded-full text-center leading-8 font-bold text-white ${
                              priority >= 7
                                ? 'bg-red-500'
                                : priority >= 4
                                  ? 'bg-orange-500'
                                  : 'bg-blue-500'
                            }`}
                          >
                            {priority}
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={priority}
                            onChange={(e) =>
                              handlePriorityChange(
                                person.id,
                                parseInt(e.target.value),
                              )
                            }
                            className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Link
                          href={`/person/${person.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {person.name_full}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-600">
                        {years}
                      </td>
                      <td className="py-3 px-3">
                        <Select
                          value={person.research_status || 'not_started'}
                          onValueChange={(v) =>
                            handleStatusChange(person.id, v)
                          }
                        >
                          <SelectTrigger
                            className={`px-2 py-1 text-xs rounded-full border-0 cursor-pointer h-auto ${statusInfo.color}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(
                              ([key, info]) => (
                                <SelectItem key={key} value={key}>
                                  {info.label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-500">
                        {person.last_researched
                          ? new Date(
                              person.last_researched,
                            ).toLocaleDateString()
                          : 'Never'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card p-4 mt-6">
        <h3 className="font-semibold mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-red-500"></span>
            <span>High Priority (7-10)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-orange-500"></span>
            <span>Medium Priority (4-6)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-blue-500"></span>
            <span>Low Priority (1-3)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
