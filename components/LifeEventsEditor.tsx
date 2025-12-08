'use client';

import { useMutation } from '@apollo/client/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
} from '@/components/ui';
import {
  ADD_LIFE_EVENT,
  DELETE_LIFE_EVENT,
  GET_PERSON,
  UPDATE_LIFE_EVENT,
} from '@/lib/graphql/queries';
import type { LifeEvent } from '@/lib/types';

interface Props {
  personId: string;
  lifeEvents: LifeEvent[];
  canEdit: boolean;
}

const EVENT_TYPES = [
  'residence',
  'occupation',
  'education',
  'military',
  'immigration',
  'emigration',
  'census',
  'other',
];

export default function LifeEventsEditor({
  personId,
  lifeEvents,
  canEdit,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    event_type: 'residence',
    event_date: '',
    event_year: '',
    event_place: '',
    event_value: '',
  });

  const refetchQueries = [{ query: GET_PERSON, variables: { id: personId } }];
  const [addEvent, { loading: adding }] = useMutation(ADD_LIFE_EVENT, {
    refetchQueries,
  });
  const [updateEvent, { loading: updating }] = useMutation(UPDATE_LIFE_EVENT, {
    refetchQueries,
  });
  const [deleteEvent] = useMutation(DELETE_LIFE_EVENT, { refetchQueries });

  const resetForm = () => {
    setFormData({
      event_type: 'residence',
      event_date: '',
      event_year: '',
      event_place: '',
      event_value: '',
    });
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
      event_year: formData.event_year
        ? parseInt(formData.event_year, 10)
        : null,
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
    const icons: Record<string, string> = {
      residence: '🏠',
      occupation: '💼',
      education: '🎓',
      military: '🎖️',
      immigration: '🚢',
      emigration: '✈️',
      census: '📊',
    };
    return icons[type] || '📌';
  };

  return (
    <div className="card p-6 h-fit">
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-title">📅 Life Events</h3>
        {canEdit && !showForm && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowForm(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Event
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 p-4 bg-muted rounded-lg space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1">Event Type</Label>
              <Select
                value={formData.event_type}
                onValueChange={(v) =>
                  setFormData((p) => ({ ...p, event_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1">Year</Label>
              <Input
                type="number"
                value={formData.event_year}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, event_year: e.target.value }))
                }
                placeholder="1920"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1">Date (optional)</Label>
            <Input
              type="text"
              value={formData.event_date}
              onChange={(e) =>
                setFormData((p) => ({ ...p, event_date: e.target.value }))
              }
              placeholder="15 Mar 1920"
            />
          </div>
          <div>
            <Label className="mb-1">Place</Label>
            <Input
              type="text"
              value={formData.event_place}
              onChange={(e) =>
                setFormData((p) => ({ ...p, event_place: e.target.value }))
              }
              placeholder="City, State, Country"
            />
          </div>
          <div>
            <Label className="mb-1">Details</Label>
            <Input
              type="text"
              value={formData.event_value}
              onChange={(e) =>
                setFormData((p) => ({ ...p, event_value: e.target.value }))
              }
              placeholder="e.g., Farmer, Harvard University"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={adding || updating}>
              {editingId ? 'Update' : 'Add'}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {lifeEvents.length === 0 && !showForm ? (
        <p className="text-gray-500 text-sm">No life events recorded.</p>
      ) : (
        <div className="space-y-2">
          {lifeEvents.map((evt) => (
            <div
              key={evt.id}
              className="flex items-start justify-between gap-2 text-sm group"
            >
              <div className="flex items-start gap-2">
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 capitalize">
                  {getIcon(evt.event_type)} {evt.event_type}
                </span>
                {(evt.event_date || evt.event_year) && (
                  <span className="text-gray-500">
                    {evt.event_date || evt.event_year}
                  </span>
                )}
                {evt.event_place && (
                  <span className="text-gray-700">{evt.event_place}</span>
                )}
                {evt.event_value && (
                  <span className="text-gray-600 italic">
                    {evt.event_value}
                  </span>
                )}
              </div>
              {canEdit && (
                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEdit(evt)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => handleDelete(evt.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
