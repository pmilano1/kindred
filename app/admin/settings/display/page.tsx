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

export default function DisplaySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const refetchGlobalSettings = useSettingsRefetch();

  const [settings, setSettings] = useState({
    date_format: 'MDY',
    default_tree_generations: '3',
    show_coats_of_arms: 'false',
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
        text: 'Display settings saved successfully!',
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
        <h2 className="text-xl font-semibold mb-6">Display Settings</h2>

        <div className="space-y-6">
          <div>
            <Label htmlFor="date_format">Date Format</Label>
            <Select
              value={settings.date_format}
              onValueChange={(v) => updateSetting('date_format', v)}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MDY">MM/DD/YYYY (US)</SelectItem>
                <SelectItem value="DMY">DD/MM/YYYY (EU)</SelectItem>
                <SelectItem value="ISO">YYYY-MM-DD (ISO)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500 mt-1">
              How dates are displayed throughout the site
            </p>
          </div>

          <div>
            <Label htmlFor="default_tree_generations">
              Default Tree Generations
            </Label>
            <Input
              id="default_tree_generations"
              type="number"
              value={settings.default_tree_generations}
              onChange={(e) =>
                updateSetting('default_tree_generations', e.target.value)
              }
            />
            <p className="text-sm text-gray-500 mt-1">
              Number of generations to show by default in family tree view
            </p>
          </div>

          <div>
            <Label htmlFor="show_coats_of_arms">Show Coats of Arms</Label>
            <Select
              value={settings.show_coats_of_arms}
              onValueChange={(v) => updateSetting('show_coats_of_arms', v)}
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
              Display family coat of arms when available
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
            Save Display Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
