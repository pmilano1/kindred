'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { ADD_SOURCE, UPDATE_SOURCE, DELETE_SOURCE, GET_PERSON } from '@/lib/graphql/queries';
import { Source, SourceType, SourceAction, SourceConfidence } from '@/lib/types';

const SOURCE_TYPES: SourceType[] = ['FamilySearch', 'Geni', 'Ancestry', 'MyHeritage', 'FindAGrave', 'ANOM', 'Geneanet', 'WikiTree', 'Newspapers', 'Census', 'VitalRecords', 'ChurchRecords', 'Immigration', 'Military', 'DNA', 'FamilyBible', 'Interview', 'Other'];
const SOURCE_ACTIONS: SourceAction[] = ['searched', 'found', 'verified', 'rejected', 'corrected', 'todo', 'note', 'question', 'brick_wall'];
const CONFIDENCE_LEVELS: SourceConfidence[] = ['confirmed', 'probable', 'possible', 'uncertain', 'conflicting', 'speculative'];

interface Props {
  personId: string;
  sources: Source[];
  canEdit: boolean;
}

export default function SourcesEditor({ personId, sources, canEdit }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    source_type: '' as string,
    source_name: '',
    source_url: '',
    action: 'found' as SourceAction,
    content: '',
    confidence: '' as string,
  });

  const [addSource] = useMutation(ADD_SOURCE, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });
  const [updateSource] = useMutation(UPDATE_SOURCE, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });
  const [deleteSource] = useMutation(DELETE_SOURCE, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: personId } }],
  });

  const resetForm = () => {
    setFormData({ source_type: '', source_name: '', source_url: '', action: 'found', content: '', confidence: '' });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    await addSource({
      variables: {
        personId,
        input: {
          source_type: formData.source_type || null,
          source_name: formData.source_name || null,
          source_url: formData.source_url || null,
          action: formData.action,
          content: formData.content || null,
          confidence: formData.confidence || null,
        },
      },
    });
    resetForm();
  };

  const handleUpdate = async (id: string) => {
    await updateSource({
      variables: {
        id,
        input: {
          source_type: formData.source_type || null,
          source_name: formData.source_name || null,
          source_url: formData.source_url || null,
          action: formData.action,
          content: formData.content || null,
          confidence: formData.confidence || null,
        },
      },
    });
    resetForm();
  };

  const startEdit = (source: Source) => {
    setEditingId(source.id);
    setFormData({
      source_type: source.source_type || '',
      source_name: source.source_name || '',
      source_url: source.source_url || '',
      action: source.action,
      content: source.content || '',
      confidence: source.confidence || '',
    });
  };

  const getActionColor = (action: SourceAction) => {
    const colors: Record<SourceAction, string> = {
      found: 'bg-green-100 text-green-800',
      verified: 'bg-blue-100 text-blue-800',
      searched: 'bg-gray-100 text-gray-800',
      todo: 'bg-yellow-100 text-yellow-800',
      note: 'bg-purple-100 text-purple-800',
      question: 'bg-orange-100 text-orange-800',
      brick_wall: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
      corrected: 'bg-teal-100 text-teal-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const renderForm = (isEdit: boolean, sourceId?: string) => (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
      <div className="grid grid-cols-2 gap-3">
        <select value={formData.source_type} onChange={e => setFormData({ ...formData, source_type: e.target.value })}
          className="p-2 border rounded">
          <option value="">Source Type</option>
          {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={formData.action} onChange={e => setFormData({ ...formData, action: e.target.value as SourceAction })}
          className="p-2 border rounded">
          {SOURCE_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <input type="text" placeholder="Source Name" value={formData.source_name}
        onChange={e => setFormData({ ...formData, source_name: e.target.value })}
        className="w-full p-2 border rounded" />
      <input type="url" placeholder="Source URL" value={formData.source_url}
        onChange={e => setFormData({ ...formData, source_url: e.target.value })}
        className="w-full p-2 border rounded" />
      <textarea placeholder="Notes / Content" value={formData.content}
        onChange={e => setFormData({ ...formData, content: e.target.value })}
        className="w-full p-2 border rounded" rows={3} />
      <select value={formData.confidence} onChange={e => setFormData({ ...formData, confidence: e.target.value })}
        className="w-full p-2 border rounded">
        <option value="">Confidence Level</option>
        {CONFIDENCE_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <div className="flex gap-2">
        <button onClick={() => isEdit && sourceId ? handleUpdate(sourceId) : handleAdd()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {isEdit ? 'Update' : 'Add Source'}
        </button>
        <button onClick={resetForm} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-title">Sources & Research ({sources.length})</h3>
        {canEdit && !showAddForm && !editingId && (
          <button onClick={() => setShowAddForm(true)} className="text-sm text-blue-600 hover:underline">+ Add Source</button>
        )}
      </div>

      {showAddForm && renderForm(false)}

      <div className="space-y-3">
        {sources.map(source => (
          <div key={source.id} className="group">
            {editingId === source.id ? (
              renderForm(true, source.id)
            ) : (
              <div className="p-4 border rounded-lg hover:shadow-sm transition">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(source.action)}`}>
                        {source.action}
                      </span>
                      {source.source_type && (
                        <span className="text-sm text-gray-600">{source.source_type}</span>
                      )}
                      {source.confidence && (
                        <span className="text-xs text-gray-400">({source.confidence})</span>
                      )}
                    </div>
                    {source.source_name && (
                      <p className="font-medium">{source.source_name}</p>
                    )}
                    {source.source_url && (
                      <a href={source.source_url} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all">
                        {source.source_url}
                      </a>
                    )}
                    {source.content && (
                      <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{source.content}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Added {new Date(source.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => startEdit(source)} className="text-sm text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => deleteSource({ variables: { id: source.id } })}
                        className="text-sm text-red-600 hover:underline">Delete</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {sources.length === 0 && !showAddForm && (
        <p className="text-gray-500 text-center py-4">No sources recorded yet</p>
      )}
    </div>
  );
}
