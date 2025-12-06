'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import Hero from '@/components/Hero';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';
import { GET_ME, GENERATE_API_KEY, REVOKE_API_KEY } from '@/lib/graphql/queries';

interface UserData {
  me: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    api_key: string | null;
  } | null;
}

export default function ApiKeysPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showKey, setShowKey] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, loading, refetch } = useQuery<UserData>(GET_ME);
  const [generateApiKey, { loading: generating }] = useMutation(GENERATE_API_KEY);
  const [revokeApiKey, { loading: revoking }] = useMutation(REVOKE_API_KEY);

  const user = data?.me;
  const hasKey = !!user?.api_key;

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/');
      return;
    }
  }, [session, status, router]);

  const handleGenerate = async () => {
    if (hasKey && !confirm('This will replace your existing API key. Continue?')) return;
    try {
      const result = await generateApiKey();
      const key = (result.data as { generateApiKey?: string })?.generateApiKey;
      if (key) {
        setNewKey(key);
        setShowKey(true);
        refetch();
      }
    } catch (err) {
      console.error('Failed to generate API key:', err);
      alert('Failed to generate API key');
    }
  };

  const handleRevoke = async () => {
    if (!confirm('Revoke your API key? Any scripts using it will stop working.')) return;
    try {
      await revokeApiKey();
      setNewKey(null);
      setShowKey(false);
      refetch();
    } catch (err) {
      console.error('Failed to revoke API key:', err);
      alert('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••••••••••••••••••' + key.slice(-4);
  };

  if (loading) {
    return (
      <>
        <Hero title="API Keys" subtitle="Manage your API access" />
        <div className="content-wrapper flex justify-center py-12">
          <LoadingSpinner size="lg" message="Loading API key data..." />
        </div>
      </>
    );
  }

  return (
    <>
      <Hero title="API Keys" subtitle="Manage your API access" />
      <div className="content-wrapper">
        {/* Navigation */}
        <div className="flex gap-4 mb-8">
          <Link href="/admin" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
            Users
          </Link>
          <Link href="/admin/settings" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
            Site Settings
          </Link>
          <span className="bg-blue-600 text-white px-4 py-2 rounded-lg">API Keys</span>
        </div>

        {/* API Key Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Your API Key</h2>
          <p className="text-gray-600 mb-6">
            Use an API key to access the GraphQL API programmatically. Include it in the 
            <code className="mx-1 px-2 py-1 bg-gray-100 rounded text-sm">X-API-Key</code> header.
          </p>

          {newKey && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium mb-2">🔑 New API Key Generated</p>
              <p className="text-green-700 text-sm mb-3">
                Copy this key now—you won&apos;t be able to see it again!
              </p>
              <div className="flex items-center gap-2 bg-white border rounded p-2">
                <code className="flex-1 text-sm font-mono break-all">{newKey}</code>
                <button
                  onClick={() => copyToClipboard(newKey)}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {hasKey && !newKey && (
            <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700">Active API Key</p>
                  <code className="text-sm text-gray-500">
                    {showKey ? user?.api_key : maskKey(user?.api_key || '')}
                  </code>
                </div>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="text-blue-600 text-sm hover:underline"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          {!hasKey && !newKey && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">No API key configured. Generate one to enable API access.</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? 'Generating...' : hasKey ? 'Regenerate Key' : 'Generate API Key'}
            </button>
            {hasKey && (
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {revoking ? 'Revoking...' : 'Revoke Key'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

