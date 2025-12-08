'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { CREATE_PERSON, GET_PEOPLE_LIST } from '@/lib/graphql/queries';
import { useSession } from 'next-auth/react';
import { Button, Input, Label, Textarea, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { X } from 'lucide-react';

interface CreatePersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (personId: string) => void;
}

export default function CreatePersonModal({ isOpen, onClose, onSuccess }: CreatePersonModalProps) {
  const { data: session } = useSession();
  const canEdit = session?.user?.role === 'admin' || session?.user?.role === 'editor';
  
  const [formData, setFormData] = useState({
    name_full: '',
    name_given: '',
    name_surname: '',
    sex: '',
    birth_year: '',
    birth_place: '',
    death_year: '',
    death_place: '',
    living: false,
    description: '',
  });
  
  const [error, setError] = useState('');

  const [createPerson, { loading }] = useMutation<{ createPerson: { id: string } }>(CREATE_PERSON, {
    refetchQueries: [{ query: GET_PEOPLE_LIST, variables: { limit: 10000 } }],
    onCompleted: (data) => {
      onSuccess?.(data.createPerson.id);
      resetForm();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name_full: '',
      name_given: '',
      name_surname: '',
      sex: '',
      birth_year: '',
      birth_place: '',
      death_year: '',
      death_place: '',
      living: false,
      description: '',
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name_full.trim()) {
      setError('Full name is required');
      return;
    }
    
    const input: Record<string, unknown> = {
      name_full: formData.name_full.trim(),
      living: formData.living,
    };
    
    if (formData.name_given) input.name_given = formData.name_given.trim();
    if (formData.name_surname) input.name_surname = formData.name_surname.trim();
    if (formData.sex) input.sex = formData.sex;
    if (formData.birth_year) input.birth_year = parseInt(formData.birth_year, 10);
    if (formData.birth_place) input.birth_place = formData.birth_place.trim();
    if (formData.death_year) input.death_year = parseInt(formData.death_year, 10);
    if (formData.death_place) input.death_place = formData.death_place.trim();
    if (formData.description) input.description = formData.description.trim();
    
    await createPerson({ variables: { input } });
  };

  if (!isOpen) return null;
  if (!canEdit) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--card)] text-[var(--card-foreground)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b border-[var(--border)]">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Add New Person</h2>
            <Button variant="ghost" size="icon" onClick={() => { resetForm(); onClose(); }}><X className="w-5 h-5" /></Button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200">{error}</div>
          )}
          
          {/* Name Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)] pb-2">Name</h3>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input type="text" required value={formData.name_full}
                onChange={(e) => setFormData(prev => ({ ...prev, name_full: e.target.value }))}
                placeholder="John Smith" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Given Name</Label>
                <Input type="text" value={formData.name_given}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_given: e.target.value }))}
                  placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label>Surname</Label>
                <Input type="text" value={formData.name_surname}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_surname: e.target.value }))}
                  placeholder="Smith" />
              </div>
            </div>
          </div>
          
          {/* Demographics */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)] pb-2">Demographics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sex</Label>
                <Select value={formData.sex} onValueChange={(value) => setFormData(prev => ({ ...prev, sex: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unknown" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unknown</SelectItem>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox id="living" checked={formData.living}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, living: checked === true }))} />
                <Label htmlFor="living" className="cursor-pointer">Living</Label>
              </div>
            </div>
          </div>
          
          {/* Birth */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)] pb-2">Birth</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Birth Year</Label>
                <Input type="number" value={formData.birth_year}
                  onChange={(e) => setFormData(prev => ({ ...prev, birth_year: e.target.value }))}
                  placeholder="1900" min={1} max={2100} />
              </div>
              <div className="space-y-2">
                <Label>Birth Place</Label>
                <Input type="text" value={formData.birth_place}
                  onChange={(e) => setFormData(prev => ({ ...prev, birth_place: e.target.value }))}
                  placeholder="City, State, Country" />
              </div>
            </div>
          </div>

          {/* Death (hidden if living) */}
          {!formData.living && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)] pb-2">Death</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Death Year</Label>
                  <Input type="number" value={formData.death_year}
                    onChange={(e) => setFormData(prev => ({ ...prev, death_year: e.target.value }))}
                    placeholder="1980" min={1} max={2100} />
                </div>
                <div className="space-y-2">
                  <Label>Death Place</Label>
                  <Input type="text" value={formData.death_place}
                    onChange={(e) => setFormData(prev => ({ ...prev, death_place: e.target.value }))}
                    placeholder="City, State, Country" />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Description / Notes</Label>
            <Textarea value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="h-24" placeholder="Additional information..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { resetForm(); onClose(); }}>Cancel</Button>
            <Button type="submit" variant="primary" loading={loading}>Create Person</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

