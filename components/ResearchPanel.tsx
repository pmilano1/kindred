'use client';

import { useMutation, useQuery } from '@apollo/client/react';
import { Plus, Save, X } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import {
  ADD_SOURCE,
  GET_PERSON_SOURCES,
  UPDATE_RESEARCH_PRIORITY,
  UPDATE_RESEARCH_STATUS,
} from '@/lib/graphql/queries';
import type {
  ResearchActionType,
  ResearchConfidence,
  ResearchSource,
  ResearchStatus,
  Source,
} from '@/lib/types';

interface ResearchPanelProps {
  personId: string;
  personName?: string; // Optional - not used but callers may pass it
  compact?: boolean;
}

const ACTION_TYPES: {
  value: ResearchActionType;
  label: string;
  emoji: string;
}[] = [
  { value: 'searched', label: 'Searched', emoji: '🔍' },
  { value: 'found', label: 'Found', emoji: '✨' },
  { value: 'verified', label: 'Verified', emoji: '✅' },
  { value: 'corrected', label: 'Corrected', emoji: '📝' },
  { value: 'todo', label: 'To Do', emoji: '📋' },
  { value: 'note', label: 'Note', emoji: '💭' },
  { value: 'question', label: 'Question', emoji: '❓' },
  { value: 'brick_wall', label: 'Brick Wall', emoji: '🧱' },
];

const SOURCES: { value: ResearchSource; label: string }[] = [
  { value: 'FamilySearch', label: 'FamilySearch' },
  { value: 'Geni', label: 'Geni' },
  { value: 'Ancestry', label: 'Ancestry' },
  { value: 'MyHeritage', label: 'MyHeritage' },
  { value: 'FindAGrave', label: 'Find A Grave' },
  { value: 'ANOM', label: 'ANOM (French Colonial)' },
  { value: 'Geneanet', label: 'Geneanet' },
  { value: 'WikiTree', label: 'WikiTree' },
  { value: 'Newspapers', label: 'Newspapers' },
  { value: 'Census', label: 'Census' },
  { value: 'VitalRecords', label: 'Vital Records' },
  { value: 'ChurchRecords', label: 'Church Records' },
  { value: 'Immigration', label: 'Immigration' },
  { value: 'Military', label: 'Military' },
  { value: 'DNA', label: 'DNA' },
  { value: 'FamilyBible', label: 'Family Bible' },
  { value: 'Interview', label: 'Interview' },
  { value: 'Other', label: 'Other' },
];

const CONFIDENCE: {
  value: ResearchConfidence;
  label: string;
  color: string;
}[] = [
  {
    value: 'confirmed',
    label: 'Confirmed',
    color: 'bg-green-100 text-green-800',
  },
  { value: 'probable', label: 'Probable', color: 'bg-blue-100 text-blue-800' },
  {
    value: 'possible',
    label: 'Possible',
    color: 'bg-yellow-100 text-yellow-800',
  },
  {
    value: 'uncertain',
    label: 'Uncertain',
    color: 'bg-orange-100 text-orange-800',
  },
  {
    value: 'conflicting',
    label: 'Conflicting',
    color: 'bg-red-100 text-red-800',
  },
  {
    value: 'speculative',
    label: 'Speculative',
    color: 'bg-gray-100 text-gray-800',
  },
];

const STATUS_OPTIONS: {
  value: ResearchStatus;
  label: string;
  color: string;
  desc: string;
}[] = [
  {
    value: 'not_started',
    label: 'Not Started',
    color: 'bg-gray-200',
    desc: 'No research done yet',
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    color: 'bg-blue-200',
    desc: 'Currently being researched',
  },
  {
    value: 'partial',
    label: 'Partial',
    color: 'bg-yellow-200',
    desc: 'Some info found, more needed',
  },
  {
    value: 'verified',
    label: 'Verified',
    color: 'bg-green-200',
    desc: 'Research complete, sources confirmed',
  },
  {
    value: 'needs_review',
    label: 'Needs Review',
    color: 'bg-orange-200',
    desc: 'Conflicting info, needs verification',
  },
  {
    value: 'brick_wall',
    label: 'Brick Wall',
    color: 'bg-red-200',
    desc: 'Cannot find more info',
  },
];

