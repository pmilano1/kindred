'use client';

import { useState } from 'react';
import { StorageSettings } from '@/components/admin/StorageSettings';

export default function StorageIntegrationPage() {
  const [refetchTrigger, _setRefetchTrigger] = useState(0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-2">Storage Configuration</h2>
        <p className="text-gray-600 mb-6">
          Configure storage settings for media files (photos, documents, etc.).
        </p>

        <StorageSettings refetchTrigger={refetchTrigger} />
      </div>
    </div>
  );
}
