'use client';

import { Input } from '@/components/ui';

export interface PersonFormData {
  name_given: string;
  name_surname: string;
  sex: string;
  birth_year: string;
  birth_place: string;
  living: boolean;
}

interface PersonFormProps {
  data: PersonFormData;
  onChange: (data: PersonFormData) => void;
  showLiving?: boolean;
}

export default function PersonForm({
  data,
  onChange,
  showLiving = true,
}: PersonFormProps) {
  const handleChange = (
    field: keyof PersonFormData,
    value: string | boolean,
  ) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input
          type="text"
          placeholder="Given Name *"
          value={data.name_given}
          onChange={(e) => handleChange('name_given', e.target.value)}
        />
        <Input
          type="text"
          placeholder="Surname *"
          value={data.name_surname}
          onChange={(e) => handleChange('name_surname', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <select
          className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
          value={data.sex}
          onChange={(e) => handleChange('sex', e.target.value)}
        >
          <option value="">Sex</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
        </select>
        <Input
          type="number"
          placeholder="Birth Year"
          value={data.birth_year}
          onChange={(e) => handleChange('birth_year', e.target.value)}
        />
        <Input
          type="text"
          placeholder="Birth Place"
          value={data.birth_place}
          onChange={(e) => handleChange('birth_place', e.target.value)}
        />
      </div>
      {showLiving && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.living}
            onChange={(e) => handleChange('living', e.target.checked)}
            className="rounded"
          />
          Living person
        </label>
      )}
    </div>
  );
}

export const emptyPersonFormData: PersonFormData = {
  name_given: '',
  name_surname: '',
  sex: '',
  birth_year: '',
  birth_place: '',
  living: true,
};
