'use client';

import { Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useSettingsRefetch } from '@/components/SettingsProvider';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';

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

export default function PrivacySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const refetchGlobalSettings = useSettingsRefetch();

  const [settings, setSettings] = useState({
    require_login: 'false',
    show_living_details: 'false',
    living_cutoff_years: '100',
    admin_email: '',
  });

  const loadSettings = useCallback(async () => {
    try {
      const data = await graphqlFetch(`
        query { settings { key value } }
      `);
      const settingsMap: Record<string, string> = {};
      for (const row of data.settings) {
        if (row.key in settings) {
          settingsMap[row.key] = row.value || '';
        }
      }
      setSettings((prev) => ({ ...prev, ...settingsMap }));
    } catch (err) {
      console.error('Failed to load settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await graphqlFetch(
        `mutation UpdateSettings($input: SettingsInput!) {
          updateSettings(input: $input) { site_name }
        }`,
        { input: settings },
      );
      refetchGlobalSettings();
      setMessage({
        type: 'success',
        text: 'Privacy settings saved successfully!',
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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
        <h2 className="text-xl font-semibold mb-6">Privacy & Access</h2>

        <div className="space-y-6">
          <div>
            <Label htmlFor="require_login">Require Login</Label>
            <Select
              value={settings.require_login}
              onValueChange={(v) => updateSetting('require_login', v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500 mt-1">
              Require users to log in to view the family tree
            </p>
          </div>

          <div>
            <Label htmlFor="show_living_details">Show Living Details</Label>
            <Select
              value={settings.show_living_details}
              onValueChange={(v) => updateSetting('show_living_details', v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500 mt-1">
              Show full details for living people (birth dates, etc.)
            </p>
          </div>

          <div>
            <Label htmlFor="living_cutoff_years">Living Cutoff (Years)</Label>
            <Input
              id="living_cutoff_years"
              type="number"
              value={settings.living_cutoff_years}
              onChange={(e) =>
                updateSetting('living_cutoff_years', e.target.value)
              }
            />
            <p className="text-sm text-gray-500 mt-1">
              Assume people are living if born within this many years
            </p>
          </div>

          <div>
            <Label htmlFor="admin_email">Admin Email</Label>
            <Input
              id="admin_email"
              type="email"
              value={settings.admin_email}
              onChange={(e) => updateSetting('admin_email', e.target.value)}
              placeholder="admin@example.com"
            />
            <p className="text-sm text-gray-500 mt-1">
              Email address for administrative notifications
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            loading={saving}
            icon={<Save className="w-4 h-4" />}
          >
            Save Privacy Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
