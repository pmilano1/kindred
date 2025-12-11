'use client';

import { AlertTriangle, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui';

export interface DuplicateMatch {
  id: string;
  name_full: string;
  birth_year: number | null;
  death_year: number | null;
  living: boolean;
  matchReason: string;
  matchScore: number;
}

interface DuplicateWarningModalProps {
  isOpen: boolean;
  duplicates: DuplicateMatch[];
  newPersonName: string;
  onSelectExisting: (id: string) => void;
  onCreateAnyway: () => void;
  onCancel: () => void;
}

export default function DuplicateWarningModal({
  isOpen,
  duplicates,
  newPersonName,
  onSelectExisting,
  onCreateAnyway,
  onCancel,
}: DuplicateWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b bg-amber-50 dark:bg-amber-950">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Possible Duplicates Found</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Similar people already exist in the database
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            You&apos;re creating: <strong>{newPersonName}</strong>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            These existing people may be the same person:
          </p>
          <div className="space-y-2">
            {duplicates.map((dup) => (
              <button
                key={dup.id}
                type="button"
                onClick={() => onSelectExisting(dup.id)}
                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{dup.name_full}</p>
                    <p className="text-sm text-gray-500">
                      {dup.birth_year && `b. ${dup.birth_year}`}
                      {dup.death_year && ` - d. ${dup.death_year}`}
                      {dup.living && ' (living)'}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      dup.matchScore >= 80
                        ? 'bg-red-100 text-red-700'
                        : dup.matchScore >= 50
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {dup.matchScore}% match
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {dup.matchReason.replace(/_/g, ' ')}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 dark:bg-gray-800 flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onCreateAnyway}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Create New Person
          </Button>
        </div>
      </div>
    </div>
  );
}
