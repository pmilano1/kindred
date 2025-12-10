'use client';

import { useState } from 'react';
import { EmailSettings } from '@/components/admin/EmailSettings';

export default function EmailIntegrationPage() {
  const [refetchTrigger, _setRefetchTrigger] = useState(0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-2">Email Configuration</h2>
        <p className="text-gray-600 mb-6">
          Configure email settings for sending notifications and invitations.
        </p>

        <EmailSettings refetchTrigger={refetchTrigger} />
      </div>
    </div>
  );
}
