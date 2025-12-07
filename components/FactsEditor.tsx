'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { ADD_FACT, UPDATE_FACT, DELETE_FACT, GET_PERSON } from '@/lib/graphql/queries';
import { Fact } from '@/lib/types';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Props {
  personId: string;
  facts: Fact[];
  canEdit: boolean;
}

const FACT_TYPES = ['education', 'religion', 'nationality', 'ethnicity', 'title', 'nickname', 'physical_description', 'coat_of_arms', 'other'];

export default function FactsEditor({ personId, facts, canEdit }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ fact_type: 'other', fact_value: '' });

  const refetchQueries = [{ query: GET_PERSON, variables: { id: personId } }];
  const [addFact, { loading: adding }] = useMutation(ADD_FACT, { refetchQueries });
  const [updateFact, { loading: updating }] = useMutation(UPDATE_FACT, { refetchQueries });
  const [deleteFact] = useMutation(DELETE_FACT, { refetchQueries });

  // Filter out coat_of_arms facts (handled separately)
  const displayFacts = facts.filter(f => f.fact_type !== 'coat_of_arms');

  const resetForm = () => {
    setFormData({ fact_type: 'other', fact_value: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (fact: Fact) => {
    setFormData({ fact_type: fact.fact_type || 'other', fact_value: fact.fact_value || '' });
    setEditingId(fact.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { fact_type: formData.fact_type, fact_value: formData.fact_value || null };
    if (editingId) {
      await updateFact({ variables: { id: editingId, input } });
    } else {
      await addFact({ variables: { personId, input } });
    }
    resetForm();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this fact?')) {
      await deleteFact({ variables: { id } });
    }
  };

  const getIcon = (type: string | null) => {
    const icons: Record<string, string> = {
      education: '🎓', religion: '✡️', nationality: '🌍', ethnicity: '🧬',
      title: '👑', nickname: '📛', physical_description: '👤', coat_of_arms: '🛡️'
    };
    return icons[type || ''] || '📋';
  };

  return (
    <div className="card p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-title">📋 Additional Information</h3>
        {canEdit && !showForm && (
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)} icon={<Plus className="w-4 h-4" />}>
            Add Fact
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-muted rounded-lg space-y-3">
          <div>
            <Label className="mb-1">Fact Type</Label>
            <Select value={formData.fact_type} onValueChange={v => setFormData(p => ({ ...p, fact_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FACT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1">Value</Label>
            <Input type="text" value={formData.fact_value} onChange={(e) => setFormData(p => ({ ...p, fact_value: e.target.value }))}
              placeholder="Enter value..." required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={adding || updating}>
              {editingId ? 'Update' : 'Add'}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </form>
      )}

      {displayFacts.length === 0 && !showForm ? (
        <p className="text-gray-500 text-sm">No additional facts recorded.</p>
      ) : (
        <div className="space-y-2">
          {displayFacts.map((fact) => (
            <div key={fact.id} className="flex items-center justify-between text-sm group">
              <div>
                <span className="text-gray-600 font-medium">{getIcon(fact.fact_type)} {fact.fact_type?.replace(/_/g, ' ') || 'Fact'}:</span>{' '}
                <span className="text-gray-800">{fact.fact_value}</span>
              </div>
              {canEdit && (
                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(fact)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => handleDelete(fact.id)}>
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

