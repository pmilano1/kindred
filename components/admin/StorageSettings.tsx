'use client';

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const GET_STORAGE_SETTINGS = gql`
  query GetStorageSettings {
    settings {
      key
      value
    }
  }
`;

const UPDATE_SETTING = gql`
  mutation UpdateSetting($key: String!, $value: String!) {
    updateSetting(key: $key, value: $value) {
      key
      value
    }
  }
`;

const TEST_STORAGE = gql`
  mutation TestStorage {
    testStorage {
      success
      message
      provider
    }
  }
`;

interface Setting {
  key: string;
  value: string;
}

interface StorageSettingsData {
  settings: Setting[];
}

interface TestStorageResult {
  testStorage: {
    success: boolean;
    message: string;
    provider: string;
  };
}

export function StorageSettings() {
  const { data, loading, refetch } =
    useQuery<StorageSettingsData>(GET_STORAGE_SETTINGS);
  const [updateSetting] = useMutation(UPDATE_SETTING);
  const [testStorage] = useMutation<TestStorageResult>(TEST_STORAGE);

  const [provider, setProvider] = useState('local');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('us-east-1');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Load settings from query
  useEffect(() => {
    if (data?.settings) {
      const settings = data.settings.reduce(
        (acc: Record<string, string>, s: { key: string; value: string }) => {
          acc[s.key] = s.value;
          return acc;
        },
        {},
      );

      setProvider(settings.storage_provider || 'local');
      setS3Bucket(settings.storage_s3_bucket || '');
      setS3Region(settings.storage_s3_region || 'us-east-1');
      setS3AccessKey(settings.storage_s3_access_key || '');
      setS3SecretKey(settings.storage_s3_secret_key || '');
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    setTestMessage(null);
    try {
      await updateSetting({
        variables: { key: 'storage_provider', value: provider },
      });
      await updateSetting({
        variables: { key: 'storage_s3_bucket', value: s3Bucket },
      });
      await updateSetting({
        variables: { key: 'storage_s3_region', value: s3Region },
      });
      await updateSetting({
        variables: { key: 'storage_s3_access_key', value: s3AccessKey },
      });
      await updateSetting({
        variables: { key: 'storage_s3_secret_key', value: s3SecretKey },
      });

      await refetch();
      alert('Storage settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestStorage = async () => {
    setTesting(true);
    setTestMessage(null);
    try {
      const result = await testStorage();
      if (result.data?.testStorage.success) {
        setTestMessage({
          type: 'success',
          text: result.data.testStorage.message,
        });
      } else {
        setTestMessage({
          type: 'error',
          text: result.data?.testStorage.message || 'Failed to test storage',
        });
      }
    } catch (error) {
      console.error('Failed to test storage:', error);
      setTestMessage({
        type: 'error',
        text: `Error: ${(error as Error).message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Configuration</CardTitle>
        <CardDescription>
          Configure where media files (photos, documents, coat of arms) are
          stored
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test Message */}
        {testMessage && (
          <div
            className={`p-4 rounded-lg ${testMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}
          >
            {testMessage.text}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="storage-provider">Storage Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger id="storage-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">
                Local Storage (ephemeral in production)
              </SelectItem>
              <SelectItem value="s3">
                Amazon S3 (recommended for production)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Local storage is lost on container restart. Use S3 for production.
          </p>
        </div>

        {provider === 's3' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="s3-bucket">S3 Bucket Name</Label>
              <Input
                id="s3-bucket"
                value={s3Bucket}
                onChange={(e) => setS3Bucket(e.target.value)}
                placeholder="genealogy-media-123456789012"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="s3-region">S3 Region</Label>
              <Input
                id="s3-region"
                value={s3Region}
                onChange={(e) => setS3Region(e.target.value)}
                placeholder="us-east-1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="s3-access-key">Access Key ID (optional)</Label>
              <Input
                id="s3-access-key"
                value={s3AccessKey}
                onChange={(e) => setS3AccessKey(e.target.value)}
                placeholder="Leave empty to use IAM role"
              />
              <p className="text-sm text-muted-foreground">
                If running on AWS (App Runner, EC2), leave empty to use IAM role
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="s3-secret-key">
                Secret Access Key (optional)
              </Label>
              <Input
                id="s3-secret-key"
                type="password"
                value={s3SecretKey}
                onChange={(e) => setS3SecretKey(e.target.value)}
                placeholder="Leave empty to use IAM role"
              />
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button
            onClick={handleTestStorage}
            disabled={testing}
            variant="outline"
          >
            {testing ? 'Testing...' : 'Test Storage'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