export default function ResearchPanel({
  personId,
  compact = false,
}: ResearchPanelProps) {
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [actionType, setActionType] = useState<ResearchActionType>('note');
  const [content, setContent] = useState('');
  const [sourceChecked, setSourceChecked] = useState<ResearchSource | ''>('');
  const [confidenceField, setConfidenceField] = useState<
    ResearchConfidence | ''
  >('');
  const [externalUrl, setExternalUrl] = useState('');

  // GraphQL query response type
  interface PersonSourcesData {
    person: {
      id: string;
      name_full: string;
      research_status: ResearchStatus;
      research_priority: number;
      sources: Source[];
    } | null;
  }

  // GraphQL query
  const { data, loading, refetch } = useQuery<PersonSourcesData>(
    GET_PERSON_SOURCES,
    {
      variables: { id: personId },
      skip: !personId,
    },
  );

  // GraphQL mutations
  const [addSource, { loading: submitting }] = useMutation(ADD_SOURCE, {
    onCompleted: () => {
      setContent('');
      setSourceChecked('');
      setConfidenceField('');
      setExternalUrl('');
      setShowForm(false);
      refetch();
    },
  });

  const [updateStatus] = useMutation(UPDATE_RESEARCH_STATUS);
  const [updatePriority] = useMutation(UPDATE_RESEARCH_PRIORITY);

  // Extract data from query
  const log: Source[] = data?.person?.sources || [];
  const status: ResearchStatus = data?.person?.research_status || 'not_started';
  const priority: number = data?.person?.research_priority || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    await addSource({
      variables: {
        personId,
        input: {
          action_type: actionType,
          content,
          source_checked: sourceChecked || undefined,
          external_url: externalUrl || undefined,
          confidence: confidenceField || undefined,
        },
      },
    });
  };

  const handleStatusChange = async (newStatus: ResearchStatus) => {
    await updateStatus({
      variables: { personId, status: newStatus },
      optimisticResponse: {
        updateResearchStatus: {
          __typename: 'Person',
          id: personId,
          research_status: newStatus,
        },
      },
    });
  };

  const handlePriorityChange = async (newPriority: number) => {
    await updatePriority({
      variables: { personId, priority: newPriority },
      optimisticResponse: {
        updateResearchPriority: {
          __typename: 'Person',
          id: personId,
          research_priority: newPriority,
        },
      },
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading)
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} text-gray-500 text-sm`}>
        Loading...
      </div>
    );

  return (
    <div className={compact ? '' : 'card p-4 mb-6'}>
      {!compact && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">📚 Research Notes</h3>
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? 'ghost' : 'secondary'}
            size="sm"
            icon={
              showForm ? (
                <X className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )
            }
          >
            {showForm ? 'Cancel' : 'Add Note'}
          </Button>
        </div>
      )}
      {compact && (
        <div className="flex justify-end mb-2">
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? 'ghost' : 'secondary'}
            size="sm"
            icon={
              showForm ? (
                <X className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )
            }
          >
            {showForm ? 'Cancel' : 'Add'}
          </Button>
        </div>
      )}

      {/* Status and Priority Controls */}
      <div className="flex flex-wrap gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex-1 min-w-[200px] space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Status:</Label>
            <span
              className="text-gray-400 cursor-help text-xs"
              title="Tracks research progress for this person"
            >
              ⓘ
            </span>
          </div>
          <Select
            value={status}
            onValueChange={(v) => handleStatusChange(v as ResearchStatus)}
          >
            <SelectTrigger className="w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-[10px] text-gray-400">
            {STATUS_OPTIONS.find((s) => s.value === status)?.desc}
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Priority:</span>
            <span
              className="text-gray-400 cursor-help text-xs"
              title="0 = No urgency, 10 = Research immediately. Higher priority people appear first in research queue."
            >
              ⓘ
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range"
              min="0"
              max="10"
              value={priority}
              onChange={(e) =>
                handlePriorityChange(parseInt(e.target.value, 10))
              }
              className="flex-1"
            />
            <span className="text-sm font-bold w-6">{priority}</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {priority === 0
              ? 'Not prioritized'
              : priority <= 3
                ? 'Low priority'
                : priority <= 6
                  ? 'Medium priority'
                  : priority <= 9
                    ? 'High priority'
                    : 'Urgent - research immediately'}
          </div>
        </div>
      </div>

      {/* Add Note Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200"
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={actionType}
                onValueChange={(v) => setActionType(v as ResearchActionType)}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Source</Label>
              <Select
                value={sourceChecked}
                onValueChange={(v) => setSourceChecked(v as ResearchSource)}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="-- Select --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- Select --</SelectItem>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mb-3 space-y-1">
            <Label className="text-xs">Note</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What did you find or learn?"
              className="text-sm"
              rows={3}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <Label className="text-xs">Confidence</Label>
              <Select
                value={confidenceField}
                onValueChange={(v) =>
                  setConfidenceField(v as ResearchConfidence)
                }
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="-- Select --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- Select --</SelectItem>
                  {CONFIDENCE.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL (optional)</Label>
              <Input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://..."
                className="text-sm"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={submitting || !content.trim()}
            loading={submitting}
            icon={<Save className="w-4 h-4" />}
            className="w-full"
          >
            Save Note
          </Button>
        </form>
      )}

      {/* Research Log Timeline */}
      {log.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No research notes yet.</p>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {log.map((entry) => {
            const actionInfo = ACTION_TYPES.find(
              (t) => t.value === entry.action,
            );
            const confInfo = CONFIDENCE.find(
              (c) => c.value === entry.confidence,
            );
            const isCitation = entry.action === 'found' && entry.source_name;
            return (
              <div
                key={entry.id}
                className={`p-3 rounded border ${isCitation ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm">
                    {actionInfo?.emoji} {actionInfo?.label}
                    {entry.source_type && (
                      <span className="text-gray-500 ml-2">
                        @ {entry.source_type}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
                {/* Show source name prominently for citations */}
                {entry.source_name && (
                  <div className="text-sm font-medium text-blue-800 mb-1">
                    {entry.source_name}
                  </div>
                )}
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {entry.content}
                </p>
                {(entry.confidence || entry.source_url) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {confInfo && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${confInfo.color}`}
                      >
                        {confInfo.label}
                      </span>
                    )}
                    {entry.source_url && (
                      <a
                        href={entry.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        🔗 View Source
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
