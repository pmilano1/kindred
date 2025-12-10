'use client';

import { Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useSettingsRefetch } from '@/components/SettingsProvider';
import { Button, Input, Label, Textarea } from '@/components/ui';
import {
  applyThemePreset,
  getPresetByPrimaryColor,
  type ThemePreset,
  themePresets,
} from '@/lib/theme-presets';

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

export default function BrandingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const refetchGlobalSettings = useSettingsRefetch();

  const [settings, setSettings] = useState({
    site_name: '',
    family_name: '',
    site_tagline: '',
    theme_color: '',
    logo_url: '',
    footer_text: '',
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
        text: 'Branding settings saved successfully!',
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

  const handleSelectPreset = (preset: ThemePreset) => {
    updateSetting('theme_color', preset.colors.primary);
    applyThemePreset(preset);
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
        <h2 className="text-xl font-semibold mb-6">Site Branding</h2>

        <div className="space-y-6">
          <div>
            <Label htmlFor="site_name">Site Name</Label>
            <Input
              id="site_name"
              value={settings.site_name}
              onChange={(e) => updateSetting('site_name', e.target.value)}
              placeholder="My Family Tree"
            />
          </div>

          <div>
            <Label htmlFor="family_name">Family Name</Label>
            <Input
              id="family_name"
              value={settings.family_name}
              onChange={(e) => updateSetting('family_name', e.target.value)}
              placeholder="Smith Family"
            />
          </div>

          <div>
            <Label htmlFor="site_tagline">Tagline</Label>
            <Input
              id="site_tagline"
              value={settings.site_tagline}
              onChange={(e) => updateSetting('site_tagline', e.target.value)}
              placeholder="Preserving our family history"
            />
          </div>

          <div>
            <Label htmlFor="logo_url">Logo URL</Label>
            <Input
              id="logo_url"
              value={settings.logo_url}
              onChange={(e) => updateSetting('logo_url', e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label>Theme Color</Label>
            <ThemePresetPicker
              value={settings.theme_color}
              onSelectPreset={handleSelectPreset}
            />
          </div>

          <div>
            <Label htmlFor="footer_text">Footer Text</Label>
            <Textarea
              id="footer_text"
              value={settings.footer_text}
              onChange={(e) => updateSetting('footer_text', e.target.value)}
              rows={2}
              placeholder="Optional footer message"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            loading={saving}
            icon={<Save className="w-4 h-4" />}
          >
            Save Branding Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

function ThemePresetPicker({
  value,
  onSelectPreset,
}: {
  value: string;
  onSelectPreset: (preset: ThemePreset) => void;
}) {
  const currentPreset = getPresetByPrimaryColor(value);

  return (
    <div className="grid grid-cols-4 gap-2">
      {themePresets.map((preset) => {
        const isSelected = currentPreset?.id === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset)}
            className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all hover:border-blue-400 ${
              isSelected
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
            title={preset.description}
          >
            <div
              className="w-6 h-6 rounded-full border border-gray-300"
              style={{ backgroundColor: preset.colors.primary }}
            />
            <span className="text-sm font-medium">{preset.name}</span>
          </button>
        );
      })}
    </div>
  );
}
