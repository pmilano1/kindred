'use client';

import { useState, useEffect } from 'react';
import { ResearchLog, ResearchActionType, ResearchSource, ResearchConfidence, ResearchStatus } from '@/lib/types';

interface ResearchPanelProps {
  personId: string;
  personName: string;
}

const ACTION_TYPES: { value: ResearchActionType; label: string; emoji: string }[] = [
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

const CONFIDENCE: { value: ResearchConfidence; label: string; color: string }[] = [
  { value: 'confirmed', label: 'Confirmed', color: 'bg-green-100 text-green-800' },
  { value: 'probable', label: 'Probable', color: 'bg-blue-100 text-blue-800' },
  { value: 'possible', label: 'Possible', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'uncertain', label: 'Uncertain', color: 'bg-orange-100 text-orange-800' },
  { value: 'conflicting', label: 'Conflicting', color: 'bg-red-100 text-red-800' },
  { value: 'speculative', label: 'Speculative', color: 'bg-gray-100 text-gray-800' },
];

const STATUS_OPTIONS: { value: ResearchStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: 'bg-gray-200' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-200' },
  { value: 'partial', label: 'Partial', color: 'bg-yellow-200' },
  { value: 'verified', label: 'Verified', color: 'bg-green-200' },
  { value: 'needs_review', label: 'Needs Review', color: 'bg-orange-200' },
  { value: 'brick_wall', label: 'Brick Wall', color: 'bg-red-200' },
];

export default function ResearchPanel({ personId, personName }: ResearchPanelProps) {
  const [log, setLog] = useState<ResearchLog[]>([]);
  const [status, setStatus] = useState<ResearchStatus>('not_started');
  const [priority, setPriority] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [actionType, setActionType] = useState<ResearchActionType>('note');
  const [content, setContent] = useState('');
  const [sourceChecked, setSourceChecked] = useState<ResearchSource | ''>('');
  const [confidence, setConfidence] = useState<ResearchConfidence | ''>('');
  const [externalUrl, setExternalUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchResearchData();
  }, [personId]);

  const fetchResearchData = async () => {
    try {
      const res = await fetch(`/api/research/${personId}`);
      const data = await res.json();
      setLog(data.log || []);
      setStatus(data.status || 'not_started');
      setPriority(data.priority || 0);
    } catch (error) {
      console.error('Failed to fetch research data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await fetch(`/api/research/${personId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType,
          content,
          sourceChecked: sourceChecked || undefined,
          confidence: confidence || undefined,
          externalUrl: externalUrl || undefined,
        }),
      });
      setContent('');
      setSourceChecked('');
      setConfidence('');
      setExternalUrl('');
      setShowForm(false);
      fetchResearchData();
    } catch (error) {
      console.error('Failed to add research note:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: ResearchStatus) => {
    setStatus(newStatus);
    await fetch(`/api/research/${personId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  const handlePriorityChange = async (newPriority: number) => {
    setPriority(newPriority);
    await fetch(`/api/research/${personId}/priority`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: newPriority }),
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) return <div className="p-4 text-gray-500">Loading research data...</div>;

  return (
    <div className="card p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">📚 Research Notes</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="tree-btn text-sm"
        >
          {showForm ? 'Cancel' : '+ Add Note'}
        </button>
      </div>

      {/* Status and Priority Controls */}
      <div className="flex flex-wrap gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as ResearchStatus)}
            className="text-sm rounded border-gray-300 p-1"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Priority:</span>
          <input
            type="range"
            min="0"
            max="10"
            value={priority}
            onChange={(e) => handlePriorityChange(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-sm font-bold w-6">{priority}</span>
        </div>
      </div>

      {/* Add Note Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as ResearchActionType)}
                className="w-full text-sm rounded border-gray-300 p-2"
              >
                {ACTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Source</label>
              <select
                value={sourceChecked}
                onChange={(e) => setSourceChecked(e.target.value as ResearchSource)}
                className="w-full text-sm rounded border-gray-300 p-2"
              >
                <option value="">-- Select --</option>
                {SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1">Note</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What did you find or learn?"
              className="w-full text-sm rounded border-gray-300 p-2"
              rows={3}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1">Confidence</label>
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as ResearchConfidence)}
                className="w-full text-sm rounded border-gray-300 p-2"
              >
                <option value="">-- Select --</option>
                {CONFIDENCE.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">URL (optional)</label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-sm rounded border-gray-300 p-2"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="tree-btn w-full"
          >
            {submitting ? 'Saving...' : 'Save Note'}
          </button>
        </form>
      )}

      {/* Research Log Timeline */}
      {log.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No research notes yet.</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {log.map((entry) => {
            const actionInfo = ACTION_TYPES.find(t => t.value === entry.action_type);
            const confInfo = CONFIDENCE.find(c => c.value === entry.confidence);
            return (
              <div key={entry.id} className="p-3 bg-white rounded border border-gray-200">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm">
                    {actionInfo?.emoji} {actionInfo?.label}
                    {entry.source_checked && <span className="text-gray-500 ml-2">@ {entry.source_checked}</span>}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(entry.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700">{entry.content}</p>
                {(entry.confidence || entry.external_url) && (
                  <div className="flex gap-2 mt-2">
                    {confInfo && (
                      <span className={`text-xs px-2 py-0.5 rounded ${confInfo.color}`}>
                        {confInfo.label}
                      </span>
                    )}
                    {entry.external_url && (
                      <a href={entry.external_url} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-blue-600 hover:underline">
                        🔗 Source
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

