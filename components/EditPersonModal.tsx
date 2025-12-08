'use client';

import { useMutation } from '@apollo/client/react';
import { X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import { GET_PERSON, UPDATE_PERSON } from '@/lib/graphql/queries';
import type { Person } from '@/lib/types';

interface EditPersonModalProps {
  person: Person;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditPersonModal({
  person,
  isOpen,
  onClose,
  onSuccess,
}: EditPersonModalProps) {
  const { data: session } = useSession();
  const canEdit =
    session?.user?.role === 'admin' || session?.user?.role === 'editor';

  const [formData, setFormData] = useState({
    name_full: '',
    name_given: '',
    name_surname: '',
    sex: '',
    birth_date: '',
    birth_year: '',
    birth_place: '',
    death_date: '',
    death_year: '',
    death_place: '',
    burial_date: '',
    burial_place: '',
    christening_date: '',
    christening_place: '',
    immigration_date: '',
    immigration_place: '',
    naturalization_date: '',
    naturalization_place: '',
    religion: '',
    living: false,
    description: '',
  });

  const [error, setError] = useState('');

  // Initialize form with person data - valid synchronization pattern
  useEffect(() => {
    if (person && isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        name_full: person.name_full || '',
        name_given: person.name_given || '',
        name_surname: person.name_surname || '',
        sex: person.sex || '',
        birth_date: person.birth_date || '',
        birth_year: person.birth_year?.toString() || '',
        birth_place: person.birth_place || '',
        death_date: person.death_date || '',
        death_year: person.death_year?.toString() || '',
        death_place: person.death_place || '',
        burial_date: person.burial_date || '',
        burial_place: person.burial_place || '',
        christening_date: person.christening_date || '',
        christening_place: person.christening_place || '',
        immigration_date: person.immigration_date || '',
        immigration_place: person.immigration_place || '',
        naturalization_date: person.naturalization_date || '',
        naturalization_place: person.naturalization_place || '',
        religion: person.religion || '',
        living: person.living || false,
        description: person.description || '',
      });
      setError('');
    }
  }, [person, isOpen]);

  const [updatePerson, { loading }] = useMutation(UPDATE_PERSON, {
    refetchQueries: [{ query: GET_PERSON, variables: { id: person.id } }],
    onCompleted: () => {
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

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

    // Add optional fields only if they have values or are being cleared
    const stringFields = [
      'name_given',
      'name_surname',
      'sex',
      'birth_date',
      'birth_place',
      'death_date',
      'death_place',
      'burial_date',
      'burial_place',
      'christening_date',
      'christening_place',
      'immigration_date',
      'immigration_place',
      'naturalization_date',
      'naturalization_place',
      'religion',
      'description',
    ];

    for (const field of stringFields) {
      const value = formData[field as keyof typeof formData];
      if (typeof value === 'string') {
        input[field] = value.trim() || null;
      }
    }

    // Handle year fields
    input.birth_year = formData.birth_year
      ? parseInt(formData.birth_year, 10)
      : null;
    input.death_year = formData.death_year
      ? parseInt(formData.death_year, 10)
      : null;

    await updatePerson({ variables: { id: person.id, input } });
  };

  if (!isOpen || !canEdit) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--card)] text-[var(--card-foreground)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b border-[var(--border)] sticky top-0 bg-[var(--card)] z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Edit Person</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* Name Section */}
          <Section title="Name">
            <Field
              label="Full Name *"
              value={formData.name_full}
              onChange={(v) => setFormData((p) => ({ ...p, name_full: v }))}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Given Name"
                value={formData.name_given}
                onChange={(v) => setFormData((p) => ({ ...p, name_given: v }))}
              />
              <Field
                label="Surname"
                value={formData.name_surname}
                onChange={(v) =>
                  setFormData((p) => ({ ...p, name_surname: v }))
                }
              />
            </div>
          </Section>

          {/* Demographics */}
          <Section title="Demographics">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sex</Label>
                <Select
                  value={formData.sex}
                  onValueChange={(v) => setFormData((p) => ({ ...p, sex: v }))}
                >
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
                <Checkbox
                  id="edit-living"
                  checked={formData.living}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, living: checked === true }))
                  }
                />
                <Label htmlFor="edit-living" className="cursor-pointer">
                  Living
                </Label>
              </div>
            </div>
            <Field
              label="Religion"
              value={formData.religion}
              onChange={(v) => setFormData((p) => ({ ...p, religion: v }))}
            />
          </Section>

          {/* Birth */}
          <Section title="Birth">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Birth Date"
                value={formData.birth_date}
                onChange={(v) => setFormData((p) => ({ ...p, birth_date: v }))}
                placeholder="e.g., 15 Mar 1850"
              />
              <Field
                label="Birth Year"
                value={formData.birth_year}
                type="number"
                onChange={(v) => setFormData((p) => ({ ...p, birth_year: v }))}
                placeholder="1850"
              />
            </div>
            <Field
              label="Birth Place"
              value={formData.birth_place}
              onChange={(v) => setFormData((p) => ({ ...p, birth_place: v }))}
              placeholder="City, State, Country"
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Christening Date"
                value={formData.christening_date}
                onChange={(v) =>
                  setFormData((p) => ({ ...p, christening_date: v }))
                }
              />
              <Field
                label="Christening Place"
                value={formData.christening_place}
                onChange={(v) =>
                  setFormData((p) => ({ ...p, christening_place: v }))
                }
              />
            </div>
          </Section>

          {/* Death (hidden if living) */}
          {!formData.living && (
            <Section title="Death">
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Death Date"
                  value={formData.death_date}
                  onChange={(v) =>
                    setFormData((p) => ({ ...p, death_date: v }))
                  }
                  placeholder="e.g., 22 Nov 1920"
                />
                <Field
                  label="Death Year"
                  value={formData.death_year}
                  type="number"
                  onChange={(v) =>
                    setFormData((p) => ({ ...p, death_year: v }))
                  }
                  placeholder="1920"
                />
              </div>
              <Field
                label="Death Place"
                value={formData.death_place}
                onChange={(v) => setFormData((p) => ({ ...p, death_place: v }))}
                placeholder="City, State, Country"
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Burial Date"
                  value={formData.burial_date}
                  onChange={(v) =>
                    setFormData((p) => ({ ...p, burial_date: v }))
                  }
                />
                <Field
                  label="Burial Place"
                  value={formData.burial_place}
                  onChange={(v) =>
                    setFormData((p) => ({ ...p, burial_place: v }))
                  }
                />
              </div>
            </Section>
          )}

          {/* Immigration */}
          <Section title="Immigration">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Immigration Date"
                value={formData.immigration_date}
                onChange={(v) =>
                  setFormData((p) => ({ ...p, immigration_date: v }))
                }
              />
              <Field
                label="Immigration Place"
                value={formData.immigration_place}
                onChange={(v) =>
                  setFormData((p) => ({ ...p, immigration_place: v }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Naturalization Date"
                value={formData.naturalization_date}
                onChange={(v) =>
                  setFormData((p) => ({ ...p, naturalization_date: v }))
                }
              />
              <Field
                label="Naturalization Place"
                value={formData.naturalization_place}
                onChange={(v) =>
                  setFormData((p) => ({ ...p, naturalization_place: v }))
                }
              />
            </div>
          </Section>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Description / Notes</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((p) => ({ ...p, description: e.target.value }))
              }
              className="h-24"
              placeholder="Additional information..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)] pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
