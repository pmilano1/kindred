'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface EmailConfig {
  configured: boolean;
  type: 'ses' | 'smtp' | 'none';
  details?: string;
}

interface EmailConfigWarningProps {
  /** Show success message when configured (default: false) */
  showSuccess?: boolean;
}

/**
 * Displays a warning banner when email is not configured.
 * Only visible to admins.
 */
export function EmailConfigWarning({ showSuccess = false }: EmailConfigWarningProps) {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/email-config');
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
        }
      } catch (error) {
        console.error('Failed to fetch email config:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  if (loading || !config) {
    return null;
  }

  if (config.configured && showSuccess) {
    return (
      <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-green-800">Email Configured</p>
          <p className="text-sm text-green-700">{config.details}</p>
        </div>
      </div>
    );
  }

  if (!config.configured) {
    return (
      <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-amber-800">Email Not Configured</p>
          <p className="text-sm text-amber-700">
            Invitation emails will not be sent. Configure email by setting environment variables:
          </p>
          <ul className="text-sm text-amber-700 mt-2 list-disc list-inside">
            <li><strong>AWS SES:</strong> Set <code className="bg-amber-100 px-1 rounded">EMAIL_FROM</code> (e.g., &quot;App Name &lt;noreply@example.com&gt;&quot;)</li>
            <li><strong>SMTP:</strong> Set <code className="bg-amber-100 px-1 rounded">SMTP_HOST</code>, <code className="bg-amber-100 px-1 rounded">SMTP_PORT</code>, and optionally <code className="bg-amber-100 px-1 rounded">SMTP_USER</code>/<code className="bg-amber-100 px-1 rounded">SMTP_PASSWORD</code></li>
          </ul>
        </div>
      </div>
    );
  }

  return null;
}

export default EmailConfigWarning;

