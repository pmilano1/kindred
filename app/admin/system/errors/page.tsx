'use client';

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { AlertCircle } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui';

interface ClientError {
  id: string;
  user_id: string | null;
  error_message: string;
  stack_trace: string | null;
  url: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ClientErrorStats {
  total: number;
  last24Hours: number;
  last7Days: number;
  uniqueErrors: number;
}

interface Setting {
  key: string;
  value: string;
}

interface GetClientErrorsData {
  clientErrors: ClientError[];
  clientErrorStats: ClientErrorStats;
  settings: Setting[];
}

const GET_CLIENT_ERRORS = gql`
  query GetClientErrors($limit: Int, $offset: Int) {
    clientErrors(limit: $limit, offset: $offset) {
      id
      user_id
      error_message
      stack_trace
      url
      user_agent
      created_at
    }
    clientErrorStats {
      total
      last24Hours
      last7Days
      uniqueErrors
    }
    settings {
      key
      value
    }
  }
`;

const CLEAR_ALL_ERRORS = gql`
  mutation ClearAllClientErrors {
    clearAllClientErrors
  }
`;

const UPDATE_SETTINGS = gql`
  mutation UpdateSettings($input: SettingsInput!) {
    updateSettings(input: $input) {
      enable_error_logging
    }
  }
`;

export default function ClientErrorsPage() {
  const { data, loading, refetch } = useQuery<GetClientErrorsData>(
    GET_CLIENT_ERRORS,
    {
      variables: { limit: 100, offset: 0 },
    },
  );
  const [clearAll] = useMutation(CLEAR_ALL_ERRORS);
  const [updateSettings] = useMutation(UPDATE_SETTINGS);

  const errors = data?.clientErrors || [];
  const stats = data?.clientErrorStats || {
    total: 0,
    last24Hours: 0,
    last7Days: 0,
    uniqueErrors: 0,
  };
  const errorLoggingEnabled =
    data?.settings?.find((s) => s.key === 'enable_error_logging')?.value ===
    'true';

  const handleClearAll = async () => {
    if (!confirm('Delete ALL client errors? This cannot be undone.')) return;
    await clearAll();
    refetch();
  };

  const handleToggleLogging = async () => {
    await updateSettings({
      variables: {
        input: {
          enable_error_logging: errorLoggingEnabled ? 'false' : 'true',
        },
      },
    });
    refetch();
  };

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading client errors..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Client Errors</h1>
          <p className="text-gray-600 mt-2">
            View and manage client-side JavaScript errors
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleToggleLogging}
            variant={errorLoggingEnabled ? 'danger' : 'primary'}
            size="sm"
          >
            {errorLoggingEnabled ? 'Disable' : 'Enable'} Error Logging
          </Button>
          {errors.length > 0 && (
            <Button onClick={handleClearAll} variant="danger" size="sm">
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold">{stats.total || 0}</div>
          <div className="text-sm text-gray-600">Total Errors</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold">{stats.last24Hours || 0}</div>
          <div className="text-sm text-gray-600">Last 24 Hours</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold">{stats.last7Days || 0}</div>
          <div className="text-sm text-gray-600">Last 7 Days</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold">{stats.uniqueErrors || 0}</div>
          <div className="text-sm text-gray-600">Unique Errors</div>
        </div>
      </div>

      {/* Error List */}
      <div className="bg-white rounded-xl shadow-sm border">
        {errors.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No client errors logged</p>
          </div>
        ) : (
          <div className="divide-y">
            {errors.map((error) => (
              <div key={error.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-red-600 mb-1">
                      {error.error_message}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {error.url && <div>URL: {error.url}</div>}
                      {error.created_at && (
                        <div>{new Date(error.created_at).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
