'use client';

import { useMutation } from '@apollo/client/react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Input, Label } from '@/components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DELETE_PERSON } from '@/lib/graphql/queries';
import type { Person } from '@/lib/types';

interface DeletePersonDialogProps {
  person: Person & {
    parents: Person[];
    children: Person[];
    spouses: Person[];
  };
  isOpen: boolean;
  onClose: () => void;
}

export default function DeletePersonDialog({
  person,
  isOpen,
  onClose,
}: DeletePersonDialogProps) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  const [deletePerson, { loading }] = useMutation(DELETE_PERSON, {
    onCompleted: () => {
      router.push('/people');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }
    await deletePerson({ variables: { id: person.id } });
  };

  const hasRelationships =
    person.parents.length > 0 ||
    person.children.length > 0 ||
    person.spouses.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Delete Person
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete{' '}
            <strong>{person.name_full}</strong> and all associated data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Affected relationships warning */}
          {hasRelationships && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-800 mb-2">
                ⚠️ This person has relationships:
              </p>
              <ul className="text-sm text-amber-700 space-y-1">
                {person.parents.length > 0 && (
                  <li>
                    • {person.parents.length} parent(s):{' '}
                    {person.parents.map((p) => p.name_full).join(', ')}
                  </li>
                )}
                {person.spouses.length > 0 && (
                  <li>
                    • {person.spouses.length} spouse(s):{' '}
                    {person.spouses.map((s) => s.name_full).join(', ')}
                  </li>
                )}
                {person.children.length > 0 && (
                  <li>
                    • {person.children.length} child(ren):{' '}
                    {person.children.map((c) => c.name_full).join(', ')}
                  </li>
                )}
              </ul>
              <p className="text-xs text-amber-600 mt-2">
                These links will be removed, but the related people will not be
                deleted.
              </p>
            </div>
          )}

          {/* What will be deleted */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-medium text-red-800 mb-2">
              The following will be permanently deleted:
            </p>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Person record and all biographical data</li>
              <li>• All sources attached to this person</li>
              <li>• All facts and life events</li>
              <li>• Family relationship links</li>
            </ul>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <Label>
              Type <strong>DELETE</strong> to confirm:
            </Label>
            <Input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="focus:ring-red-500 focus:border-red-500"
              placeholder="DELETE"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || confirmText !== 'DELETE'}
            loading={loading}
            icon={<Trash2 className="w-4 h-4" />}
          >
            Delete Person
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
