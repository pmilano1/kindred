'use client';

import { Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui';

async function graphqlFetch(
  query: string,
  variables?: Record<string, unknown>,
) {
  const res = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

export default function DatabasePage() {
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const checkMigrationStatus = useCallback(async () => {
    try {
      const data = await graphqlFetch(
        `query { migrationStatus { migrationNeeded } }`,
      );
      setNeedsMigration(data.migrationStatus.migrationNeeded);
    } catch (err) {
      console.error('Failed to check migration status:', err);
      setMessage({ type: 'error', text: 'Failed to check migration status' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkMigrationStatus();
  }, [checkMigrationStatus]);

  const handleMigrate = async () => {
    setMigrating(true);
    setMessage(null);
    try {
      const data = await graphqlFetch(
        `mutation { runMigrations { success results message } }`,
      );
      setMessage({
        type: 'success',
        text: `Migration completed: ${data.runMigrations.results.join(', ')}`,
      });
      await checkMigrationStatus();
    } catch (err) {
      setMessage({
        type: 'error',
        text: `Migration failed: ${(err as Error).message}`,
      });
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-2">Database Migrations</h2>
        <p className="text-gray-600 mb-6">
          Run database migrations to update the schema to the latest version.
        </p>

        {needsMigration ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 font-medium">
              ⚠️ Database migration required
            </p>
            <p className="text-yellow-700 text-sm mt-1">
              Your database schema needs to be updated. Click the button below
              to run migrations.
            </p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-green-800 font-medium">
              ✅ Database is up to date
            </p>
            <p className="text-green-700 text-sm mt-1">
              No migrations needed at this time.
            </p>
          </div>
        )}

        <Button
          onClick={handleMigrate}
          disabled={migrating}
          loading={migrating}
          variant={needsMigration ? 'primary' : 'secondary'}
          icon={<Play className="w-4 h-4" />}
        >
          {migrating ? 'Running Migrations...' : 'Run Migrations'}
        </Button>
      </div>
    </div>
  );
}
