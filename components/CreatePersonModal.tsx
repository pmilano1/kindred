'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { CREATE_PERSON, GET_PEOPLE_LIST } from '@/lib/graphql/queries';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui';
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Add New Person</h2>
            <Button variant="ghost" size="icon" onClick={() => { resetForm(); onClose(); }}><X className="w-5 h-5" /></Button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200">{error}</div>
          )}
          
          {/* Name Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700 border-b pb-2">Name</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input type="text" required value={formData.name_full}
                onChange={(e) => setFormData(prev => ({ ...prev, name_full: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="John Smith" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Given Name</label>
                <input type="text" value={formData.name_given}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_given: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2" placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
                <input type="text" value={formData.name_surname}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_surname: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Smith" />
              </div>
            </div>
          </div>
          
          {/* Demographics */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700 border-b pb-2">Demographics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                <select value={formData.sex}
                  onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="">Unknown</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div className="flex items-center pt-6">
                <input type="checkbox" id="living" checked={formData.living}
                  onChange={(e) => setFormData(prev => ({ ...prev, living: e.target.checked }))}
                  className="w-4 h-4 mr-2" />
                <label htmlFor="living" className="text-sm text-gray-700">Living</label>
              </div>
            </div>
          </div>
          
          {/* Birth */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700 border-b pb-2">Birth</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birth Year</label>
                <input type="number" value={formData.birth_year}
                  onChange={(e) => setFormData(prev => ({ ...prev, birth_year: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2" placeholder="1900" min="1" max="2100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birth Place</label>
                <input type="text" value={formData.birth_place}
                  onChange={(e) => setFormData(prev => ({ ...prev, birth_place: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2" placeholder="City, State, Country" />
              </div>
            </div>
          </div>

          {/* Death (hidden if living) */}
          {!formData.living && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Death</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Death Year</label>
                  <input type="number" value={formData.death_year}
                    onChange={(e) => setFormData(prev => ({ ...prev, death_year: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2" placeholder="1980" min="1" max="2100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Death Place</label>
                  <input type="text" value={formData.death_place}
                    onChange={(e) => setFormData(prev => ({ ...prev, death_place: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2" placeholder="City, State, Country" />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
            <textarea value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 h-24" placeholder="Additional information..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { resetForm(); onClose(); }}>Cancel</Button>
            <Button type="submit" loading={loading} className="bg-green-600 hover:bg-green-700">Create Person</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

