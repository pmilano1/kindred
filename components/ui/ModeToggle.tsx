'use client';

import { Search, UserPlus } from 'lucide-react';

export type AddPersonMode = 'search' | 'create';

interface ModeToggleProps {
  mode: AddPersonMode;
  onChange: (mode: AddPersonMode) => void;
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800">
      <button
        type="button"
        onClick={() => onChange('search')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'search'
            ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        <Search className="w-4 h-4" />
        Search Existing
      </button>
      <button
        type="button"
        onClick={() => onChange('create')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'create'
            ? 'bg-white dark:bg-gray-700 shadow-sm text-green-600 dark:text-green-400'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        <UserPlus className="w-4 h-4" />
        Create New
      </button>
    </div>
  );
}
