'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { ADD_LIFE_EVENT, UPDATE_LIFE_EVENT, DELETE_LIFE_EVENT, GET_PERSON } from '@/lib/graphql/queries';
import { LifeEvent } from '@/lib/types';

interface Props {
  personId: string;
  lifeEvents: LifeEvent[];
  canEdit: boolean;
}

const EVENT_TYPES = ['residence', 'occupation', 'education', 'military', 'immigration', 'emigration', 'census', 'other'];

export default function LifeEventsEditor({ personId, lifeEvents, canEdit }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ event_type: 'residence', event_date: '', event_year: '', event_place: '', event_value: '' });

  const refetchQueries = [{ query: GET_PERSON, variables: { id: personId } }];
  const [addEvent, { loading: adding }] = useMutation(ADD_LIFE_EVENT, { refetchQueries });
  const [updateEvent, { loading: updating }] = useMutation(UPDATE_LIFE_EVENT, { refetchQueries });
  const [deleteEvent] = useMutation(DELETE_LIFE_EVENT, { refetchQueries });

  const resetForm = () => {
    setFormData({ event_type: 'residence', event_date: '', event_year: '', event_place: '', event_value: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (evt: LifeEvent) => {
    setFormData({
      event_type: evt.event_type,
      event_date: evt.event_date || '',
      event_year: evt.event_year?.toString() || '',
      event_place: evt.event_place || '',
      event_value: evt.event_value || '',
    });
    setEditingId(evt.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      event_type: formData.event_type,
      event_date: formData.event_date || null,
      event_year: formData.event_year ? parseInt(formData.event_year, 10) : null,
      event_place: formData.event_place || null,
      event_value: formData.event_value || null,
    };
    if (editingId) {
      await updateEvent({ variables: { id: editingId, input } });
    } else {
      await addEvent({ variables: { personId, input } });
    }
    resetForm();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this life event?')) {
      await deleteEvent({ variables: { id } });
    }
  };

  const getIcon = (type: string) => {
    const icons: Record<string, string> = { residence: '🏠', occupation: '💼', education: '🎓', military: '🎖️', immigration: '🚢', emigration: '✈️', census: '📊' };
    return icons[type] || '📌';
  };

  return (
    <div className="card p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-title">📅 Life Events</h3>
        {canEdit && !showForm && (
          <button onClick={() => setShowForm(true)} className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
            + Add Event
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
              <select value={formData.event_type} onChange={(e) => setFormData(p => ({ ...p, event_type: e.target.value }))}
                className="w-full border rounded px-3 py-2">
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input type="number" value={formData.event_year} onChange={(e) => setFormData(p => ({ ...p, event_year: e.target.value }))}
                className="w-full border rounded px-3 py-2" placeholder="1920" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date (optional)</label>
            <input type="text" value={formData.event_date} onChange={(e) => setFormData(p => ({ ...p, event_date: e.target.value }))}
              className="w-full border rounded px-3 py-2" placeholder="15 Mar 1920" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Place</label>
            <input type="text" value={formData.event_place} onChange={(e) => setFormData(p => ({ ...p, event_place: e.target.value }))}
              className="w-full border rounded px-3 py-2" placeholder="City, State, Country" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
            <input type="text" value={formData.event_value} onChange={(e) => setFormData(p => ({ ...p, event_value: e.target.value }))}
              className="w-full border rounded px-3 py-2" placeholder="e.g., Farmer, Harvard University" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={adding || updating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {editingId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
          </div>
        </form>
      )}

      {lifeEvents.length === 0 && !showForm ? (
        <p className="text-gray-500 text-sm">No life events recorded.</p>
      ) : (
        <div className="space-y-2">
          {lifeEvents.map((evt) => (
            <div key={evt.id} className="flex items-start justify-between gap-2 text-sm group">
              <div className="flex items-start gap-2">
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 capitalize">
                  {getIcon(evt.event_type)} {evt.event_type}
                </span>
                {(evt.event_date || evt.event_year) && <span className="text-gray-500">{evt.event_date || evt.event_year}</span>}
                {evt.event_place && <span className="text-gray-700">{evt.event_place}</span>}
                {evt.event_value && <span className="text-gray-600 italic">{evt.event_value}</span>}
              </div>
              {canEdit && (
                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                  <button onClick={() => handleEdit(evt)} className="text-blue-600 hover:text-blue-800">✏️</button>
                  <button onClick={() => handleDelete(evt.id)} className="text-red-600 hover:text-red-800">🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

